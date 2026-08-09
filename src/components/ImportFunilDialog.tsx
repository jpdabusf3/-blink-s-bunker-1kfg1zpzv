import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { importFunil, type FunilImportResult } from '@/services/import-funil'
import { toast } from 'sonner'

interface ImportFunilDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function ImportFunilDialog({ open, onOpenChange, onImported }: ImportFunilDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FunilImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setLoading(false)
    setResult(null)
    setError(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'csv') {
      toast.error('Apenas arquivos .xlsx ou .csv são suportados')
      return
    }
    if (selected.size > 50 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 50MB)')
      return
    }
    setFile(selected)
    setResult(null)
    setError(null)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await importFunil(file)
      setResult(res)
      if (res.success) {
        toast.success(
          `${res.criados} criados, ${res.atualizados} atualizados, ${res.descartados} descartados`,
        )
        onImported()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar arquivo'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

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
          <DialogTitle>Importar Funil de Vendas (Excel)</DialogTitle>
        </DialogHeader>

        {!result && !loading && (
          <div className="space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {file ? file.name : 'Clique para selecionar um arquivo'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx ou .csv (máx. 50MB)</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
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
            <Button onClick={handleImport} disabled={!file} className="w-full gap-2">
              <Upload className="w-4 h-4" /> Importar
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Processando arquivo... (pode levar alguns minutos)
            </p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-emerald-600">{result.criados}</p>
                <p className="text-xs text-muted-foreground">Únicos Importados</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">{result.atualizados}</p>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-amber-600">{result.descartados}</p>
                <p className="text-xs text-muted-foreground">Descartados</p>
              </div>
            </div>

            {result.erros.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">Erros:</p>
                {result.erros.slice(0, 20).map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs bg-destructive/5 p-2 rounded-md"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <span>
                      <strong>{err.cliente}:</strong> {err.erro}
                    </span>
                  </div>
                ))}
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
