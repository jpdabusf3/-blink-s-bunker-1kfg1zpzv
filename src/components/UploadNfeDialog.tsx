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
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import {
  extrairTextoPdf,
  processarNfePdfs,
  type ProcessarNfeResponse,
} from '@/services/nfe-service'
import { uploadPedido, downloadPedidoModel } from '@/services/historico-vendas'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface UploadNfeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onOpenReviewQueue?: () => void
}

export function UploadNfeDialog({
  open,
  onOpenChange,
  onSuccess,
  onOpenReviewQueue,
}: UploadNfeDialogProps) {
  const [activeTab, setActiveTab] = useState<'nfe' | 'excel'>('nfe')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [response, setResponse] = useState<ProcessarNfeResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Excel fallback state
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelLoading, setExcelLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFiles([])
    setLoading(false)
    setCurrentStep('')
    setResponse(null)
    setErrorMsg(null)
    setExcelFile(null)
    setExcelLoading(false)
  }

  const handleFilesSelected = (newFiles: FileList | null) => {
    if (!newFiles) return
    const valid: File[] = []
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i]
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        if (f.size <= 25 * 1024 * 1024) {
          valid.push(f)
        } else {
          toast.error(`Arquivo ${f.name} ultrapassa o limite de 25MB`)
        }
      } else {
        toast.error(`Arquivo ${f.name} não é um PDF válido`)
      }
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid])
      setErrorMsg(null)
    }
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleProcessNfe = async () => {
    if (files.length === 0) {
      toast.error('Selecione pelo menos um arquivo PDF de nota fiscal')
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      const arquivosExtraidos: Array<{ nome: string; texto: string }> = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentStep(`Lendo texto do PDF (${i + 1}/${files.length}): ${file.name}...`)
        try {
          const texto = await extrairTextoPdf(file)
          arquivosExtraidos.push({
            nome: file.name,
            texto,
          })
        } catch (err) {
          console.error(`Erro ao extrair ${file.name}:`, err)
          arquivosExtraidos.push({
            nome: file.name,
            texto: '',
          })
        }
      }

      setCurrentStep('Analisando dados com IA e validando produtos do catálogo...')
      const res = await processarNfePdfs(arquivosExtraidos)
      setResponse(res)

      if (res.importados > 0) {
        toast.success('Nota fiscal importada para revisão.')
      }

      if (res.duplicadas_ignoradas > 0) {
        const dupResult = res.resultados.find((r) => r.status === 'duplicada_ignorada')
        if (dupResult?.numero_nf) {
          toast.warning(`Nota fiscal ${dupResult.numero_nf} já cadastrada. Importação ignorada.`)
        } else {
          toast.warning(`${res.duplicadas_ignoradas} nota(s) duplicada(s) ignorada(s).`)
        }
      }

      if (res.pendencias_produto > 0) {
        toast.info(
          `${res.pendencias_produto} nota(s) possuem produtos não cadastrados no catálogo e exigem revisão.`,
        )
      }

      if (onSuccess) onSuccess()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Não foi possível ler a nota fiscal. Verifique o arquivo.'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
      setCurrentStep('')
    }
  }

  const handleProcessExcel = async () => {
    if (!excelFile) {
      toast.error('Selecione uma planilha Excel')
      return
    }
    setExcelLoading(true)
    try {
      const res = await uploadPedido(excelFile)
      if (res.success) {
        toast.success(`${res.importados} pedidos importados via planilha!`)
        if (onSuccess) onSuccess()
        resetState()
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar o pedido. Tente novamente.')
    } finally {
      setExcelLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Leitor Automático de Notas Fiscais (PDF)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Importação inteligente com extração de DANFE/NFe (Blink Bioscience), validação de
                catálogo e fila de conferência.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="nfe" className="gap-2">
              <FileText className="w-4 h-4" /> Notas Fiscais (PDF)
            </TabsTrigger>
            <TabsTrigger value="excel" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Modelo Planilha Excel
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: NOTAS FISCAIS EM PDF */}
          <TabsContent value="nfe" className="space-y-4 pt-2">
            {!response && !loading && (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleFilesSelected(e.dataTransfer.files)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-muted/20 hover:bg-muted/40 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">
                      Arraste PDFs de Nota Fiscal aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Suporta upload único ou em lote (ex: NF 322, 323, 324). Máximo 25MB por
                      arquivo.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                </div>

                {/* Lista de arquivos selecionados */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>{files.length} arquivo(s) preparado(s) para leitura</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-destructive hover:text-destructive"
                        onClick={() => setFiles([])}
                      >
                        Limpar todos
                      </Button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium truncate">{f.name}</span>
                            <span className="text-muted-foreground text-[10px]">
                              ({(f.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(i)
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Destaque das regras de negócio */}
                <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1 border">
                  <p className="font-medium text-foreground flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-primary" /> O que é extraído e validado:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                    <li>
                      <strong>Número da NF e Data de Emissão</strong>
                    </li>
                    <li>
                      <strong>Dados do Cliente:</strong> Razão Social, CNPJ/CPF, Endereço de entrega
                    </li>
                    <li>
                      <strong>Produtos:</strong> Código, Nome, Quantidade, Valor Unitário e Total
                    </li>
                    <li>
                      <strong>Impostos & Frete:</strong> ICMS, PIS, COFINS, Modalidade FOB/CIF
                    </li>
                    <li>
                      <strong>Validação Inteligente:</strong> Produtos não encontrados no catálogo e
                      duplicatas são destacados para sua conferência na Fila de Revisão.
                    </li>
                  </ul>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleProcessNfe}
                    disabled={files.length === 0}
                    className="gap-2 min-w-[140px]"
                  >
                    <Sparkles className="w-4 h-4" /> Processar{' '}
                    {files.length > 0 && `(${files.length})`}
                  </Button>
                </div>
              </>
            )}

            {/* LOADING STATE */}
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div className="p-4 rounded-full bg-primary/10 text-primary animate-pulse">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <Loader2 className="w-6 h-6 animate-spin text-primary absolute -bottom-1 -right-1" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="font-semibold text-base">Lendo e Estruturando Nota Fiscal</h4>
                  <p className="text-xs text-muted-foreground">{currentStep || 'Processando...'}</p>
                </div>
              </div>
            )}

            {/* RESULT STATE */}
            {response && !loading && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {response.pendentes_revisao}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Prontos p/ Revisão</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {response.pendencias_produto}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Pendência de Produto</p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800/50 border rounded-xl p-3">
                    <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                      {response.duplicadas_ignoradas}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Duplicadas Ignoradas</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Detalhes do processamento:
                  </p>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {response.resultados.map((r, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 ${
                          r.status === 'duplicada_ignorada'
                            ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200'
                            : r.status === 'pendencia_produto'
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/40'
                              : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {r.status === 'duplicada_ignorada' ? (
                              <Badge variant="outline" className="text-[10px]">
                                Duplicada
                              </Badge>
                            ) : r.status === 'pendencia_produto' ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-100 text-amber-800 border-amber-300"
                              >
                                Pendência de Produto
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300"
                              >
                                Pronto
                              </Badge>
                            )}
                            <span className="font-semibold">
                              {r.numero_nf ? `NF ${r.numero_nf}` : r.arquivo}
                            </span>
                          </div>
                          {r.valor ? (
                            <span className="font-bold text-primary">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(r.valor)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground">{r.cliente || r.arquivo}</p>
                        {r.motivo_pendencia && (
                          <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] bg-amber-100/50 dark:bg-amber-950/40 p-2 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{r.motivo_pendencia}</span>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground italic">{r.mensagem}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={resetState} className="flex-1">
                    Nova Importação
                  </Button>
                  <Button
                    onClick={() => {
                      onOpenChange(false)
                      if (onOpenReviewQueue) onOpenReviewQueue()
                    }}
                    className="flex-1 gap-2 bg-primary"
                  >
                    <Layers className="w-4 h-4" /> Abrir Fila de Revisão
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: MODELO EXCEL */}
          <TabsContent value="excel" className="space-y-4 pt-2">
            <div
              onClick={() => excelInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer bg-muted/10 hover:bg-muted/20 transition-all flex flex-col items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                {excelFile ? excelFile.name : 'Selecione uma planilha de pedidos (.xlsx ou .csv)'}
              </p>
              <p className="text-xs text-muted-foreground">Importação direta em lote</p>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex justify-between items-center text-xs">
              <Button
                variant="link"
                size="sm"
                onClick={downloadPedidoModel}
                className="gap-1.5 p-0 h-auto"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Baixar modelo de planilha
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleProcessExcel}
                disabled={!excelFile || excelLoading}
                className="gap-2"
              >
                {excelLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Importar Planilha
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
