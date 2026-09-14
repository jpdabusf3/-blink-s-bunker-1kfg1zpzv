import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Download,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  autoSuggestMapping,
  parseFaturamentoPreview,
  importFaturamento,
  downloadFaturamentoTemplate,
  type FaturamentoImportResult,
} from '@/services/import-faturamento'

interface ImportarFaturamentoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ImportarFaturamentoDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportarFaturamentoDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [progressValue, setProgressValue] = useState(0)
  const [result, setResult] = useState<FaturamentoImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setLoading(false)
    setProgressText('')
    setProgressValue(0)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      toast({
        title: 'Formato inválido',
        description: 'Apenas arquivos .xlsx, .xls ou .csv são suportados.',
        variant: 'destructive',
      })
      return
    }

    if (selected.size > 20 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 20MB.',
        variant: 'destructive',
      })
      return
    }

    setFile(selected)
    setError(null)
    setResult(null)
  }

  const handleImport = async () => {
    if (!file) {
      toast({
        title: 'Selecione um arquivo',
        description: 'Escolha uma planilha CSV ou Excel para continuar.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setError(null)
    setProgressValue(15)
    setProgressText('Lendo estrutura da planilha...')

    try {
      // 1. Ler cabeçalhos da planilha e auto-mapear
      const { headers } = await parseFaturamentoPreview(file, 5)
      const mapping = autoSuggestMapping(headers)

      setProgressValue(45)
      setProgressText('Importando registros e validando duplicidades...')

      // 2. Chamar o serviço de importação
      const res = await importFaturamento(file, mapping, {
        criarClienteNaoEncontrado: true,
      })

      setProgressValue(100)
      setProgressText('Importação concluída!')
      setResult(res)

      const totalImportados =
        res.imported !== undefined
          ? res.imported
          : res.faturamentoImportados !== undefined
            ? res.faturamentoImportados
            : res.criados
      const totalDuplicados =
        res.skipped_duplicates !== undefined
          ? res.skipped_duplicates
          : res.faturamentoDuplicatas !== undefined
            ? res.faturamentoDuplicatas
            : res.duplicatasIgnoradas

      toast({
        title: 'Importação concluída',
        description: `Importação concluída: ${totalImportados} registros, ${totalDuplicados} duplicados ignorados.`,
      })

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar planilha'
      setError(msg)
      toast({
        title: 'Erro ao importar faturamento',
        description: 'Erro ao importar faturamento. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const totalImportados =
    result?.imported !== undefined
      ? result.imported
      : result?.faturamentoImportados !== undefined
        ? result.faturamentoImportados
        : result?.criados || 0
  const totalDuplicados =
    result?.skipped_duplicates !== undefined
      ? result.skipped_duplicates
      : result?.faturamentoDuplicatas !== undefined
        ? result.faturamentoDuplicatas
        : result?.duplicatasIgnoradas || 0

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar Faturamento
          </DialogTitle>
          <DialogDescription>
            Importe planilhas de faturamento e vendas (.xlsx, .xls ou .csv) diretamente para o CRM.
          </DialogDescription>
        </DialogHeader>

        {!result && !loading && (
          <div className="space-y-4 pt-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-all group"
            >
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground group-hover:text-primary transition-colors mb-2" />
              <p className="text-sm font-semibold text-foreground">
                {file ? file.name : 'Clique ou arraste a planilha aqui para importar'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Suporta planilhas .xlsx, .xls ou .csv (até 20MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">
                Deduplicação automática por data, cliente, produto e valor
              </span>
              <Button
                variant="link"
                size="sm"
                className="gap-1 p-0 h-auto text-xs"
                onClick={downloadFaturamentoTemplate}
              >
                <Download className="w-3.5 h-3.5" /> Baixar Modelo
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button onClick={handleImport} disabled={!file} className="w-full gap-2">
              <Upload className="w-4 h-4" /> Iniciar Importação
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="w-full max-w-xs space-y-2 text-center">
              <p className="text-sm font-medium text-foreground">{progressText}</p>
              <Progress value={progressValue} className="h-2" />
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-900/40">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {totalImportados}
                </p>
                <p className="text-xs text-muted-foreground">Registros Importados</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-900/40">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {totalDuplicados}
                </p>
                <p className="text-xs text-muted-foreground">Duplicados Ignorados</p>
              </div>
            </div>

            {result.erros && result.erros.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  Erros identificados ({result.erros.length}):
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {result.erros.slice(0, 10).map((err, idx) => (
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
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1 gap-2">
                <RotateCcw className="w-4 h-4" /> Nova Importação
              </Button>
              <Button
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
                className="flex-1 gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
