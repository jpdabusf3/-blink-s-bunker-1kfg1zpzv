import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table as TableIcon,
  Search,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  Loader2,
  DollarSign,
  Layers,
  Calendar,
  Building2,
  Package,
  UserCheck,
  Globe,
  Hash,
} from 'lucide-react'
import { toast } from 'sonner'
import type { FaturamentoRecord } from '@/services/resumo-vendas'
import { updateFaturamento } from '@/services/resumo-vendas'
import { FAMILIAS_PRODUTO_OPTIONS } from '@/services/historico-vendas'

interface EditableFaturamentoTableProps {
  records: FaturamentoRecord[]
  loading: boolean
  onRecordUpdated?: (updated: FaturamentoRecord) => void
  onRefresh: () => void
}

type EditableField =
  | 'data_documento'
  | 'cliente_nome'
  | 'produto_descricao'
  | 'familia_produto'
  | 'quantidade'
  | 'valor_usd'
  | 'valor_brl'
  | 'vendedor'
  | 'country'
  | 'nf_ano'

interface ActiveCell {
  recordId: string
  field: EditableField
}

export function EditableFaturamentoTable({
  records,
  loading,
  onRecordUpdated,
  onRefresh,
}: EditableFaturamentoTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFamilia, setSelectedFamilia] = useState<string>('all')
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [cellValue, setCellValue] = useState<string>('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [cellError, setCellError] = useState<{
    id: string
    field: EditableField
    message: string
  } | null>(null)

  // Filtros
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        !searchTerm.trim() ||
        (r.cliente_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.produto_descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.vendedor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.familia_produto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.nf_ano || '').includes(searchTerm)

      const matchFamilia = selectedFamilia === 'all' || r.familia_produto === selectedFamilia

      return matchSearch && matchFamilia
    })
  }, [records, searchTerm, selectedFamilia])

  // Iniciar edição inline de célula
  const startEditing = (record: FaturamentoRecord, field: EditableField) => {
    // Se já estiver salvando esta mesma célula, ignora
    if (savingId === `${record.id}-${field}`) return

    let currentVal = ''
    switch (field) {
      case 'data_documento':
        currentVal = record.data_documento ? record.data_documento.split('T')[0] : ''
        break
      case 'cliente_nome':
        currentVal = record.cliente_nome || ''
        break
      case 'produto_descricao':
        currentVal = record.produto_descricao || ''
        break
      case 'familia_produto':
        currentVal = record.familia_produto || ''
        break
      case 'quantidade':
        currentVal =
          record.quantidade !== undefined && record.quantidade !== null
            ? String(record.quantidade)
            : ''
        break
      case 'valor_usd':
        currentVal =
          record.valor_usd !== undefined && record.valor_usd !== null
            ? String(record.valor_usd)
            : ''
        break
      case 'valor_brl':
        currentVal =
          record.valor_brl !== undefined && record.valor_brl !== null
            ? String(record.valor_brl)
            : ''
        break
      case 'vendedor':
        currentVal = record.vendedor || ''
        break
      case 'country':
        currentVal = record.country || 'BR'
        break
      case 'nf_ano':
        currentVal = record.nf_ano ? String(record.nf_ano) : ''
        break
    }

    setActiveCell({ recordId: record.id, field })
    setCellValue(currentVal)
    setCellError(null)
  }

  const cancelEditing = () => {
    setActiveCell(null)
    setCellValue('')
    setCellError(null)
  }

  // Validação em português
  const validateValue = (
    field: EditableField,
    rawVal: string,
  ): { valid: boolean; error?: string; parsedValue?: unknown } => {
    const trimmed = rawVal.trim()

    if (field === 'data_documento') {
      if (!trimmed) {
        return { valid: false, error: 'Data não pode ficar vazia.' }
      }
      // Formato YYYY-MM-DD
      const d = new Date(trimmed)
      if (isNaN(d.getTime())) {
        return { valid: false, error: 'Data inválida. Use o formato AAAA-MM-DD.' }
      }
      return { valid: true, parsedValue: trimmed }
    }

    if (field === 'cliente_nome') {
      if (!trimmed) {
        return { valid: false, error: 'Nome do cliente não pode ser vazio.' }
      }
      return { valid: true, parsedValue: trimmed }
    }

    if (field === 'produto_descricao') {
      if (!trimmed) {
        return { valid: false, error: 'Descrição do produto não pode ser vazia.' }
      }
      return { valid: true, parsedValue: trimmed }
    }

    if (field === 'valor_usd' || field === 'valor_brl') {
      if (!trimmed) {
        return { valid: true, parsedValue: 0 }
      }
      // Substitui vírgula por ponto para parsing
      const normalized = trimmed.replace(/\./g, '').replace(',', '.')
      const num = parseFloat(normalized)
      if (isNaN(num)) {
        return { valid: false, error: 'Valor numérico inválido.' }
      }
      if (num < 0) {
        return { valid: false, error: 'O valor não pode ser negativo.' }
      }
      return { valid: true, parsedValue: Math.round(num * 100) / 100 }
    }

    if (field === 'quantidade') {
      if (!trimmed) {
        return { valid: true, parsedValue: 0 }
      }
      const num = parseFloat(trimmed.replace(',', '.'))
      if (isNaN(num)) {
        return { valid: false, error: 'Quantidade numérica inválida.' }
      }
      if (num < 0) {
        return { valid: false, error: 'Quantidade não pode ser negativa.' }
      }
      return { valid: true, parsedValue: num }
    }

    if (field === 'nf_ano') {
      if (!trimmed) {
        return { valid: true, parsedValue: 0 }
      }
      const num = parseInt(trimmed, 10)
      if (isNaN(num) || num < 0) {
        return { valid: false, error: 'Número de NF inválido.' }
      }
      return { valid: true, parsedValue: num }
    }

    return { valid: true, parsedValue: trimmed }
  }

  // Confirmar e salvar alteração
  const saveCell = async (
    record: FaturamentoRecord,
    field: EditableField,
    overrideValue?: string,
  ) => {
    const valToSave = overrideValue !== undefined ? overrideValue : cellValue
    const validation = validateValue(field, valToSave)

    if (!validation.valid) {
      setCellError({
        id: record.id,
        field,
        message: validation.error || 'Valor inválido.',
      })
      toast.error(validation.error || 'Valor inválido.')
      return
    }

    const payload: Partial<Omit<FaturamentoRecord, 'id' | 'created' | 'updated'>> = {}
    if (field === 'data_documento') {
      payload.data_documento = String(validation.parsedValue)
      // Ajusta mes, ano e semestre automaticamente
      const d = new Date(String(validation.parsedValue))
      if (!isNaN(d.getTime())) {
        payload.ano = d.getUTCFullYear()
        payload.mes = d.getUTCMonth() + 1
        payload.semestre = payload.mes <= 6 ? 'S1' : 'S2'
      }
    } else if (field === 'cliente_nome') {
      payload.cliente_nome = String(validation.parsedValue)
    } else if (field === 'produto_descricao') {
      payload.produto_descricao = String(validation.parsedValue)
    } else if (field === 'familia_produto') {
      payload.familia_produto = String(validation.parsedValue)
    } else if (field === 'quantidade') {
      payload.quantidade = Number(validation.parsedValue)
    } else if (field === 'valor_usd') {
      payload.valor_usd = Number(validation.parsedValue)
    } else if (field === 'valor_brl') {
      payload.valor_brl = Number(validation.parsedValue)
    } else if (field === 'vendedor') {
      payload.vendedor = String(validation.parsedValue)
    } else if (field === 'country') {
      payload.country = String(validation.parsedValue)
    } else if (field === 'nf_ano') {
      payload.nf_ano = Number(validation.parsedValue)
    }

    const saveKey = `${record.id}-${field}`
    setSavingId(saveKey)
    setCellError(null)

    try {
      const updated = await updateFaturamento(record.id, payload)
      setActiveCell(null)
      setCellValue('')
      if (onRecordUpdated) {
        onRecordUpdated(updated)
      }
      // Sucesso silencioso para experiência fluida sem spam de toasts, feedback visual direto na célula
    } catch {
      setCellError({
        id: record.id,
        field,
        message: 'Falha ao salvar a alteração.',
      })
      toast.error('Falha ao salvar a alteração.', {
        action: {
          label: 'Tentar novamente',
          onClick: () => saveCell(record, field, valToSave),
        },
      })
    } finally {
      setSavingId(null)
    }
  }

  const formatCurrency = (val?: number, currency: 'USD' | 'BRL' = 'BRL') => {
    if (val === undefined || val === null || isNaN(val)) return '—'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(val)
  }

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '—'
    const clean = dateStr.split('T')[0]
    const parts = clean.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  }

  return (
    <Card className="shadow-subtle border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-primary" />
              Base de Faturamento (Edição Inline)
              {records.length > 0 && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {records.length} {records.length === 1 ? 'registro' : 'registros'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Todos os campos são editáveis diretamente na grade. As alterações são sincronizadas no
              banco imediatamente.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-52">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={selectedFamilia} onValueChange={setSelectedFamilia}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Todas as famílias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as Famílias
                </SelectItem>
                {FAMILIAS_PRODUTO_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              title="Recarregar registros"
              className="h-8 px-2.5 text-xs gap-1"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recarregar</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading && records.length === 0 ? (
          <div className="space-y-2 py-4">
            <div className="h-9 w-full bg-muted/60 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/40 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/30 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/20 animate-pulse rounded" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 text-center bg-muted/10">
            <TableIcon className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {searchTerm || selectedFamilia !== 'all'
                ? 'Nenhum registro encontrado para estes filtros.'
                : 'Nenhum registro de faturamento cadastrado ainda.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Importe sua planilha de faturamento acima para visualizar e editar os dados nesta
              grade interativa.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12 text-center text-xs">#</TableHead>
                  <TableHead className="w-[110px] text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Data
                    </span>
                  </TableHead>
                  <TableHead className="w-[85px] text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-muted-foreground" /> NF
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[170px] text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Cliente
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[160px] text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-muted-foreground" /> Produto
                    </span>
                  </TableHead>
                  <TableHead className="w-[140px] text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-muted-foreground" /> Família
                    </span>
                  </TableHead>
                  <TableHead className="w-[85px] text-right text-xs font-semibold">Qtd</TableHead>
                  <TableHead className="w-[120px] text-right text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <DollarSign className="w-3.5 h-3.5" /> USD ($)
                    </span>
                  </TableHead>
                  <TableHead className="w-[120px] text-right text-xs font-semibold text-primary">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <DollarSign className="w-3.5 h-3.5" /> BRL (R$)
                    </span>
                  </TableHead>
                  <TableHead className="w-[130px] text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-muted-foreground" /> Vendedor
                    </span>
                  </TableHead>
                  <TableHead className="w-[70px] text-center text-xs font-semibold">
                    <span className="flex items-center justify-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" /> País
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r, index) => {
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/20 text-xs">
                      {/* Índice */}
                      <TableCell className="text-center font-mono text-muted-foreground text-[11px]">
                        {index + 1}
                      </TableCell>

                      {/* DATA DOCUMENTO */}
                      <TableCell
                        onClick={() => startEditing(r, 'data_documento')}
                        className="cursor-pointer font-mono hover:bg-primary/5 transition-colors p-1.5"
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'data_documento' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="date"
                              value={cellValue}
                              autoFocus
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'data_documento')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-1.5 font-mono"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600 hover:text-emerald-700"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'data_documento')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelEditing()
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span>{formatDateDisplay(r.data_documento)}</span>
                            {savingId === `${r.id}-data_documento` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* NF / DOCUMENTO */}
                      <TableCell
                        onClick={() => startEditing(r, 'nf_ano')}
                        className="cursor-pointer font-mono text-muted-foreground hover:bg-primary/5 transition-colors p-1.5"
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'nf_ano' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={cellValue}
                              autoFocus
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'nf_ano')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-1.5 font-mono w-20"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'nf_ano')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span>{r.nf_ano || '—'}</span>
                            {savingId === `${r.id}-nf_ano` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* CLIENTE */}
                      <TableCell
                        onClick={() => startEditing(r, 'cliente_nome')}
                        className="cursor-pointer font-medium hover:bg-primary/5 transition-colors p-1.5 max-w-[200px]"
                        title={r.cliente_nome}
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'cliente_nome' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={cellValue}
                              autoFocus
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'cliente_nome')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-2"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'cliente_nome')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelEditing()
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="truncate">{r.cliente_nome || '—'}</span>
                            {savingId === `${r.id}-cliente_nome` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1 shrink-0" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* PRODUTO */}
                      <TableCell
                        onClick={() => startEditing(r, 'produto_descricao')}
                        className="cursor-pointer hover:bg-primary/5 transition-colors p-1.5 max-w-[180px]"
                        title={r.produto_descricao}
                      >
                        {activeCell?.recordId === r.id &&
                        activeCell?.field === 'produto_descricao' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={cellValue}
                              autoFocus
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'produto_descricao')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-2"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'produto_descricao')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="truncate">{r.produto_descricao || '—'}</span>
                            {savingId === `${r.id}-produto_descricao` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1 shrink-0" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* FAMÍLIA PRODUTO */}
                      <TableCell
                        onClick={() => startEditing(r, 'familia_produto')}
                        className="cursor-pointer hover:bg-primary/5 transition-colors p-1.5"
                      >
                        {activeCell?.recordId === r.id &&
                        activeCell?.field === 'familia_produto' ? (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Select
                              value={cellValue}
                              onValueChange={(val) => {
                                setCellValue(val)
                                saveCell(r, 'familia_produto', val)
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[140px]">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {FAMILIAS_PRODUTO_OPTIONS.map((fam) => (
                                  <SelectItem key={fam} value={fam} className="text-xs">
                                    {fam}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground"
                              onClick={() => cancelEditing()}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {r.familia_produto || '—'}
                            </Badge>
                            {savingId === `${r.id}-familia_produto` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* QUANTIDADE */}
                      <TableCell
                        onClick={() => startEditing(r, 'quantidade')}
                        className="cursor-pointer text-right font-mono hover:bg-primary/5 transition-colors p-1.5"
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'quantidade' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="any"
                              value={cellValue}
                              autoFocus
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'quantidade')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-1.5 font-mono w-20 text-right"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'quantidade')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <span>
                              {r.quantidade !== undefined && r.quantidade !== null
                                ? r.quantidade.toLocaleString('pt-BR')
                                : '—'}
                            </span>
                            {savingId === `${r.id}-quantidade` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* VALOR USD */}
                      <TableCell
                        onClick={() => startEditing(r, 'valor_usd')}
                        className="cursor-pointer text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-primary/5 transition-colors p-1.5 whitespace-nowrap"
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'valor_usd' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="text"
                              value={cellValue}
                              autoFocus
                              placeholder="0,00"
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'valor_usd')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-1.5 font-mono w-24 text-right"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'valor_usd')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <span>{formatCurrency(r.valor_usd, 'USD')}</span>
                            {savingId === `${r.id}-valor_usd` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* VALOR BRL */}
                      <TableCell
                        onClick={() => startEditing(r, 'valor_brl')}
                        className="cursor-pointer text-right font-mono font-semibold text-primary hover:bg-primary/5 transition-colors p-1.5 whitespace-nowrap"
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'valor_brl' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="text"
                              value={cellValue}
                              autoFocus
                              placeholder="0,00"
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'valor_brl')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-1.5 font-mono w-24 text-right"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'valor_brl')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <span>{formatCurrency(r.valor_brl, 'BRL')}</span>
                            {savingId === `${r.id}-valor_brl` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* VENDEDOR */}
                      <TableCell
                        onClick={() => startEditing(r, 'vendedor')}
                        className="cursor-pointer text-muted-foreground hover:bg-primary/5 transition-colors p-1.5 max-w-[130px]"
                        title={r.vendedor}
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'vendedor' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={cellValue}
                              autoFocus
                              onChange={(e) => setCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCell(r, 'vendedor')
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="h-7 text-xs px-2"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                saveCell(r, 'vendedor')
                              }}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="truncate">{r.vendedor || '—'}</span>
                            {savingId === `${r.id}-vendedor` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1 shrink-0" />
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* PAÍS */}
                      <TableCell
                        onClick={() => startEditing(r, 'country')}
                        className="cursor-pointer text-center font-mono hover:bg-primary/5 transition-colors p-1.5"
                      >
                        {activeCell?.recordId === r.id && activeCell?.field === 'country' ? (
                          <div
                            className="flex items-center justify-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Select
                              value={cellValue}
                              onValueChange={(val) => {
                                setCellValue(val)
                                saveCell(r, 'country', val)
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[65px] px-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BR" className="text-xs">
                                  BR
                                </SelectItem>
                                <SelectItem value="PY" className="text-xs">
                                  PY
                                </SelectItem>
                                <SelectItem value="CL" className="text-xs">
                                  CL
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">
                              {r.country || 'BR'}
                            </Badge>
                            {savingId === `${r.id}-country` && (
                              <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {cellError && (
          <div className="flex items-center justify-between gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 mt-2">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cellError.message}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rec = records.find((x) => x.id === cellError.id)
                if (rec) {
                  saveCell(rec, cellError.field)
                }
              }}
              className="h-6 text-[11px] px-2 border-destructive/40 hover:bg-destructive/10 text-destructive"
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
