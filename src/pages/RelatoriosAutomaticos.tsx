import { useState, useEffect, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { downloadDocument, type DocumentItem } from '@/services/documents'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import {
  FileText,
  Download,
  Calendar,
  Clock,
  HardDrive,
  Filter,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react'

type ReportTypeFilter = 'all' | 'semanal' | 'mensal'

interface ParsedReport {
  doc: DocumentItem
  tipo: 'Semanal' | 'Mensal' | 'Outro'
  periodoFormatado: string
  ano: string
  createdFormatted: string
  tamanhoAproximado?: string
  nomeArquivo: string
}

const MESES_PT: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
}

function parseReportDetails(doc: DocumentItem): ParsedReport {
  const nome = (doc.nome_original || doc.file || doc.title || '').trim()

  // 1. Relatório Semanal: relatorio-semanal-2026-W37.docx ou similar
  const weeklyMatch = nome.match(/relatorio-semanal-(\d{4})-W(\d{1,2})/i)
  if (weeklyMatch) {
    const ano = weeklyMatch[1]
    const semana = weeklyMatch[2].padStart(2, '0')
    return {
      doc,
      tipo: 'Semanal',
      periodoFormatado: `Semana ${semana}/${ano}`,
      ano,
      createdFormatted: doc.created
        ? new Date(doc.created).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '-',
      nomeArquivo: doc.nome_original || doc.file,
    }
  }

  // 2. Relatório Mensal: relatorio-mensal-2026-09.docx ou similar
  const monthlyMatch = nome.match(/relatorio-mensal-(\d{4})-(\d{1,2})/i)
  if (monthlyMatch) {
    const ano = monthlyMatch[1]
    const mesNum = monthlyMatch[2].padStart(2, '0')
    const mesExtenso = MESES_PT[mesNum] || `Mês ${mesNum}`
    return {
      doc,
      tipo: 'Mensal',
      periodoFormatado: `${mesExtenso}/${ano}`,
      ano,
      createdFormatted: doc.created
        ? new Date(doc.created).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '-',
      nomeArquivo: doc.nome_original || doc.file,
    }
  }

  // Fallback para outros documentos caso venham na busca
  const isWeekly = nome.toLowerCase().includes('semanal')
  const isMonthly = nome.toLowerCase().includes('mensal')

  return {
    doc,
    tipo: isWeekly ? 'Semanal' : isMonthly ? 'Mensal' : 'Outro',
    periodoFormatado: doc.title || nome,
    ano: doc.created ? new Date(doc.created).getFullYear().toString() : '',
    createdFormatted: doc.created
      ? new Date(doc.created).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-',
    nomeArquivo: doc.nome_original || doc.file,
  }
}

export default function RelatoriosAutomaticos() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<ReportTypeFilter>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const loadReports = async () => {
    try {
      setLoading(true)
      // Buscar diretamente na coleção documents filtrando por relatórios do MAESTRO
      // Ordenado por created desc
      const records = await pb.collection('documents').getList<DocumentItem>(1, 200, {
        filter:
          "nome_original ~ 'relatorio-semanal-' || nome_original ~ 'relatorio-mensal-' || title ~ 'Relatório Semanal' || title ~ 'Relatório Mensal' || category = 'Relatórios Automáticos'",
        sort: '-created',
      })
      setDocuments(records.items)
    } catch (err) {
      console.error('Erro ao buscar relatórios automáticos:', err)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar relatórios.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  useRealtime('documents', () => {
    loadReports()
  })

  const parsedReports = useMemo(() => {
    return documents.map(parseReportDetails)
  }, [documents])

  const filteredReports = useMemo(() => {
    if (filterType === 'all') return parsedReports
    if (filterType === 'semanal') {
      return parsedReports.filter((r) => r.tipo === 'Semanal')
    }
    if (filterType === 'mensal') {
      return parsedReports.filter((r) => r.tipo === 'Mensal')
    }
    return parsedReports
  }, [parsedReports, filterType])

  const handleDownload = async (item: ParsedReport) => {
    try {
      setDownloadingId(item.doc.id)
      await downloadDocument(item.doc, item.nomeArquivo)
      toast({
        title: 'Download iniciado',
        description: `Baixando ${item.nomeArquivo}...`,
      })
    } catch (err) {
      console.error('Falha no download:', err)
      toast({
        title: 'Erro no download',
        description: 'Não foi possível baixar o relatório. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2.5 rounded-xl border border-primary/20 shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Relatórios Automáticos</h1>
              <Badge
                variant="outline"
                className="bg-primary/5 text-primary border-primary/20 text-xs"
              >
                MAESTRO AI
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Baixe os relatórios semanais e mensais em formato .docx gerados automaticamente para a
              Diretoria Comercial.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadReports}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros em Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-subtle">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground ml-1" />
          <span className="text-xs font-medium text-muted-foreground mr-1">Filtrar por:</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
              className="h-8 text-xs rounded-full px-3"
            >
              Todos ({parsedReports.length})
            </Button>
            <Button
              variant={filterType === 'semanal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('semanal')}
              className="h-8 text-xs rounded-full px-3"
            >
              Semanais ({parsedReports.filter((r) => r.tipo === 'Semanal').length})
            </Button>
            <Button
              variant={filterType === 'mensal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('mensal')}
              className="h-8 text-xs rounded-full px-3"
            >
              Mensais ({parsedReports.filter((r) => r.tipo === 'Mensal').length})
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground px-2">
          {filteredReports.length}{' '}
          {filteredReports.length === 1 ? 'relatório disponível' : 'relatórios disponíveis'}
        </div>
      </div>

      {/* Conteúdo: Skeleton, Empty State ou Lista */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="shadow-subtle border-border">
              <CardHeader className="pb-3 space-y-2">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-9 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="shadow-subtle border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Nenhum relatório gerado ainda.
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Os relatórios são gerados automaticamente toda segunda-feira e no 1º dia do mês às
              07:00.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((item) => {
            const isWeekly = item.tipo === 'Semanal'
            const isDownloading = downloadingId === item.doc.id

            return (
              <Card
                key={item.doc.id}
                className="shadow-subtle hover:shadow-md transition-all border-border flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className={
                        isWeekly
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                      }
                    >
                      {item.tipo}
                    </Badge>

                    <span className="text-[11px] font-mono text-muted-foreground">
                      {item.nomeArquivo.endsWith('.pdf') ? '.PDF' : '.DOCX'}
                    </span>
                  </div>

                  <CardTitle className="text-base font-bold text-foreground leading-snug">
                    {item.periodoFormatado}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate" title={item.nomeArquivo}>
                        Arquivo:{' '}
                        <strong className="font-mono text-foreground">{item.nomeArquivo}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Gerado em: {item.createdFormatted}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>
                        Formato:{' '}
                        {item.nomeArquivo.endsWith('.pdf')
                          ? 'Adobe PDF (.pdf)'
                          : 'Microsoft Word (.docx)'}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading}
                    className="w-full gap-2 shadow-sm"
                    variant="default"
                  >
                    <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                    {isDownloading
                      ? 'Baixando...'
                      : item.nomeArquivo.endsWith('.pdf')
                        ? 'Baixar Relatório .pdf'
                        : 'Baixar Relatório .docx'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
