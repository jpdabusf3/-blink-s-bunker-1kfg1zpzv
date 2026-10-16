import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { BLINK_UF_LIST } from '@/constants/blinkProducts'
import { importBatchClientesDistribuidor } from '@/services/distribuidores-service'
import { useAuth } from '@/hooks/use-auth'

interface ImportarClientesLoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  distribuidorId: string
  distribuidorNome: string
  onSuccess: () => void
}

interface ParsedRow {
  estado: string
  clientes: string
  municipio?: string
  valido: boolean
  motivo?: string
}

export function ImportarClientesLoteModal({
  open,
  onOpenChange,
  distribuidorId,
  distribuidorNome,
  onSuccess,
}: ImportarClientesLoteModalProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setParsing(true)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (!rawJson || rawJson.length < 2) {
          toast.error('A planilha selecionada está vazia ou sem cabeçalhos.')
          setParsing(false)
          return
        }

        // Identificar colunas ESTADO e CLIENTES (case-insensitive)
        const headerRow = rawJson[0] as any[]
        let colEstadoIdx = -1
        let colClienteIdx = -1
        let colMunicipioIdx = -1

        headerRow.forEach((h, idx) => {
          const norm = String(h || '')
            .trim()
            .toUpperCase()
          if (norm.includes('ESTADO') || norm === 'UF') colEstadoIdx = idx
          if (norm.includes('CLIENTE') || norm.includes('NOME') || norm.includes('DEFINICAO'))
            colClienteIdx = idx
          if (norm.includes('MUNICIPIO') || norm.includes('CIDADE')) colMunicipioIdx = idx
        })

        // Se não achou pelos nomes esperados, tenta assumir col 0 = ESTADO, col 1 = CLIENTES
        if (colClienteIdx === -1 && colEstadoIdx === -1) {
          colEstadoIdx = 0
          colClienteIdx = 1
        } else if (colClienteIdx === -1) {
          colClienteIdx = colEstadoIdx === 0 ? 1 : 0
        }

        const parsed: ParsedRow[] = []
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i]
          if (!row || row.length === 0) continue

          const rawEstado =
            colEstadoIdx >= 0
              ? String(row[colEstadoIdx] || '')
                  .trim()
                  .toUpperCase()
              : ''
          const rawCliente = colClienteIdx >= 0 ? String(row[colClienteIdx] || '').trim() : ''
          const rawMun = colMunicipioIdx >= 0 ? String(row[colMunicipioIdx] || '').trim() : ''

          if (!rawCliente) continue

          const ufValida = BLINK_UF_LIST.includes(rawEstado as any)
          parsed.push({
            estado: ufValida ? rawEstado : rawEstado || '',
            clientes: rawCliente,
            municipio: rawMun,
            valido: true,
            motivo: !rawEstado
              ? 'UF em branco (sinalizado para complemento)'
              : !ufValida
                ? `UF '${rawEstado}' desconhecida`
                : undefined,
          })
        }

        if (parsed.length === 0) {
          toast.error('Nenhum registro de cliente foi identificado na planilha.')
        } else {
          toast.success(`${parsed.length} clientes identificados na planilha.`)
        }
        setRows(parsed)
      } catch (err: any) {
        console.error('[ImportarClientesLoteModal] Erro ao ler planilha:', err)
        toast.error('Falha ao processar planilha Excel. Verifique o arquivo.')
      } finally {
        setParsing(false)
      }
    }

    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    if (rows.length === 0) return

    setImporting(true)
    try {
      const res = await importBatchClientesDistribuidor(
        distribuidorId,
        distribuidorNome,
        rows.map((r) => ({
          estado: r.estado,
          clientes: r.clientes,
          municipio: r.municipio,
        })),
        user,
      )

      toast.success(
        `Importação concluída: ${res.inseridos} clientes incluídos na carteira!${
          res.pendentesUF > 0 ? ` (${res.pendentesUF} com UF pendente de complemento)` : ''
        }`,
      )
      onSuccess()
      onOpenChange(false)
      setRows([])
      setFileName('')
    } catch (err: any) {
      console.error('[ImportarClientesLoteModal] Falha na importação:', err)
      toast.error(err?.message || 'Erro ao importar clientes. Tente novamente.')
    } finally {
      setImporting(false)
    }
  }

  const semUfCount = rows.filter((r) => !r.estado).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importação em Lote de Clientes
          </DialogTitle>
          <DialogDescription>
            Importe a carteira completa da planilha (colunas <strong>ESTADO</strong> e{' '}
            <strong>CLIENTES</strong>) para a{' '}
            <strong className="text-foreground">{distribuidorNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Caixa de Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/60 rounded-lg p-6 text-center cursor-pointer transition-colors bg-muted/20"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">
              {fileName || 'Clique para selecionar arquivo .xlsx, .xls ou .csv'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Colunas suportadas: <code>ESTADO</code> (ou UF), <code>CLIENTES</code> (ou Nome) e
              opcionalmente <code>MUNICÍPIO</code>.
            </p>
          </div>

          {parsing && (
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Processando dados da
              planilha...
            </div>
          )}

          {rows.length > 0 && !parsing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Pré-visualização ({rows.length} registros encontrados)
                </span>
                {semUfCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs"
                  >
                    {semUfCount} clientes sem UF (sinalizados)
                  </Badge>
                )}
              </div>

              {semUfCount > 0 && (
                <Alert className="py-2 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                    Clientes sem UF serão cadastrados com aviso de complemento na tabela.
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-60 overflow-y-auto border border-border/60 rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead className="w-20">UF</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead className="w-36">Status da Linha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((r, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell className="font-semibold">
                          {r.estado ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {r.estado}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              Sem UF
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{r.clientes}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.municipio || '—'}
                        </TableCell>
                        <TableCell>
                          {r.motivo ? (
                            <span className="text-[11px] text-amber-600">{r.motivo}</span>
                          ) : (
                            <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Pronto
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 100 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Exibindo os primeiros 100 de {rows.length} registros. A importação gravará todos.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={rows.length === 0 || importing || parsing}
            onClick={handleImport}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando lote...
              </>
            ) : (
              `Importar ${rows.length} Clientes`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
