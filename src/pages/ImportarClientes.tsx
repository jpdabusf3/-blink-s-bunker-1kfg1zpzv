import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Download,
  ArrowLeft,
  Copy,
} from 'lucide-react'
import {
  importExcel,
  parseExcelPreview,
  downloadImportTemplate,
  type ImportResult,
} from '@/services/import-excel'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

const TEMPLATE_HEADERS = [
  'Nome',
  'CNPJ',
  'Espécie',
  'Cidade',
  'Estado',
  'Contato',
  'Status Contato',
  'Funil',
  'Valor',
  'Gestor',
  'Vendedor',
]

export default function ImportarClientes() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setPreview([])
    setLoading(false)
    setResult(null)
    setError(null)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      toast.error('Apenas arquivos .xlsx, .xls ou .csv são suportados')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 10MB)')
      return
    }
    setFile(selected)
    setResult(null)
    setError(null)
    setLoading(true)
    try {
      const rows = await parseExcelPreview(selected, 10)
      setPreview(rows)
      if (rows.length === 0) {
        toast.warning('Nenhuma linha encontrada na planilha')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler arquivo'
      setError(msg)
      toast.error(msg)
      setPreview([])
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const res = await importExcel(file)
      setResult(res)
      if (res.success) {
        toast.success(
          `Importação concluída: ${res.criados} criados, ${res.duplicatas ?? 0} duplicatas ignoradas`,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar arquivo'
      setError(msg)
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  const previewHeaders = preview.length > 0 ? Object.keys(preview[0]) : []

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Upload className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Importar Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Importe clientes em lote via planilha Excel (.xlsx).
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link to="/cadastro">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={downloadImportTemplate}>
            <Download className="w-4 h-4" /> Baixar Modelo
          </Button>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>1. Selecione o arquivo</CardTitle>
          <CardDescription>
            Envie uma planilha .xlsx com os cabeçalhos esperados. Use o botão "Baixar Modelo" para
            obter um arquivo de exemplo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
          >
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {file ? file.name : 'Clique para selecionar um arquivo'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls ou .csv (máx. 10MB)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Cabeçalhos esperados:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_HEADERS.map((h) => (
                  <code
                    key={h}
                    className="text-[11px] px-2 py-0.5 rounded bg-background border font-mono"
                  >
                    {h}
                  </code>
                ))}
              </div>
            </div>

            <div className="border-t pt-2.5 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                Colunas com opções válidas predefinidas (validação suspensa no modelo):
              </p>
              <p>
                <strong className="text-foreground">Espécie (Coluna C):</strong> Aves, Suinos,
                Ruminantes, Pet, Multiespécies
              </p>
              <p>
                <strong className="text-foreground">Status Contato (Coluna G):</strong> Champion,
                Stakeholder, Decisor, Influenciador, Gatekeepers
              </p>
              <p>
                <strong className="text-foreground">Funil (Coluna H):</strong> Lead, Primeiro
                Contato, Diagnóstico Técnico, Apresentação, Teste/Trial, Proposta, Negociação,
                Fechamento, Pós-venda, Perda
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {file && preview.length > 0 && !result && (
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              2. Pré-visualização
              <span className="text-sm font-normal text-muted-foreground">
                (primeiras {preview.length} linhas)
              </span>
            </CardTitle>
            <CardDescription>
              Confira os dados antes de confirmar a importação. A importação processa todas as
              linhas do arquivo, não apenas as exibidas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {previewHeaders.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      {previewHeaders.map((h) => (
                        <TableCell
                          key={h}
                          className="text-xs whitespace-nowrap max-w-[180px] truncate"
                        >
                          {String(row[h] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={reset} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Limpar
              </Button>
              <Button onClick={handleImport} disabled={importing} className="gap-2">
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirmar Importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Lendo arquivo...</p>
        </div>
      )}

      {importing && !result && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Processando importação...</p>
        </div>
      )}

      {/* Result report */}
      {result && (
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>3. Relatório de Importação</CardTitle>
            <CardDescription>Resultado do processamento da planilha.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total de linhas</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-emerald-600">{result.criados}</p>
                <p className="text-xs text-muted-foreground">Clientes inseridos</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-amber-600">{result.duplicatas ?? 0}</p>
                <p className="text-xs text-muted-foreground">Duplicatas ignoradas</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">{result.atualizados}</p>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-rose-600">{result.erros.length}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {result.erros.length > 0 && (
              <div className="max-h-72 overflow-y-auto space-y-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Linhas com erro ({result.erros.length}):
                </p>
                {result.erros.map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs bg-destructive/5 p-2 rounded-md"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <span>
                      <strong>Linha {err.linha}:</strong> {err.erro}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1 gap-2">
                <RotateCcw className="w-4 h-4" /> Nova Importação
              </Button>
              <Button asChild className="flex-1 gap-2">
                <Link to="/cadastro">
                  <Copy className="w-4 h-4" /> Ver Clientes
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
