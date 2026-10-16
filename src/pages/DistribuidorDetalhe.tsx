import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Phone,
  Mail,
  FileText,
  Edit,
  Weight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Search,
  Trash2,
  ArrowRightLeft,
  AlertTriangle,
  Layers,
  MapPin,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Clock,
} from 'lucide-react'
import {
  getDistribuidorById,
  getDistribuidores,
  getComprasDistribuidor,
  getClientesDistribuidor,
  deleteClienteDistribuidor,
  sincronizarFaturamentoComCompras,
  canEditDistribuidores,
  LINHAS_PRODUTO_METADATA,
  type Distribuidor,
  type CompraDistribuidor,
  type ClienteDistribuidor,
  type LinhaProdutoDistribuidor,
} from '@/services/distribuidores-service'
import { DistribuidorFormModal } from '@/components/distribuidores/DistribuidorFormModal'
import { CompraFormModal } from '@/components/distribuidores/CompraFormModal'
import { ClienteDistribuidorModal } from '@/components/distribuidores/ClienteDistribuidorModal'
import { ImportarClientesLoteModal } from '@/components/distribuidores/ImportarClientesLoteModal'
import { TransferirClienteModal } from '@/components/distribuidores/TransferirClienteModal'
import { DistribuidorCarteiraMap } from '@/components/distribuidores/DistribuidorCarteiraMap'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export default function DistribuidorDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = canEditDistribuidores(user)

  // Estados principais
  const [distribuidor, setDistribuidor] = useState<Distribuidor | null>(null)
  const [todosDistribuidores, setTodosDistribuidores] = useState<Distribuidor[]>([])
  const [compras, setCompras] = useState<CompraDistribuidor[]>([])
  const [clientes, setClientes] = useState<ClienteDistribuidor[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingFat, setSyncingFat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modais
  const [modalEditOpen, setModalEditOpen] = useState(false)
  const [modalCompraOpen, setModalCompraOpen] = useState(false)
  const [modalClienteOpen, setModalClienteOpen] = useState(false)
  const [modalImportLoteOpen, setModalImportLoteOpen] = useState(false)
  const [modalTransferOpen, setModalTransferOpen] = useState(false)
  const [clienteParaTransferir, setClienteParaTransferir] = useState<ClienteDistribuidor | null>(
    null,
  )

  // Diálogo de confirmação de exclusão
  const [clienteParaExcluir, setClienteParaExcluir] = useState<ClienteDistribuidor | null>(null)
  const [dialogExcluirOpen, setDialogExcluirOpen] = useState(false)
  const [deletingCliente, setDeletingCliente] = useState(false)

  // Filtros Seção 2: Histórico de Compras + Gráfico
  const [comprasPeriodo, setComprasPeriodo] = useState<'12m' | '6m' | 'ano' | 'tudo'>('12m')
  const [comprasLinhaFiltro, setComprasLinhaFiltro] = useState<string>('todas')
  const [metricaGrafico, setMetricaGrafico] = useState<'ton' | 'brl' | 'usd'>('ton')
  const [empilharLinhas, setEmpilharLinhas] = useState<boolean>(true)
  const [paginaCompras, setPaginaCompras] = useState(1)
  const registrosPorPagina = 20

  // Filtros Seção 3: Carteira de Clientes
  const [ufFiltroCarteira, setUfFiltroCarteira] = useState<string | null>(null)
  const [buscaCarteira, setBuscaCarteira] = useState('')
  const [mostrarMapa, setMostrarMapa] = useState(true)

  // Carregar dados
  const loadData = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [dist, allDists, distCompras, distClientes] = await Promise.all([
        getDistribuidorById(id),
        getDistribuidores(),
        getComprasDistribuidor(id),
        getClientesDistribuidor(id),
      ])

      if (!dist) {
        setError('Distribuidor não encontrado.')
        return
      }

      setDistribuidor(dist)
      setTodosDistribuidores(allDists)
      setCompras(distCompras)
      setClientes(distClientes)
    } catch (err: any) {
      console.error('[DistribuidorDetalhePage] Erro ao carregar dados:', err)
      setError('Falha ao carregar os dados deste distribuidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // Sincronização automática com esteira de faturamento
  const handleSincronizarFaturamento = async () => {
    if (!distribuidor) return
    setSyncingFat(true)
    try {
      const res = await sincronizarFaturamentoComCompras(distribuidor)
      if (res.importadas > 0) {
        toast.success(
          `${res.importadas} novas compras alimentadas automaticamente da esteira de faturamento!`,
        )
        const updatedCompras = await getComprasDistribuidor(distribuidor.id)
        setCompras(updatedCompras)
      } else {
        toast.info('Nenhuma nova nota fiscal pendente de faturamento para este distribuidor.')
      }
    } catch (err: any) {
      console.error('[DistribuidorDetalhePage] Falha na sincronização:', err)
      toast.error('Erro ao sincronizar com faturamento.')
    } finally {
      setSyncingFat(false)
    }
  }

  // Confirmar exclusão de cliente
  const handleConfirmDeleteCliente = async () => {
    if (!clienteParaExcluir || !distribuidor) return
    setDeletingCliente(true)
    try {
      await deleteClienteDistribuidor(clienteParaExcluir, distribuidor.nome, user)
      toast.success('Cliente removido')
      setClientes((prev) => prev.filter((c) => c.id !== clienteParaExcluir.id))
      setDialogExcluirOpen(false)
      setClienteParaExcluir(null)
    } catch (err: any) {
      console.error('[DistribuidorDetalhePage] Erro ao excluir cliente:', err)
      toast.error('Erro ao excluir cliente da carteira.')
    } finally {
      setDeletingCliente(false)
    }
  }

  // ----------------------------------------------------------------------------
  // SEÇÃO 2.1 — QUADRO DE VOLUMES E QUEBRA POR LINHA (MY-CO, MO-BE, MI-OR, MY-ST...)
  // ----------------------------------------------------------------------------
  const volumesQuadro = useMemo(() => {
    const now = new Date()
    const dozeMesesAtras = new Date(now.getTime() - 365 * 24 * 3600 * 1000)
    const periodoAnteriorInicio = new Date(now.getTime() - 2 * 365 * 24 * 3600 * 1000)

    const comprasAtual = compras.filter((c) => new Date(c.data) >= dozeMesesAtras)
    const comprasAnterior = compras.filter((c) => {
      const d = new Date(c.data)
      return d >= periodoAnteriorInicio && d < dozeMesesAtras
    })

    const totalTon = comprasAtual.reduce((acc, c) => acc + (c.toneladas || 0), 0)
    const totalBrl = comprasAtual.reduce((acc, c) => acc + (c.valor_brl || 0), 0)
    const totalUsd = comprasAtual.reduce((acc, c) => acc + (c.valor_usd || 0), 0)

    const antTon = comprasAnterior.reduce((acc, c) => acc + (c.toneladas || 0), 0)
    const antBrl = comprasAnterior.reduce((acc, c) => acc + (c.valor_brl || 0), 0)
    const antUsd = comprasAnterior.reduce((acc, c) => acc + (c.valor_usd || 0), 0)

    const deltaTon = antTon > 0 ? ((totalTon - antTon) / antTon) * 100 : totalTon > 0 ? 100 : 0
    const deltaBrl = antBrl > 0 ? ((totalBrl - antBrl) / antBrl) * 100 : totalBrl > 0 ? 100 : 0
    const deltaUsd = antUsd > 0 ? ((totalUsd - antUsd) / antUsd) * 100 : totalUsd > 0 ? 100 : 0

    // Quebra por linha de produto do portfólio Blink
    const linhasBase: LinhaProdutoDistribuidor[] = [
      'MY-CO',
      'MO-BE',
      'MI-OR',
      'MY-ST',
      'MI-XS',
      'Outros',
    ]
    const quebraLinhas = linhasBase.map((linhaKey) => {
      const meta = LINHAS_PRODUTO_METADATA[linhaKey]
      const itensLinha = comprasAtual.filter((c) => c.linha_produto === linhaKey)
      const lTon = itensLinha.reduce((acc, c) => acc + (c.toneladas || 0), 0)
      const lBrl = itensLinha.reduce((acc, c) => acc + (c.valor_brl || 0), 0)
      const lUsd = itensLinha.reduce((acc, c) => acc + (c.valor_usd || 0), 0)
      const perc = totalTon > 0 ? (lTon / totalTon) * 100 : 0

      return {
        linha: linhaKey,
        label: meta.label,
        desc: meta.desc,
        cor: meta.cor,
        toneladas: lTon,
        valor_brl: lBrl,
        valor_usd: lUsd,
        percentual: perc,
      }
    })

    return {
      totalTon,
      totalBrl,
      totalUsd,
      deltaTon,
      deltaBrl,
      deltaUsd,
      quebraLinhas,
    }
  }, [compras])

  // Verificação de alerta 60+ dias sem compra
  const alertaDiasSemCompra = useMemo(() => {
    if (compras.length === 0) return { alerta: true, dias: 999 }
    const sorted = [...compras].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
    )
    const ultima = new Date(sorted[0].data)
    const diffMs = new Date().getTime() - ultima.getTime()
    const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    return { alerta: dias >= 60, dias, ultimaData: sorted[0].data }
  }, [compras])

  // ----------------------------------------------------------------------------
  // SEÇÃO 2.2 — HISTÓRICO DE COMPRAS + GRÁFICO MENSAL COM TOOLTIP
  // ----------------------------------------------------------------------------
  const comprasFiltradas = useMemo(() => {
    const now = new Date()
    let minDate = new Date(0)
    if (comprasPeriodo === '6m') {
      minDate = new Date(now.getTime() - 180 * 24 * 3600 * 1000)
    } else if (comprasPeriodo === '12m') {
      minDate = new Date(now.getTime() - 365 * 24 * 3600 * 1000)
    } else if (comprasPeriodo === 'ano') {
      minDate = new Date(now.getFullYear(), 0, 1)
    }

    return compras.filter((c) => {
      const d = new Date(c.data)
      if (d < minDate) return false
      if (comprasLinhaFiltro !== 'todas' && c.linha_produto !== comprasLinhaFiltro) return false
      return true
    })
  }, [compras, comprasPeriodo, comprasLinhaFiltro])

  // Dados agrupados por mês para o gráfico
  const chartData = useMemo(() => {
    const mesesMap: Record<string, any> = {}

    // Ordenar compras por data ascendente
    const sorted = [...comprasFiltradas].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
    )

    sorted.forEach((c) => {
      const d = new Date(c.data)
      const mesChave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mesLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

      if (!mesesMap[mesChave]) {
        mesesMap[mesChave] = {
          mes: mesLabel,
          mesChave,
          totalTon: 0,
          totalBrl: 0,
          totalUsd: 0,
          'MY-CO': 0,
          'MO-BE': 0,
          'MI-OR': 0,
          'MY-ST': 0,
          'MI-XS': 0,
          Outros: 0,
        }
      }

      const ton = c.toneladas || 0
      const brl = c.valor_brl || 0
      const usd = c.valor_usd || 0

      mesesMap[mesChave].totalTon += ton
      mesesMap[mesChave].totalBrl += brl
      mesesMap[mesChave].totalUsd += usd

      const val = metricaGrafico === 'ton' ? ton : metricaGrafico === 'brl' ? brl : usd
      const linha = c.linha_produto || 'Outros'
      if (mesesMap[mesChave][linha] !== undefined) {
        mesesMap[mesChave][linha] += val
      } else {
        mesesMap[mesChave].Outros += val
      }
    })

    return Object.values(mesesMap)
  }, [comprasFiltradas, metricaGrafico])

  // Paginação da tabela de compras (20 registros/página)
  const totalPaginasCompras = Math.ceil(comprasFiltradas.length / registrosPorPagina) || 1
  const comprasPaginadas = useMemo(() => {
    const inicio = (paginaCompras - 1) * registrosPorPagina
    return comprasFiltradas.slice(inicio, inicio + registrosPorPagina)
  }, [comprasFiltradas, paginaCompras])

  // Exportar compras para CSV no padrão brasileiro (DD/MM/AAAA, R$ 1.234,56, separador ;)
  const handleExportarCsvCompras = () => {
    if (comprasFiltradas.length === 0) {
      toast.error('Nenhuma compra para exportar.')
      return
    }

    const headers = [
      'Data',
      'NF',
      'Produto',
      'Linha',
      'Toneladas',
      'Valor (R$)',
      'Valor (US$)',
      'Origem',
      'Observacoes',
    ]
    const rows = comprasFiltradas.map((c) => {
      const dataBr = new Date(c.data).toLocaleDateString('pt-BR')
      const tonBr = (c.toneladas || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      const brlBr = (c.valor_brl || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      const usdBr = (c.valor_usd || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      return [
        dataBr,
        `"${c.nf || ''}"`,
        `"${(c.produto || '').replace(/"/g, '""')}"`,
        `"${c.linha_produto || ''}"`,
        tonBr,
        brlBr,
        usdBr,
        `"${c.origem || 'manual'}"`,
        `"${(c.observacoes || '').replace(/"/g, '""')}"`,
      ].join(';')
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `compras_${distribuidor?.nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Arquivo CSV brasileiro exportado com sucesso!')
  }

  // ----------------------------------------------------------------------------
  // SEÇÃO 2.3 — CARTEIRA DE CLIENTES (CHIPS POR ESTADO, FILTRO, BUSCA, MAPA)
  // ----------------------------------------------------------------------------
  const ufCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    clientes.forEach((c) => {
      const uf = c.uf?.trim().toUpperCase() || 'SEM_UF'
      counts[uf] = (counts[uf] || 0) + 1
    })
    return counts
  }, [clientes])

  const sortedUfChips = useMemo(() => {
    return Object.entries(ufCounts).sort((a, b) => b[1] - a[1])
  }, [ufCounts])

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      if (ufFiltroCarteira) {
        if (ufFiltroCarteira === 'SEM_UF' && c.uf) return false
        if (ufFiltroCarteira !== 'SEM_UF' && c.uf?.toUpperCase() !== ufFiltroCarteira) return false
      }
      if (buscaCarteira.trim()) {
        const q = buscaCarteira.toLowerCase().trim()
        const matchNome = c.nome_cliente.toLowerCase().includes(q)
        const matchMun = (c.municipio || '').toLowerCase().includes(q)
        const matchUf = (c.uf || '').toLowerCase().includes(q)
        return matchNome || matchMun || matchUf
      }
      return true
    })
  }, [clientes, ufFiltroCarteira, buscaCarteira])

  // Formatadores pt-BR
  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  const formatUSD = (val: number) =>
    `US$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const formatTon = (val: number) =>
    `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Ton`

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não informado'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl animate-pulse">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !distribuidor) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <Card className="border-destructive/40 bg-destructive/10 p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-3" />
          <h2 className="text-xl font-bold text-destructive">Erro</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {error || 'Distribuidor não encontrado.'}
          </p>
          <Button onClick={() => navigate('/distribuidores')}>
            Voltar para Lista de Distribuidores
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl animate-fade-in">
      {/* Botão Voltar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/distribuidores')}
          className="gap-1 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Distribuidores
        </Button>
      </div>

      {/* CABEÇALHO FIXO: nome, CNPJ, contato, vigência, status, editar */}
      <Card className="border border-border/60 shadow-sm bg-card overflow-hidden">
        <div className="p-5 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black text-foreground">
                  {distribuidor.nome}
                </h1>
                <Badge
                  variant={distribuidor.status === 'ativo' ? 'default' : 'secondary'}
                  className="text-xs uppercase"
                >
                  {distribuidor.status || 'Ativo'}
                </Badge>
                {alertaDiasSemCompra.alerta && (
                  <Badge variant="destructive" className="text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Sem compras há {alertaDiasSemCompra.dias} dias
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Cadastro de Distribuidor Parceiro &middot; ID: {distribuidor.id}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSincronizarFaturamento}
                disabled={syncingFat}
                className="gap-1.5 text-xs"
                title="Puxa novas notas fiscais faturadas pela Blink para este distribuidor"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingFat ? 'animate-spin' : ''}`} />
                Sincronizar Faturamento
              </Button>

              {canEdit && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setModalEditOpen(true)}
                  className="gap-1.5 text-xs shadow-sm"
                >
                  <Edit className="w-3.5 h-3.5" /> Editar Cadastro
                </Button>
              )}
            </div>
          </div>

          {/* Dados cadastrais em grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border/40 text-xs">
            {/* CNPJ */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-muted/50 text-muted-foreground">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">CNPJ</span>
                <span className="font-semibold text-foreground">
                  {distribuidor.cnpj || 'Não informado'}
                </span>
              </div>
            </div>

            {/* Contato Principal */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-muted/50 text-muted-foreground">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Contato & Telefone</span>
                <span className="font-semibold text-foreground truncate block max-w-[180px]">
                  {distribuidor.contato_nome || 'Equipe Comercial'}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {distribuidor.contato_telefone || 'Sem telefone'}
                </span>
              </div>
            </div>

            {/* E-mail */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-muted/50 text-muted-foreground">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">E-mail Corporativo</span>
                <span className="font-semibold text-foreground truncate block max-w-[180px]">
                  {distribuidor.contato_email || 'Não informado'}
                </span>
              </div>
            </div>

            {/* Vigência do Contrato */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-muted/50 text-muted-foreground">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Vigência do Contrato
                </span>
                <span className="font-semibold text-foreground">
                  {distribuidor.contrato_inicio
                    ? `${formatDate(distribuidor.contrato_inicio)} até ${
                        distribuidor.contrato_fim
                          ? formatDate(distribuidor.contrato_fim)
                          : 'Indeterminado'
                      }`
                    : 'Sem vigência cadastrada'}
                </span>
              </div>
            </div>
          </div>

          {/* UFs Homologadas */}
          {distribuidor.ufs_atuacao && distribuidor.ufs_atuacao.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-border/40 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-medium">
                UFs de Atuação Homologadas:
              </span>
              <div className="flex flex-wrap gap-1">
                {distribuidor.ufs_atuacao.map((uf) => (
                  <Badge
                    key={uf}
                    variant="secondary"
                    className="text-[10px] font-semibold px-2 py-0"
                  >
                    {uf}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* NAVEGAÇÃO ENTRE AS 3 SEÇÕES INTERNAS */}
      <Tabs defaultValue="volumes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="volumes" className="text-xs">
            1. Quadro de Volumes
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">
            2. Histórico & Gráficos
          </TabsTrigger>
          <TabsTrigger value="carteira" className="text-xs">
            3. Carteira de Clientes ({clientes.length})
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------------- */}
        {/* SEÇÃO 2.1 — QUADRO DE VOLUMES DO DISTRIBUIDOR */}
        {/* ---------------------------------------------------------------------- */}
        <TabsContent value="volumes" className="space-y-6">
          {/* Cards Ton | R$ | US$ no período com variação vs anterior */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Toneladas */}
            <Card className="border border-border/60 shadow-sm p-5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Volume Comercializado</span>
                <Weight className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-3xl font-black text-foreground">
                {formatTon(volumesQuadro.totalTon)}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={`inline-flex items-center gap-1 ${
                    volumesQuadro.deltaTon >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {volumesQuadro.deltaTon >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {volumesQuadro.deltaTon >= 0 ? '+' : ''}
                  {volumesQuadro.deltaTon.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs período anterior</span>
              </div>
            </Card>

            {/* Card R$ */}
            <Card className="border border-border/60 shadow-sm p-5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Faturamento em Reais</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {formatBRL(volumesQuadro.totalBrl)}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={`inline-flex items-center gap-1 ${
                    volumesQuadro.deltaBrl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {volumesQuadro.deltaBrl >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {volumesQuadro.deltaBrl >= 0 ? '+' : ''}
                  {volumesQuadro.deltaBrl.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs período anterior</span>
              </div>
            </Card>

            {/* Card US$ */}
            <Card className="border border-border/60 shadow-sm p-5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Faturamento em Dólares</span>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {formatUSD(volumesQuadro.totalUsd)}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className={`inline-flex items-center gap-1 ${
                    volumesQuadro.deltaUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {volumesQuadro.deltaUsd >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {volumesQuadro.deltaUsd >= 0 ? '+' : ''}
                  {volumesQuadro.deltaUsd.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs período anterior</span>
              </div>
            </Card>
          </div>

          {/* QUEBRA POR LINHA DE PRODUTO DO PORTFÓLIO BLINK */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="py-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    Quebra por Linha de Produto do Portfólio Blink
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Adsorventes (MY-CO), Prebióticos (MO-BE), Minerais Orgânicos (MI-OR) e
                    Ingredientes (MY-ST)
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  Últimos 12 meses
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Linha de Produto</TableHead>
                    <TableHead>Produtos Principais</TableHead>
                    <TableHead className="text-right">Toneladas</TableHead>
                    <TableHead className="text-right">Faturamento (R$)</TableHead>
                    <TableHead className="text-right">Faturamento (US$)</TableHead>
                    <TableHead className="text-center w-36">Mix de Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volumesQuadro.quebraLinhas.map((item) => (
                    <TableRow key={item.linha} className="text-xs">
                      <TableCell className="font-semibold py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.cor }}
                          />
                          <span className="text-foreground">{item.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-3.5">{item.desc}</TableCell>
                      <TableCell className="text-right font-medium py-3.5">
                        {formatTon(item.toneladas)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400 py-3.5">
                        {formatBRL(item.valor_brl)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-indigo-600 dark:text-indigo-400 py-3.5">
                        {formatUSD(item.valor_usd)}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, item.percentual)}%`,
                                backgroundColor: item.cor,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-muted-foreground w-10 text-right">
                            {item.percentual.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------------- */}
        {/* SEÇÃO 2.2 — HISTÓRICO DE COMPRAS + GRÁFICO */}
        {/* ---------------------------------------------------------------------- */}
        <TabsContent value="historico" className="space-y-6">
          {/* BARRA DE AÇÕES E FILTROS */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro Período */}
              <Select value={comprasPeriodo} onValueChange={(v) => setComprasPeriodo(v as any)}>
                <SelectTrigger className="w-36 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12m">Últimos 12 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  <SelectItem value="ano">Ano Atual</SelectItem>
                  <SelectItem value="tudo">Histórico Total</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro Linha de Produto */}
              <Select value={comprasLinhaFiltro} onValueChange={setComprasLinhaFiltro}>
                <SelectTrigger className="w-44 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Linhas</SelectItem>
                  {Object.entries(LINHAS_PRODUTO_METADATA).map(([k, meta]) => (
                    <SelectItem key={k} value={k}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Alternador Ton / R$ / US$ */}
              <div className="inline-flex rounded-md border border-border/60 bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setMetricaGrafico('ton')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    metricaGrafico === 'ton'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Ton
                </button>
                <button
                  type="button"
                  onClick={() => setMetricaGrafico('brl')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    metricaGrafico === 'brl'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  R$
                </button>
                <button
                  type="button"
                  onClick={() => setMetricaGrafico('usd')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    metricaGrafico === 'usd'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  US$
                </button>
              </div>

              {/* Alternar Empilhar */}
              <Button
                variant={empilharLinhas ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setEmpilharLinhas(!empilharLinhas)}
                className="text-xs h-9 gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                {empilharLinhas ? 'Empilhado por Linha' : 'Visão Total'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportarCsvCompras}
                className="gap-1.5 text-xs h-9"
              >
                <Download className="w-3.5 h-3.5" /> Exportar CSV (pt-BR)
              </Button>

              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => setModalCompraOpen(true)}
                  className="gap-1.5 text-xs h-9"
                >
                  <Plus className="w-3.5 h-3.5" /> Registrar Compra
                </Button>
              )}
            </div>
          </div>

          {/* GRÁFICO MENSAL COM TOOLTIP */}
          <Card className="border border-border/60 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Evolução Mensal de Compras —{' '}
                  {metricaGrafico === 'ton'
                    ? 'Toneladas'
                    : metricaGrafico === 'brl'
                      ? 'Faturamento R$'
                      : 'Faturamento US$'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Alimentação automática pela esteira de faturamento e lançamentos manuais
                </p>
              </div>
            </div>

            <div className="h-[280px] w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Nenhuma compra registrada no período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="mes" fontSize={11} stroke="#888888" />
                    <YAxis
                      fontSize={11}
                      stroke="#888888"
                      tickFormatter={(val) =>
                        metricaGrafico === 'ton'
                          ? `${val} t`
                          : metricaGrafico === 'brl'
                            ? `R$ ${(val / 1000).toFixed(0)}k`
                            : `$ ${(val / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => {
                        const num = Number(val || 0)
                        if (metricaGrafico === 'ton') {
                          return [
                            `${num.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} Ton`,
                            name,
                          ]
                        }
                        if (metricaGrafico === 'brl') {
                          return [formatBRL(num), name]
                        }
                        return [formatUSD(num), name]
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        color: '#0f172a',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                    {empilharLinhas ? (
                      <>
                        <Bar
                          dataKey="MY-CO"
                          name="MY-CO (Adsorventes)"
                          stackId="a"
                          fill="#3b82f6"
                        />
                        <Bar
                          dataKey="MO-BE"
                          name="MO-BE (Prebióticos)"
                          stackId="a"
                          fill="#10b981"
                        />
                        <Bar
                          dataKey="MI-OR"
                          name="MI-OR (Minerais Org.)"
                          stackId="a"
                          fill="#f59e0b"
                        />
                        <Bar
                          dataKey="MY-ST"
                          name="MY-ST (Ingredientes)"
                          stackId="a"
                          fill="#8b5cf6"
                        />
                        <Bar dataKey="Outros" name="Outras Linhas" stackId="a" fill="#94a3b8" />
                      </>
                    ) : (
                      <Bar
                        dataKey={
                          metricaGrafico === 'ton'
                            ? 'totalTon'
                            : metricaGrafico === 'brl'
                              ? 'totalBrl'
                              : 'totalUsd'
                        }
                        name="Total do Mês"
                        fill="#0ea5e9"
                        radius={[4, 4, 0, 0]}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* TABELA PAGINADA DE COMPRAS (20 REGISTROS/PÁGINA) */}
          <Card className="border border-border/60 shadow-sm overflow-hidden">
            <div className="py-3 px-4 bg-muted/20 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Registros de Compra ({comprasFiltradas.length} total)
              </span>
              <span className="text-xs text-muted-foreground">
                Página {paginaCompras} de {totalPaginasCompras}
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-28">NF</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead className="text-right">Ton</TableHead>
                    <TableHead className="text-right">R$</TableHead>
                    <TableHead className="text-right">US$</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprasPaginadas.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        Nenhuma compra encontrada para os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comprasPaginadas.map((c) => (
                      <TableRow key={c.id} className="text-xs">
                        <TableCell className="font-medium text-foreground py-3">
                          {formatDate(c.data)}
                        </TableCell>
                        <TableCell className="py-3 font-mono text-[11px]">
                          {c.nf || 'S/N'}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground py-3">
                          {c.produto}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {c.linha_produto}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium py-3">
                          {formatTon(c.toneladas || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400 py-3">
                          {formatBRL(c.valor_brl || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-indigo-600 dark:text-indigo-400 py-3">
                          {formatUSD(c.valor_usd || 0)}
                        </TableCell>
                        <TableCell className="py-3">
                          {c.origem === 'faturamento_importado' ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] text-sky-600 bg-sky-50 dark:bg-sky-950/30"
                            >
                              Esteira Faturamento
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Manual
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Controles de Paginação */}
            {totalPaginasCompras > 1 && (
              <div className="p-3 border-t border-border/40 flex items-center justify-between text-xs bg-muted/20">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaCompras <= 1}
                  onClick={() => setPaginaCompras((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-muted-foreground">
                  Página {paginaCompras} de {totalPaginasCompras}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaCompras >= totalPaginasCompras}
                  onClick={() => setPaginaCompras((p) => Math.min(totalPaginasCompras, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------------- */}
        {/* SEÇÃO 2.3 — CARTEIRA DE CLIENTES DO DISTRIBUIDOR */}
        {/* ---------------------------------------------------------------------- */}
        <TabsContent value="carteira" className="space-y-6">
          {/* BARRA SUPERIOR: CHIPS POR ESTADO COM CONTAGEM */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Clientes por Estado (Clique no chip para filtrar):
              </span>
              {ufFiltroCarteira && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUfFiltroCarteira(null)}
                  className="text-xs h-7 text-primary"
                >
                  Limpar filtro de estado
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 p-2.5 bg-muted/30 rounded-lg border border-border/50">
              <Badge
                variant={ufFiltroCarteira === null ? 'default' : 'outline'}
                className="cursor-pointer text-xs px-2.5 py-1 select-none hover:opacity-80 transition-opacity"
                onClick={() => setUfFiltroCarteira(null)}
              >
                Todos ({clientes.length})
              </Badge>

              {sortedUfChips.map(([uf, count]) => (
                <Badge
                  key={uf}
                  variant={ufFiltroCarteira === uf ? 'default' : 'outline'}
                  className="cursor-pointer text-xs px-2.5 py-1 select-none hover:opacity-80 transition-opacity"
                  onClick={() => setUfFiltroCarteira(ufFiltroCarteira === uf ? null : uf)}
                >
                  {uf === 'SEM_UF' ? 'Sem UF' : uf} ({count})
                </Badge>
              ))}
            </div>
          </div>

          {/* VISÃO DE MAPA OPCIONAL COM PINS POR ESTADO DE SEDE */}
          {mostrarMapa && (
            <DistribuidorCarteiraMap
              distribuidorNome={distribuidor.nome}
              ufCounts={ufCounts}
              selectedUf={ufFiltroCarteira}
              onSelectUf={setUfFiltroCarteira}
            />
          )}

          {/* BARRA DE AÇÕES DA TABELA DE CLIENTES */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
            <div className="flex flex-1 items-center gap-2 max-w-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={buscaCarteira}
                  onChange={(e) => setBuscaCarteira(e.target.value)}
                  placeholder="Buscar cliente ou município..."
                  className="pl-9 text-xs h-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrarMapa(!mostrarMapa)}
                className="text-xs h-9 gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                {mostrarMapa ? 'Ocultar Mapa' : 'Ver Mapa'}
              </Button>

              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalImportLoteOpen(true)}
                    className="text-xs h-9 gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Importação em Lote
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => setModalClienteOpen(true)}
                    className="text-xs h-9 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Incluir Cliente
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* TABELA DE CLIENTES: Cliente | UF | Município | Status | Ações */}
          {clientesFiltrados.length === 0 ? (
            <Card className="border-dashed border-2 border-border/80 p-8 text-center bg-card">
              <Building2 className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
              <h4 className="text-base font-bold text-foreground">
                {buscaCarteira || ufFiltroCarteira
                  ? 'Nenhum cliente atende aos filtros atuais'
                  : 'Nenhum cliente nesta carteira'}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                {buscaCarteira || ufFiltroCarteira
                  ? 'Limpe a busca ou remova o filtro de estado para visualizar os demais clientes.'
                  : 'Inclua clientes individualmente ou importe a lista completa em lote via planilha.'}
              </p>
              {canEdit && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setModalClienteOpen(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Incluir Cliente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalImportLoteOpen(true)}
                    className="gap-1.5 text-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Importar Planilha
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="border border-border/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead>Cliente (Razão Social / Fazenda)</TableHead>
                      <TableHead className="w-20">UF</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead>Observações</TableHead>
                      {canEdit && <TableHead className="text-right w-28">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFiltrados.map((cli) => (
                      <TableRow key={cli.id} className="text-xs">
                        <TableCell className="font-bold text-foreground py-3">
                          {cli.nome_cliente}
                        </TableCell>
                        <TableCell className="py-3">
                          {cli.uf ? (
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              {cli.uf}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                            >
                              Sem UF
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-3">
                          {cli.municipio || '—'}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant={
                              cli.status === 'ativo'
                                ? 'default'
                                : cli.status === 'prospeccao'
                                  ? 'secondary'
                                  : 'outline'
                            }
                            className="text-[10px] capitalize"
                          >
                            {cli.status || 'ativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground py-3 max-w-xs truncate">
                          {cli.observacoes || '—'}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right py-3">
                            <div className="flex items-center justify-end gap-1">
                              {/* Transferir */}
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Transferir para outro distribuidor"
                                onClick={() => {
                                  setClienteParaTransferir(cli)
                                  setModalTransferOpen(true)
                                }}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </Button>

                              {/* Excluir com diálogo de confirmação */}
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Excluir da carteira"
                                onClick={() => {
                                  setClienteParaExcluir(cli)
                                  setDialogExcluirOpen(true)
                                }}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO (Requisito 2.3: diálogo do projeto) */}
      <Dialog open={dialogExcluirOpen} onOpenChange={setDialogExcluirOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Excluir Cliente da Carteira
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground text-sm">
              Excluir <strong>{clienteParaExcluir?.nome_cliente}</strong> da carteira da{' '}
              <strong>{distribuidor.nome}</strong>?
              <br />
              <span className="text-muted-foreground text-xs block mt-1">
                Esta ação não pode ser desfeita. O registro será gravado no log de auditoria.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={deletingCliente}
              onClick={() => setDialogExcluirOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingCliente}
              onClick={handleConfirmDeleteCliente}
            >
              {deletingCliente ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL EDITAR DISTRIBUIDOR */}
      <DistribuidorFormModal
        open={modalEditOpen}
        onOpenChange={setModalEditOpen}
        distribuidor={distribuidor}
        onSuccess={(updated) => {
          setDistribuidor(updated)
        }}
      />

      {/* MODAL REGISTRAR COMPRA */}
      <CompraFormModal
        open={modalCompraOpen}
        onOpenChange={setModalCompraOpen}
        distribuidorId={distribuidor.id}
        distribuidorNome={distribuidor.nome}
        onSuccess={(novaCompra) => {
          setCompras((prev) => [novaCompra, ...prev])
        }}
      />

      {/* MODAL INCLUIR CLIENTE */}
      <ClienteDistribuidorModal
        open={modalClienteOpen}
        onOpenChange={setModalClienteOpen}
        distribuidorId={distribuidor.id}
        distribuidorNome={distribuidor.nome}
        onSuccess={(novoCliente) => {
          setClientes((prev) => [novoCliente, ...prev])
        }}
      />

      {/* MODAL IMPORTAÇÃO EM LOTE */}
      <ImportarClientesLoteModal
        open={modalImportLoteOpen}
        onOpenChange={setModalImportLoteOpen}
        distribuidorId={distribuidor.id}
        distribuidorNome={distribuidor.nome}
        onSuccess={async () => {
          const updatedClientes = await getClientesDistribuidor(distribuidor.id)
          setClientes(updatedClientes)
        }}
      />

      {/* MODAL TRANSFERIR CLIENTE */}
      <TransferirClienteModal
        open={modalTransferOpen}
        onOpenChange={setModalTransferOpen}
        cliente={clienteParaTransferir}
        distribuidorOrigem={distribuidor}
        distribuidoresDisponiveis={todosDistribuidores}
        onSuccess={async () => {
          const updatedClientes = await getClientesDistribuidor(distribuidor.id)
          setClientes(updatedClientes)
        }}
      />
    </div>
  )
}
