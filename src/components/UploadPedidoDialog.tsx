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
import { uploadPedido, type UploadPedidoResult } from '@/services/historico-vendas'
import { toast } from 'sonner'

interface UploadPedidoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function UploadPedidoDialog({ open, onOpenChange, onImported }: UploadPedidoDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadPedidoResult | null>(null)
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
    if (selected.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 10MB)')
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
      const res = await uploadPedido(file)
      setResult(res)
      if (res.success) {
        toast.success(`${res.importados} pedidos importados, ${res.erros.length} com erro`)
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
          <DialogTitle>Upload de Pedido</DialogTitle>
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
              <p className="text-xs text-muted-foreground mt-1">.xlsx ou .csv (máx. 10MB)</p>
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
            <p className="text-sm text-muted-foreground">Processando arquivo...</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-emerald-600">{result.importados}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-rose-600">{result.erros.length}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {result.erros.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
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
