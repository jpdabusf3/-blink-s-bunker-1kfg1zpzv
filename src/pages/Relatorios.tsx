import { useState, useEffect, useMemo, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'

import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, normalizeNumberBR } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { Loader2, FileSpreadsheet, FileArchive, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { exportOrdersToExcel, exportOrdersToPDF } from '@/lib/exportUtils'
import { useAppContext } from '@/store/AppContext'
import { UserFilter } from '@/components/UserFilter'
import { MatrizVendasReport } from '@/components/MatrizVendasReport'
import {
  getClientReports,
  downloadClientReportFile,
  deleteClientReport,
  generateClientGoogleDocsHtml,
  dateStamp,
  type ClientReport,
} from '@/services/client-reports'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/utils'
import {
  REPORT_TEMPLATES,
  DEFAULT_REPORT_TEMPLATE,
  type ReportTemplateKey,
} from '@/lib/reportTemplates'
import {
  getReportTemplatePreference,
  saveReportTemplatePreference,
} from '@/services/report-template-preferences'
import { exportBatchClientReportsZip, logBatchReportExport } from '@/lib/batchReportExport'
import { FilePlus2, Sparkles, AlertCircle, RotateCcw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { SalesReportGeneratorBar } from '@/components/SalesReportGeneratorBar'
import { SalesReportDisplay } from '@/components/SalesReportDisplay'
import { SalesReportHistoryList } from '@/components/SalesReportHistoryList'
import {
  type SalesReportFilters,
  type GeneratedSalesReportData,
  type SalesReportHistoryItem,
  generateSalesReport,
  persistSalesReport,
  listSalesReportHistory,
} from '@/services/sales-report-generator'
import { BRAZILIAN_UFS } from '@/lib/cnpj'
import { CODIGO_CANONICO_ROTULO } from '@/constants/familiaProdutos'

const STATE_REGIONS = [
  'Sul',
  'Norte',
  'Oeste',
  'Leste',
  'Nordeste',
  'Noroeste',
  'Sudeste',
  'Sudoeste',
  'Centro',
]
const INDIRECT_TYPES = [
  'Representantes',
  'Distribuidores',
  'Revendas',
  'Cooperativas',
  'Indústrias',
]

export default function Relatorios() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clientReports, setClientReports] = useState<ClientReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const { factories } = useAppContext()
  const { user } = useAuth()
  const { toast } = useToast()

  // Persisted "Modelo Visual" report template preference (per user).
  const [reportTemplate, setReportTemplate] = useState<ReportTemplateKey>(DEFAULT_REPORT_TEMPLATE)
  const [templateLoading, setTemplateLoading] = useState(true)

  // Multi-selection of clients (Top Clientes) for batch export.
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
  const [batchExporting, setBatchExporting] = useState(false)
  const [batchDocsExporting, setBatchDocsExporting] = useState(false)

  // --- Gerador de Relatório de Vendas (Novo Recurso) ---
  const [reportFilters, setReportFilters] = useState<SalesReportFilters>({
    dataInicio: '',
    dataFim: '',
    segmentos: [],
    clienteId: 'all',
    familiaProduto: 'all',
    uf: 'all',
  })

  // 4 Estados: 'idle' | 'loading' | 'empty' | 'error' | 'success'
  const [reportState, setReportState] = useState<
    'idle' | 'loading' | 'empty' | 'error' | 'success'
  >('idle')
  const [generatedReport, setGeneratedReport] = useState<GeneratedSalesReportData | null>(null)
  const [reportHistory, setReportHistory] = useState<SalesReportHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(undefined)

  // Opções para dropdowns de filtros
  const [clienteDropdownOptions, setClienteDropdownOptions] = useState<
    { id: string; nome: string }[]
  >([])
  const [familiaDropdownOptions, setFamiliaDropdownOptions] = useState<string[]>([])
  const [ufDropdownOptions, setUfDropdownOptions] = useState<string[]>([])

  const loadReportHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const hist = await listSalesReportHistory()
      setReportHistory(hist)
    } catch {
      setReportHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReportHistory()
  }, [loadReportHistory])

  // Carrega opções de clientes, famílias e UFs existentes nas collections
  useEffect(() => {
    const loadFilterOptions = async () => {
      // 1. Clientes
      const clientMap = new Map<string, string>()
      factories.forEach((f) => {
        if (f.name) clientMap.set(f.name.trim(), f.name.trim())
      })

      // 2. Famílias a partir das constantes canônicas e produtos cadastrados
      const famSet = new Set<string>(Object.values(CODIGO_CANONICO_ROTULO))
      try {
        const prods = await pb.collection('produtos').getFullList({ fields: 'familia,nome,linha' })
        prods.forEach((p) => {
          if (p.familia && p.familia !== '—') famSet.add(p.familia)
        })
      } catch {
        /* intentionally ignored */
      }

      // 3. UFs a partir de BRAZILIAN_UFS e fábricas
      const ufSet = new Set<string>(BRAZILIAN_UFS)
      factories.forEach((f) => {
        if (f.state && f.state.trim().length === 2) ufSet.add(f.state.trim().toUpperCase())
      })

      // Também buscar clientes distintos da tabela faturamento
      try {
        const fatItems = await pb.collection('faturamento').getList(1, 100, {
          fields: 'cliente_nome,familia_produto,country',
          sort: '-created',
        })
        fatItems.items.forEach((item) => {
          if (item.cliente_nome) clientMap.set(item.cliente_nome.trim(), item.cliente_nome.trim())
          if (item.familia_produto && item.familia_produto !== '—') famSet.add(item.familia_produto)
        })
      } catch {
        /* intentionally ignored */
      }

      const sortedClients = Array.from(clientMap.keys())
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((nome) => ({ id: nome, nome }))
      setClienteDropdownOptions(sortedClients)

      const sortedFamilias = Array.from(famSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))
      setFamiliaDropdownOptions(sortedFamilias)

      const sortedUfs = Array.from(ufSet).sort()
      setUfDropdownOptions(sortedUfs)
    }

    loadFilterOptions()
  }, [factories])

  // Handler para disparar a geração do relatório
  const handleGenerateReport = async () => {
    setReportState('loading')
    setActiveHistoryId(undefined)

    try {
      const data = await generateSalesReport(reportFilters, factories)

      if (data.totalRegistros === 0 || data.totalFaturado === 0) {
        setGeneratedReport(data)
        setReportState('empty')
      } else {
        setGeneratedReport(data)
        setReportState('success')
        toast({
          title: 'Relatório gerado com sucesso.',
          description: `Total de ${data.totalRegistros} lançamentos faturados no período.`,
        })

        // Persiste relatório em segundo plano para histórico e documentos
        persistSalesReport(data).then((res) => {
          if (res.success && res.documentId) {
            setActiveHistoryId(res.documentId)
            loadReportHistory()
          }
        })
      }
    } catch (err) {
      console.error('[sales-report] Falha ao gerar:', err)
      setReportState('error')
      toast({
        title: 'Não foi possível gerar o relatório',
        description: 'Tente novamente em instantes ou ajuste os filtros.',
        variant: 'destructive',
      })
    }
  }

  // Handler para reabrir relatório do histórico
  const handleSelectHistoryReport = async (
    item: GeneratedSalesReportData | SalesReportHistoryItem,
  ) => {
    // Se o item já tiver o payload carregado
    if (
      'totalFaturado' in item &&
      'mesAMes' in item &&
      (item as GeneratedSalesReportData).mesAMes
    ) {
      const rep = item as GeneratedSalesReportData
      setGeneratedReport(rep)
      setReportFilters(rep.filtros || reportFilters)
      setReportState(rep.totalRegistros > 0 ? 'success' : 'empty')
      setActiveHistoryId(rep.id)
      setShowHistory(false)
      window.scrollTo({ top: 400, behavior: 'smooth' })
      toast({
        title: 'Relatório reaberto',
        description: 'Dados restaurados a partir do histórico de relatórios.',
      })
      return
    }

    const histItem = item as SalesReportHistoryItem
    setActiveHistoryId(histItem.id)

    // Se possui dataPayload armazenado
    if (histItem.dataPayload) {
      setGeneratedReport(histItem.dataPayload)
      setReportFilters(histItem.dataPayload.filtros || reportFilters)
      setReportState(histItem.dataPayload.totalRegistros > 0 ? 'success' : 'empty')
      setShowHistory(false)
      window.scrollTo({ top: 400, behavior: 'smooth' })
      toast({
        title: 'Relatório reaberto',
        description: `Visualizando ${histItem.title}.`,
      })
      return
    }

    // Caso não tenha payload, re-executa a geração com o período do item
    if (histItem.periodoInicio || histItem.periodoFim) {
      const newF = {
        ...reportFilters,
        dataInicio: histItem.periodoInicio || '',
        dataFim: histItem.periodoFim || '',
      }
      setReportFilters(newF)
      setReportState('loading')
      setShowHistory(false)
      try {
        const data = await generateSalesReport(newF, factories)
        setGeneratedReport(data)
        setReportState(data.totalRegistros > 0 ? 'success' : 'empty')
        toast({
          title: 'Relatório gerado com sucesso.',
        })
      } catch {
        setReportState('error')
      }
    }
  }

  useEffect(() => {
    getReportTemplatePreference()
      .then(setReportTemplate)
      .catch(() => {})
      .finally(() => setTemplateLoading(false))
  }, [])

  const handleTemplateChange = (value: string) => {
    if (value !== 'executivo' && value !== 'tecnico' && value !== 'comercial') return
    setReportTemplate(value)
    saveReportTemplatePreference(value).catch(() => {})
  }

  const loadClientReports = () => {
    setReportsLoading(true)
    getClientReports()
      .then(setClientReports)
      .catch(() => setClientReports([]))
      .finally(() => setReportsLoading(false))
  }

  useEffect(() => {
    loadClientReports()
  }, [])

  const [period, setPeriod] = useState<string>('monthly')
  const [channel, setChannel] = useState<string>('all')
  const [indirectType, setIndirectType] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [salesOwnerFilter, setSalesOwnerFilter] = useState<string>('all')

  const loadData = async () => {
    try {
      // Carregar pedidos legados da collection orders
      let legacyOrders: any[] = []
      try {
        legacyOrders = await pb.collection('orders').getFullList({ expand: 'factoryId' })
      } catch {
        legacyOrders = []
      }

      // Carregar historico_vendas (vendas implantadas manuais e via PDF)
      let historicoList: any[] = []
      try {
        historicoList = await pb.collection('historico_vendas').getFullList({
          expand: 'gestor_tecnico_id,vendedor_id',
          sort: '-created',
        })
      } catch {
        historicoList = []
      }

      // Converter itens de historico_vendas para a interface unificada de pedidos
      const convertedHistorico = historicoList.map((h) => {
        const dataDoc = h.data_documento || h.data || h.created?.slice(0, 10) || ''
        const clientName = h.destinatario_nome || h.cliente || 'Cliente'
        const rawValor = h.produto_valor_total || h.valor || h.valor_total_nota || 0
        const totalVal = normalizeNumberBR(rawValor)
        const qtd = normalizeNumberBR(h.produto_quantidade) || 1
        const line = h.produto_familia || h.especie_destino || h.especie || 'Geral'
        const prod = h.produto_descricao || h.produto_codigo || 'Item'
        const ownerName =
          h.vendedor ||
          h.gestor_tecnico ||
          h.expand?.vendedor_id?.nome ||
          h.expand?.gestor_tecnico_id?.nome ||
          'Não atribuído'

        // Tentar relacionar com factory existente pelo nome do cliente
        const matchedFactory = factories.find(
          (f) => f.name && f.name.toLowerCase().trim() === clientName.toLowerCase().trim(),
        )

        const factoryData = matchedFactory || {
          id: `cust_${clientName.replace(/\W+/g, '_')}`,
          name: clientName,
          state: h.destinatario_uf || '',
          stateRegion: 'Outros',
          salesChannel: h.canal_vendas === 'Direto' ? 'Direct' : 'Indirect',
          indirectChannelType: h.canal_vendas || 'Revendas',
          salesOwner: ownerName,
          salesOwnerName: ownerName,
        }

        return {
          id: h.id,
          orderDate: dataDoc,
          totalValue: totalVal,
          quantity: qtd,
          line,
          product: prod,
          factoryId: factoryData.id,
          salesOwner: ownerName,
          expand: {
            factoryId: factoryData,
          },
        }
      })

      setOrders([...legacyOrders, ...convertedHistorico])
    } catch {
      setOrders([])
      toast({
        title: 'Não foi possível carregar os dados.',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [factories])

  const handleRealtimeReload = useCallback(() => {
    loadData()
  }, [])

  useRealtime('historico_vendas', handleRealtimeReload)
  useRealtime('notas_fiscais', handleRealtimeReload)
  useRealtime('orders', handleRealtimeReload)

  const states = useMemo(() => {
    const s = new Set<string>()
    orders.forEach((o) => {
      if (o.expand?.factoryId?.state) s.add(o.expand.factoryId.state)
    })
    return Array.from(s).sort()
  }, [orders])

  const filteredOrders = useMemo(() => {
    let now = new Date()
    let startDate = new Date()

    if (period === 'weekly') {
      startDate.setDate(now.getDate() - 7)
    } else if (period === 'monthly') {
      startDate.setMonth(now.getMonth() - 1)
    } else if (period === 'quarterly') {
      startDate.setMonth(now.getMonth() - 4)
    } else if (period === 'yearly') {
      startDate.setFullYear(now.getFullYear() - 1)
    }

    return orders.filter((o) => {
      const d = new Date(o.orderDate)
      if (d < startDate) return false

      const f = o.expand?.factoryId
      if (!f) return false

      if (channel !== 'all' && f.salesChannel !== channel) return false
      if (
        channel === 'Indirect' &&
        indirectType !== 'all' &&
        f.indirectChannelType !== indirectType
      )
        return false

      if (stateFilter !== 'all' && f.state !== stateFilter) return false
      if (regionFilter !== 'all' && f.stateRegion !== regionFilter) return false
      if (salesOwnerFilter !== 'all' && f.salesOwner !== salesOwnerFilter) return false

      return true
    })
  }, [orders, period, channel, indirectType, stateFilter, regionFilter])

  const totalVolume = filteredOrders.reduce((acc, o) => acc + o.totalValue, 0)
  const totalQuantity = filteredOrders.reduce((acc, o) => acc + o.quantity, 0)

  const volumeByLine = useMemo(() => {
    const map = new Map<string, number>()
    filteredOrders.forEach((o) => {
      const line = o.line || 'Outros'
      map.set(line, (map.get(line) || 0) + o.totalValue)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredOrders])

  const volumeByProduct = useMemo(() => {
    const map = new Map<string, number>()
    filteredOrders.forEach((o) => {
      const p = o.product || 'Desconhecido'
      map.set(p, (map.get(p) || 0) + o.totalValue)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filteredOrders])

  const volumeByCustomer = useMemo(() => {
    const map = new Map<string, { name: string; value: number; factoryId?: string }>()
    filteredOrders.forEach((o) => {
      const fid = o.factoryId
      const c = o.expand?.factoryId?.name || 'Desconhecido'
      const key = fid ? fid : c
      const cur = map.get(key) || { name: c, value: 0, factoryId: fid }
      cur.value += o.totalValue
      map.set(key, cur)
    })
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 50)
  }, [filteredOrders])

  const volumeByOwner = useMemo(() => {
    const map = new Map<string, number>()
    filteredOrders.forEach((o) => {
      const factory = factories.find((f) => f.id === o.factoryId)
      const ownerName = factory?.salesOwnerName || 'Não atribuído'
      map.set(ownerName, (map.get(ownerName) || 0) + o.totalValue)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filteredOrders, factories])

  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ]

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* =========================================================================
          NOVO RECURSO: GERADOR DE RELATÓRIO DE VENDAS
          Botão proeminente, filtros completos, 4 estados e exportações executivas
         ========================================================================= */}
      <section className="space-y-4">
        <SalesReportGeneratorBar
          filters={reportFilters}
          onFiltersChange={setReportFilters}
          onGenerate={handleGenerateReport}
          loading={reportState === 'loading'}
          clienteOptions={clienteDropdownOptions}
          familiaOptions={familiaDropdownOptions}
          ufOptions={ufDropdownOptions}
          onToggleHistory={() => setShowHistory((prev) => !prev)}
          showHistory={showHistory}
          historyCount={reportHistory.length}
        />

        {/* Histórico Desdobrável de Relatórios Salvos */}
        {showHistory && (
          <div className="animate-fade-in">
            <SalesReportHistoryList
              history={reportHistory}
              loading={historyLoading}
              onSelectReport={handleSelectHistoryReport}
              activeReportId={activeHistoryId}
            />
          </div>
        )}

        {/* 4 ESTADOS DO GERADOR */}
        {/* 1. LOADING: Skeleton completo */}
        {reportState === 'loading' && (
          <div className="space-y-6 p-6 rounded-xl border bg-card animate-pulse">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-64 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        )}

        {/* 2. EMPTY: Mensagem sugerindo outro período */}
        {reportState === 'empty' && (
          <Card className="border border-dashed shadow-subtle bg-muted/10 text-center py-10 px-4">
            <CardContent className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Nenhum dado no período selecionado
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Não encontramos notas fiscais ou vendas faturadas com os filtros atuais. Sugerimos
                ampliar o intervalo de datas ou selecionar outros segmentos e clientes.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportFilters((prev) => ({
                      ...prev,
                      dataInicio: '',
                      dataFim: '',
                      segmentos: [],
                      clienteId: 'all',
                      familiaProduto: 'all',
                      uf: 'all',
                    }))
                    handleGenerateReport()
                  }}
                  className="text-xs gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar e Buscar Tudo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. ERROR: Mensagem de erro e botão de tentar novamente */}
        {reportState === 'error' && (
          <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 shadow-subtle text-center py-8 px-4">
            <CardContent className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-rose-950 dark:text-rose-200">
                Não foi possível gerar o relatório
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Ocorreu uma instabilidade na consulta de faturamento e vendas.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleGenerateReport}
                className="gap-2 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 4. SUCCESS: Relatório completo com animação e cards */}
        {reportState === 'success' && generatedReport && (
          <SalesReportDisplay report={generatedReport} />
        )}
      </section>

      {/* Separador e título da visão analítica complementar existente */}
      <div className="pt-4 border-t" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Visão Analítica de Carteira & Pedidos
          </h2>
          <p className="text-muted-foreground text-xs">
            Acompanhamento detalhado por canais de venda e exportações operacionais por cliente.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Modelo Visual (PDF)</label>
            <Select
              value={reportTemplate}
              onValueChange={handleTemplateChange}
              disabled={templateLoading}
            >
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Modelo..." />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TEMPLATES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() =>
              exportOrdersToPDF(filteredOrders, factories, { template: reportTemplate })
            }
            variant="outline"
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Exportar PDF
          </Button>
          <Button
            onClick={() => exportOrdersToExcel(filteredOrders, factories)}
            variant="outline"
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exportar para Excel (.csv)
          </Button>
        </div>
      </div>

      <Card className="border shadow-subtle">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Última Semana</SelectItem>
                <SelectItem value="monthly">Último Mês</SelectItem>
                <SelectItem value="quarterly">Últimos 4 Meses (Quadrimestral)</SelectItem>
                <SelectItem value="yearly">Último Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Canal de Venda</label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os canais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Direct">Venda Direta</SelectItem>
                <SelectItem value="Indirect">Venda Indireta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {channel === 'Indirect' && (
            <div className="space-y-2 animate-fade-in">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo de Canal Indireto
              </label>
              <Select value={indirectType} onValueChange={setIndirectType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {INDIRECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Estado (UF)</label>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Região</label>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {STATE_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Vendedor</label>
            <UserFilter
              value={salesOwnerFilter}
              onChange={setSalesOwnerFilter}
              className="bg-background"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volume de Vendas (R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatCurrency(totalVolume)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volume em Quantidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalQuantity} <span className="text-sm font-normal text-muted-foreground">un.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos Filtrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>Vendas por Linha de Produto</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {volumeByLine.length > 0 ? (
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={volumeByLine}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {volumeByLine.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>Top Produtos</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {volumeByProduct.length > 0 ? (
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeByProduct} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `R$ ${v / 1000}k`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Top Clientes</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedClientIds.size} selecionado(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={
                  selectedClientIds.size === 0 ||
                  batchExporting ||
                  batchDocsExporting ||
                  volumeByCustomer.filter((c) => c.factoryId).length === 0
                }
                onClick={async () => {
                  const clients = volumeByCustomer.filter(
                    (c) => c.factoryId && selectedClientIds.has(c.factoryId),
                  )
                  if (clients.length === 0) return
                  setBatchExporting(true)
                  try {
                    const solicitante = user?.name || user?.email || ''
                    await exportBatchClientReportsZip(
                      clients.map((c) => ({ id: c.factoryId!, name: c.name })),
                      { modelo: reportTemplate, solicitante },
                    )
                    await logBatchReportExport({
                      solicitante,
                      solicitanteId: user?.id,
                      clienteIds: clients.map((c) => c.factoryId!),
                      modelo: reportTemplate,
                      formato: 'pdf',
                    })
                    toast({
                      title: 'PDFs gerados com sucesso!',
                      description: `${clients.length} relatório(s) PDF empacotados em ZIP (modelo ${reportTemplate}).`,
                    })
                    setSelectedClientIds(new Set())
                  } catch (err) {
                    toast({
                      title: 'Erro na exportação em lote',
                      description:
                        err instanceof Error ? err.message : 'Não foi possível gerar o ZIP.',
                      variant: 'destructive',
                    })
                  } finally {
                    setBatchExporting(false)
                  }
                }}
              >
                {batchExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileArchive className="w-4 h-4" />
                )}
                Exportar PDFs em Lote (ZIP)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={
                  selectedClientIds.size === 0 ||
                  batchExporting ||
                  batchDocsExporting ||
                  volumeByCustomer.filter((c) => c.factoryId).length === 0
                }
                onClick={async () => {
                  const clients = volumeByCustomer.filter(
                    (c) => c.factoryId && selectedClientIds.has(c.factoryId),
                  )
                  if (clients.length === 0) return
                  setBatchDocsExporting(true)
                  try {
                    const solicitante = user?.name || user?.email || ''
                    // Open each client's Google Docs report in a new tab.
                    // Browsers may throttle multiple popups, so we open them
                    // sequentially with a small delay.
                    let opened = 0
                    for (const c of clients) {
                      try {
                        const html = await generateClientGoogleDocsHtml(c.factoryId!, {
                          titulo: `Relatório de Histórico — ${c.name}`,
                          modelo: reportTemplate,
                          solicitante,
                        })
                        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const win = window.open(url, '_blank')
                        if (!win) {
                          // popup blocked → trigger download fallback
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `relatorio-${c.name}-${dateStamp()} — Abrir no Google Docs.html`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                        }
                        setTimeout(() => URL.revokeObjectURL(url), 60_000)
                        opened++
                      } catch (err) {
                        console.error('[batch google docs] falha', c.name, err)
                      }
                    }
                    await logBatchReportExport({
                      solicitante,
                      solicitanteId: user?.id,
                      clienteIds: clients.map((c) => c.factoryId!),
                      modelo: reportTemplate,
                      formato: 'google-docs',
                    })
                    if (opened === 0) {
                      toast({
                        title: 'Erro ao preparar Google Docs',
                        description: 'Não foi possível abrir os relatórios. Tente novamente.',
                        variant: 'destructive',
                      })
                    } else {
                      toast({
                        title: 'Relatórios prontos para Google Docs!',
                        description: `${opened}/${clients.length} relatório(s) aberto(s) em nova aba (modelo ${reportTemplate}).`,
                      })
                      setSelectedClientIds(new Set())
                    }
                  } catch (err) {
                    toast({
                      title: 'Erro ao preparar Google Docs',
                      description: err instanceof Error ? err.message : 'Tente novamente.',
                      variant: 'destructive',
                    })
                  } finally {
                    setBatchDocsExporting(false)
                  }
                }}
              >
                {batchDocsExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FilePlus2 className="w-4 h-4" />
                )}
                Exportar Google Docs em Lote
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {volumeByCustomer.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          volumeByCustomer.filter((c) => c.factoryId).length > 0 &&
                          volumeByCustomer
                            .filter((c) => c.factoryId)
                            .every((c) => selectedClientIds.has(c.factoryId!))
                        }
                        onCheckedChange={(checked) => {
                          const ids = volumeByCustomer
                            .filter((c) => c.factoryId)
                            .map((c) => c.factoryId!)
                          setSelectedClientIds((prev) => {
                            const next = new Set(prev)
                            if (checked) ids.forEach((id) => next.add(id))
                            else ids.forEach((id) => next.delete(id))
                            return next
                          })
                        }}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Volume (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volumeByCustomer.map((c, i) => {
                    const fid = c.factoryId
                    const selectable = !!fid
                    const checked = !!fid && selectedClientIds.has(fid)
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            disabled={!selectable}
                            onCheckedChange={(v) => {
                              if (!fid) return
                              setSelectedClientIds((prev) => {
                                const next = new Set(prev)
                                if (v) next.add(fid)
                                else next.delete(fid)
                                return next
                              })
                            }}
                            aria-label={`Selecionar ${c.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(c.value)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Vendas por Vendedor / Gestor Técnico</CardTitle>
        </CardHeader>
        <CardContent>
          {volumeByOwner.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Volume (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volumeByOwner.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(c.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>

      <MatrizVendasReport />
    </div>
  )
}
