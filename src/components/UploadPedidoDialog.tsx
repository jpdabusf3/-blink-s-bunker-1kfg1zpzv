import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Download,
} from 'lucide-react'
import {
  uploadPedidoPdf,
  uploadPedido,
  downloadPedidoModel,
  type UploadPedidoResult,
} from '@/services/historico-vendas'
import { toast } from 'sonner'

/**
 * Extract plain text from a PDF file in the browser. Tries pdf.js (if available)
 * and falls back to reading raw text streams so the upload flow still works
 * when pdfjs-dist is not installed.
 */
async function extractPdfText(file: File): Promise<string> {
  // Preferred path: pdfjs-dist (lazy import keeps it optional at bundle time).
  try {
    const pdfjsModule = 'pdfjs-dist/build/pdf.mjs'
    const pdfjs: any = await import(/* @vite-ignore */ pdfjsModule)
    if (pdfjs?.getDocument) {
      const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      const arrayBuffer = await file.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise
      const pages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map((it: any) => it.str).join(' '))
      }
      return pages.join('\n')
    }
  } catch (_) {
    /* fall through to raw extraction */
  }

  // Fallback: extract readable text directly from the PDF byte stream.
  // PDFs store text between parentheses inside content streams (BT...ET).
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let raw = ''
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    if ((c >= 32 && c <= 126) || c === 10 || c === 13) raw += String.fromCharCode(c)
  }
  const matches = raw.match(/\(([^()]*)\)/g) || []
  return matches.map((m) => m.slice(1, -1)).join(' ')
}

interface UploadPedidoDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onImported: () => void
  children?: React.ReactNode
}

type Mode = 'excel' | 'pdf'

export function UploadPedidoDialog({
  open,
  onOpenChange,
  onImported,
  children,
}: UploadPedidoDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [mode, setMode] = useState<Mode>('pdf')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<
    (UploadPedidoResult & { campos_ausentes?: string[] }) | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setPdfFile(null)
    setExcelFile(null)
    setLoading(false)
    setResult(null)
    setError(null)
  }

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF válido')
      return
    }
    if (selected.size > 20 * 1024 * 1024) {
      toast.error('PDF muito grande (máximo 20MB)')
      return
    }
    setPdfFile(selected)
    setError(null)
  }

  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setExcelFile(selected)
    setError(null)
  }

  const handleImport = async () => {
    setLoading(true)
    setError(null)
    try {
      let res: UploadPedidoResult & { campos_ausentes?: string[] }
      if (mode === 'pdf') {
        if (!pdfFile) {
          toast.error('Selecione um PDF de nota fiscal')
          setLoading(false)
          return
        }
        // Extract text from PDF client-side using pdf.js (loaded dynamically).
        let pdfText = ''
        try {
          pdfText = await extractPdfText(pdfFile)
        } catch (extractErr) {
          throw new Error(
            'Não foi possível extrair texto do PDF. Verifique o arquivo ou use o modelo Excel.',
          )
        }

        let rows: Record<string, unknown>[] = []
        if (excelFile) {
          const XLSX = await import('xlsx')
          const arrayBuffer = await excelFile.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          if (sheetName) {
            rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
              defval: '',
            })
          }
        }
        res = await uploadPedidoPdf(pdfText, rows)
      } else {
        if (!excelFile) {
          toast.error('Selecione um arquivo Excel/CSV')
          setLoading(false)
          return
        }
        res = await uploadPedido(excelFile)
      }
      setResult(res)
      if (res.success) {
        toast.success(`${res.importados} pedidos importados, ${res.erros.length} com erro`)
        if (res.campos_ausentes && res.campos_ausentes.length > 0) {
          toast.warning(`Campos ausentes no PDF: ${res.campos_ausentes.join(', ')}`)
        }
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

  const trigger = children ? <span onClick={() => setOpen(true)}>{children}</span> : null

  return (
    <>
      {trigger}
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          if (!v) reset()
          setOpen(v)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Implantação de Novos Pedidos</DialogTitle>
            <DialogDescription>
              Faça upload do PDF da nota fiscal para extração automática por IA. Opcionalmente,
              anexe um modelo Excel com dados complementares.
            </DialogDescription>
          </DialogHeader>

          {!result && !loading && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={mode === 'pdf' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('pdf')}
                  className="gap-2 flex-1"
                >
                  <FileText className="w-4 h-4" /> PDF + Excel
                </Button>
                <Button
                  variant={mode === 'excel' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('excel')}
                  className="gap-2 flex-1"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Apenas Excel
                </Button>
              </div>

              {mode === 'pdf' && (
                <>
                  <div
                    onClick={() => pdfInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                  >
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      {pdfFile ? pdfFile.name : 'Selecione o PDF da Nota Fiscal'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">.pdf (máx. 20MB)</p>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handlePdfSelect}
                      className="hidden"
                    />
                  </div>

                  <div
                    onClick={() => excelInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                  >
                    <FileSpreadsheet className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs font-medium">
                      {excelFile
                        ? excelFile.name
                        : 'Modelo Excel (opcional — dados complementares)'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">.xlsx ou .csv</p>
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleExcelSelect}
                      className="hidden"
                    />
                  </div>

                  <div className="flex justify-center">
                    <Button
                      variant="link"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => downloadPedidoModel()}
                    >
                      <Download className="w-3 h-3" /> Baixar modelo Excel
                    </Button>
                  </div>
                </>
              )}

              {mode === 'excel' && (
                <div
                  onClick={() => excelInputRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                >
                  <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {excelFile ? excelFile.name : 'Clique para selecionar um arquivo'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx ou .csv (máx. 10MB)</p>
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleExcelSelect}
                    className="hidden"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <Button
                onClick={handleImport}
                disabled={mode === 'pdf' ? !pdfFile : !excelFile}
                className="w-full gap-2"
              >
                <Upload className="w-4 h-4" /> Importar
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Processando{mode === 'pdf' ? ' PDF com IA' : ' arquivo'}...
              </p>
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

              {result.campos_ausentes && result.campos_ausentes.length > 0 && (
                <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 p-3 rounded-md">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Campos ausentes no PDF:</p>
                    <p>{result.campos_ausentes.join(', ')}</p>
                    <p className="mt-1">Preencha via modelo Excel e reenvie.</p>
                  </div>
                </div>
              )}

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
                    setOpen(false)
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
    </>
  )
}
