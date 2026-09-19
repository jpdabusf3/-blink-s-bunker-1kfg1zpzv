import { useState, useEffect } from 'react'
import {
  getDocuments,
  createDocument,
  deleteDocument,
  downloadDocument,
  type DocumentItem,
} from '@/services/documents'
import { useAuth } from '@/hooks/use-auth'
import { isManager, isSuperAdmin } from '@/lib/user-scope'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Search,
  Loader2,
  FolderOpen,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  uploadMaestroFile,
  extractFileContentLocally,
  analyzeMaestroFile,
  executeImportMatrizVenda,
  executeImportPedidosCarteira,
  executeImportRelatorioVendasSemanal,
  executeImportAtendimentoPedidos,
  type MaestroAnalysisResult,
  type ExecutionResult,
} from '@/services/maestro-analyze-service'

const CATEGORIES = ['Diretrizes', 'Políticas', 'Relatórios', 'Contratos', 'Apresentações', 'Outros']
const ACCESS_LEVELS = ['CEO', 'Diretor', 'Gestor', 'Gerente', 'Manager', 'Vendedor', 'Comum']

export default function Documents() {
  const { user } = useAuth()
  const canManage = isManager(user) || isSuperAdmin(user)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Diretrizes')
  const [accessLevel, setAccessLevel] = useState('Comum')
  const [file, setFile] = useState<File | null>(null)

  // Estados da importação de relatórios PDF Blink
  const [importReportOpen, setImportReportOpen] = useState(false)
  const [reportFile, setReportFile] = useState<File | null>(null)
  const [analyzingReport, setAnalyzingReport] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<MaestroAnalysisResult | null>(null)
  const [executingImport, setExecutingImport] = useState(false)
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)

  const loadDocuments = async () => {
    try {
      const data = await getDocuments()
      setDocuments(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  useRealtime('documents', () => {
    loadDocuments()
  })

  const filtered = documents.filter((d) => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const handleUpload = async () => {
    if (!file || !title) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('category', category)
      formData.append('min_access_level', accessLevel)
      formData.append('file', file)
      await createDocument(formData)
      toast({ title: 'Documento enviado', description: 'Arquivo adicionado com sucesso.' })
      setUploadOpen(false)
      setTitle('')
      setFile(null)
      loadDocuments()
    } catch {
      toast({ title: 'Erro', description: 'Falha ao enviar documento.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id)
      toast({ title: 'Documento excluído' })
      loadDocuments()
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <FolderOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
            <p className="text-muted-foreground text-sm">
              Repositório de diretrizes e arquivos estratégicos.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setReportFile(null)
              setAnalysisResult(null)
              setExecutionResult(null)
              setImportReportOpen(true)
            }}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Relatório PDF
          </Button>
          {canManage && (
            <Button onClick={() => setUploadOpen(true)} className="gap-2">
              <Upload className="w-4 h-4" />
              Enviar Documento
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-subtle">
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhum documento encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <Card key={doc.id} className="shadow-subtle hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="bg-primary/10 p-2 rounded-md shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <p className="font-medium text-sm truncate" title={doc.title}>
                      {doc.title}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {doc.category && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {doc.category}
                    </span>
                  )}
                  {doc.min_access_level && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {doc.min_access_level}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(doc.created).toLocaleDateString('pt-BR')}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => downloadDocument(doc)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </Button>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Importação de Relatórios PDF Oficiais Blink */}
      <Dialog open={importReportOpen} onOpenChange={setImportReportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Importar Relatório Oficial Blink Biotech (PDF)
            </DialogTitle>
          </DialogHeader>

          {!analysisResult && !executionResult && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Selecione um relatório PDF oficial: <strong>Matriz de Venda</strong>,{' '}
                <strong>Pedidos em Carteira</strong> ou <strong>Relatório de Vendas Semanal</strong>
                . Os dados serão reconhecidos automaticamente com prévia antes da gravação no CRM.
              </p>

              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  id="pdf-report-input"
                  accept=".pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const selected = e.target.files?.[0]
                    if (!selected) return
                    setReportFile(selected)
                    setAnalyzingReport(true)
                    try {
                      const uploaded = await uploadMaestroFile(selected)
                      const extracted = await extractFileContentLocally(selected)
                      const analysis = await analyzeMaestroFile({
                        fileId: uploaded.id,
                        file: selected,
                        extractedText: extracted.extractedText,
                        rows: extracted.rows,
                      })

                      if (
                        analysis.document_type !== 'matriz_venda' &&
                        analysis.document_type !== 'pedidos_carteira' &&
                        analysis.document_type !== 'relatorio_vendas_semanal' &&
                        analysis.document_type !== 'atendimento_pedidos'
                      ) {
                        toast({
                          title: 'Formato não identificado',
                          description:
                            'Nenhum pedido identificado no arquivo. Verifique se o formato corresponde ao Atendimento a pedidos, Matriz de Venda ou Relatório Semanal.',
                          variant: 'destructive',
                        })
                      } else if (
                        analysis.document_type === 'atendimento_pedidos' &&
                        (!analysis.data.atendimento_pedidos ||
                          analysis.data.atendimento_pedidos.length === 0)
                      ) {
                        toast({
                          title: 'Arquivo Vazio',
                          description: 'Nenhum pedido identificado no arquivo.',
                          variant: 'destructive',
                        })
                      } else {
                        setAnalysisResult(analysis)
                      }
                    } catch {
                      toast({
                        title: 'Erro na análise',
                        description:
                          'Não foi possível ler o relatório. Verifique se o arquivo é um PDF válido e tente novamente.',
                        variant: 'destructive',
                      })
                    } finally {
                      setAnalyzingReport(false)
                    }
                  }}
                />
                <label
                  htmlFor="pdf-report-input"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {analyzingReport
                      ? 'Analisando relatório...'
                      : reportFile
                        ? reportFile.name
                        : 'Clique para selecionar o relatório PDF'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Aceita: Atendimento a pedidos (carteira) *.pdf, Matriz de venda *.pdf, Pedidos
                    em carteira *.pdf, Relatório de vendas semanal *.pdf
                  </span>
                </label>
              </div>

              {analyzingReport && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  Extraindo hierarquias, meses e valores do documento...
                </div>
              )}
            </div>
          )}

          {/* Prévia e Confirmação */}
          {analysisResult && !executionResult && (
            <div className="space-y-4 pt-2">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary text-sm uppercase tracking-wide">
                    {analysisResult.document_type === 'matriz_venda' &&
                      'Matriz de Venda Identificada'}
                    {analysisResult.document_type === 'pedidos_carteira' &&
                      'Pedidos em Carteira Identificado'}
                    {analysisResult.document_type === 'relatorio_vendas_semanal' &&
                      'Relatório de Vendas Semanal Identificado'}
                    {analysisResult.document_type === 'atendimento_pedidos' &&
                      'Atendimento a Pedidos (Carteira) Identificado'}
                  </span>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    {Math.round(analysisResult.confidence * 100)}% confiança
                  </span>
                </div>
                <p className="text-sm mt-1">{analysisResult.summary}</p>
              </div>

              {/* Avisos específicos para Atendimento a pedidos (ambiguidade de datas, etc.) */}
              {analysisResult.document_type === 'atendimento_pedidos' &&
                analysisResult.data.atendimento_pedidos && (
                  <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200 dark:border-amber-800 space-y-1">
                    <p className="font-semibold">Observações do Mapeamento:</p>
                    <p>
                      • Pedidos identificados:{' '}
                      <strong>{analysisResult.data.atendimento_pedidos.length}</strong> no lote.
                    </p>
                    <p>
                      • Linhas com &ldquo;Aguardando data&rdquo; serão cadastradas sem data e com
                      status aguardando.
                    </p>
                    {analysisResult.data.atendimento_pedidos.some((p) => p.dataAmbigua) && (
                      <p>
                        • Formatos de data ambíguos (ex.: 10/15/2026 interpretado como 15 de
                        Outubro) foram normalizados automaticamente.
                      </p>
                    )}
                  </div>
                )}

              {/* Tabela de prévia (primeiras linhas) */}
              {analysisResult.preview_rows && analysisResult.preview_rows.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Prévia dos Primeiros Registros Extraídos
                  </p>
                  <div className="border rounded-md overflow-x-auto max-h-60">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          {Object.keys(analysisResult.preview_rows[0]).map((col) => (
                            <th key={col} className="p-2 text-left font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.preview_rows.map((row, idx) => (
                          <tr key={idx} className="border-t hover:bg-muted/50">
                            {Object.values(row).map((val, cIdx) => (
                              <td key={cIdx} className="p-2 whitespace-nowrap">
                                {String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum pedido identificado no arquivo
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnalysisResult(null)
                    setReportFile(null)
                  }}
                  disabled={executingImport}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    setExecutingImport(true)
                    try {
                      let res: ExecutionResult
                      if (analysisResult.document_type === 'matriz_venda') {
                        res = await executeImportMatrizVenda(
                          analysisResult.data.matriz_venda || [],
                          reportFile?.name,
                        )
                      } else if (analysisResult.document_type === 'pedidos_carteira') {
                        res = await executeImportPedidosCarteira(
                          analysisResult.data.pedidos_carteira || [],
                          reportFile?.name,
                        )
                      } else if (analysisResult.document_type === 'relatorio_vendas_semanal') {
                        res = await executeImportRelatorioVendasSemanal(
                          analysisResult.data.relatorio_vendas_semanal || [],
                          reportFile?.name,
                        )
                      } else {
                        res = await executeImportAtendimentoPedidos(
                          analysisResult.data.atendimento_pedidos || [],
                          reportFile?.name,
                        )
                      }
                      setExecutionResult(res)
                      toast({
                        title: 'Importação Concluída',
                        description: res.message,
                      })
                    } catch {
                      toast({
                        title: 'Erro na importação',
                        description: 'Ocorreu uma falha ao gravar os dados. Tente novamente.',
                        variant: 'destructive',
                      })
                    } finally {
                      setExecutingImport(false)
                    }
                  }}
                  disabled={executingImport}
                  className="gap-2"
                >
                  {executingImport ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirmar Importação
                </Button>
              </div>
            </div>
          )}

          {/* Resultado pós-gravação */}
          {executionResult && (
            <div className="space-y-4 pt-2">
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  executionResult.success
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
                }`}
              >
                {executionResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold text-sm">
                    {executionResult.success ? 'Dados gravados com sucesso!' : 'Falha na gravação'}
                  </p>
                  <p className="text-xs">{executionResult.message}</p>
                  <div className="flex gap-4 pt-1 text-xs">
                    <span>
                      Gravados: <strong>{executionResult.inserted}</strong>
                    </span>
                    <span>
                      Ignorados/Deduplicados: <strong>{executionResult.skippedDuplicates}</strong>
                    </span>
                    {executionResult.errorsCount > 0 && (
                      <span className="text-rose-600 font-semibold">
                        Erros: {executionResult.errorsCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => {
                    setImportReportOpen(false)
                    setAnalysisResult(null)
                    setReportFile(null)
                    setExecutionResult(null)
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Novo Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nível de Acesso Mínimo</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo (.pdf, .docx)</Label>
              <Input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !title}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
