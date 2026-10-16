import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Building2,
  Users,
  Weight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import {
  getDistribuidores,
  getComprasDistribuidor,
  getClientesDistribuidor,
  canEditDistribuidores,
  type Distribuidor,
  type CompraDistribuidor,
  type ClienteDistribuidor,
} from '@/services/distribuidores-service'
import { DistribuidorFormModal } from '@/components/distribuidores/DistribuidorFormModal'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export default function DistribuidoresPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = canEditDistribuidores(user)

  // Estados de dados
  const [distribuidores, setDistribuidores] = useState<Distribuidor[]>([])
  const [compras, setCompras] = useState<CompraDistribuidor[]>([])
  const [clientes, setClientes] = useState<ClienteDistribuidor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [periodo, setPeriodo] = useState<'12m' | 'mes' | 'trimestre' | 'ano' | 'tudo'>('12m')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [busca, setBusca] = useState('')

  // Modal novo distribuidor
  const [modalNovoOpen, setModalNovoOpen] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [distList, comprasList, clientesList] = await Promise.all([
        getDistribuidores(),
        getComprasDistribuidor(),
        getClientesDistribuidor(),
      ])
      setDistribuidores(distList)
      setCompras(comprasList)
      setClientes(clientesList)
    } catch (err: any) {
      console.error('[DistribuidoresPage] Erro ao carregar dados:', err)
      setError('Não foi possível carregar as informações dos distribuidores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Range de datas conforme o período selecionado
  const dateRanges = useMemo(() => {
    const now = new Date()
    let startAtual = new Date()
    let startAnterior = new Date()
    let endAnterior = new Date()

    if (periodo === 'mes') {
      startAtual = new Date(now.getFullYear(), now.getMonth(), 1)
      startAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endAnterior = new Date(now.getFullYear(), now.getMonth(), 0)
    } else if (periodo === 'trimestre') {
      startAtual = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      startAnterior = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      endAnterior = new Date(now.getFullYear(), now.getMonth() - 3, 0)
    } else if (periodo === 'ano') {
      startAtual = new Date(now.getFullYear(), 0, 1)
      startAnterior = new Date(now.getFullYear() - 1, 0, 1)
      endAnterior = new Date(now.getFullYear() - 1, 11, 31)
    } else if (periodo === '12m') {
      // Últimos 12 meses (padrão)
      startAtual = new Date(now.getTime() - 365 * 24 * 3600 * 1000)
      startAnterior = new Date(now.getTime() - 2 * 365 * 24 * 3600 * 1000)
      endAnterior = new Date(now.getTime() - 365 * 24 * 3600 * 1000)
    } else {
      // 'tudo'
      startAtual = new Date(2000, 0, 1)
      startAnterior = new Date(1990, 0, 1)
      endAnterior = new Date(1999, 11, 31)
    }

    return { startAtual, startAnterior, endAnterior, now }
  }, [periodo])

  // Processamento e agregações por distribuidor
  const distribuidoresProcessados = useMemo(() => {
    const { startAtual, startAnterior, endAnterior, now } = dateRanges

    return distribuidores.map((dist) => {
      // Clientes vinculados
      const distClientes = clientes.filter((c) => c.distribuidor_id === dist.id)
      const distCompras = compras.filter((c) => c.distribuidor_id === dist.id)

      // Compras do período atual
      const comprasAtual = distCompras.filter((c) => {
        const d = new Date(c.data)
        return d >= startAtual && d <= now
      })

      // Compras do período anterior para variação delta
      const comprasAnterior = distCompras.filter((c) => {
        const d = new Date(c.data)
        return d >= startAnterior && d < endAnterior
      })

      const totalTon = comprasAtual.reduce((acc, c) => acc + (c.toneladas || 0), 0)
      const totalBrl = comprasAtual.reduce((acc, c) => acc + (c.valor_brl || 0), 0)
      const totalUsd = comprasAtual.reduce((acc, c) => acc + (c.valor_usd || 0), 0)

      const antBrl = comprasAnterior.reduce((acc, c) => acc + (c.valor_brl || 0), 0)

      let deltaPercentual = 0
      if (antBrl > 0) {
        deltaPercentual = ((totalBrl - antBrl) / antBrl) * 100
      } else if (totalBrl > 0 && antBrl === 0) {
        deltaPercentual = 100
      }

      // Verificação de última compra (Alerta 60+ dias sem compra)
      let diasSemCompra = 999
      let ultimaCompraData: string | null = null
      if (distCompras.length > 0) {
        const sortedCompras = [...distCompras].sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
        )
        ultimaCompraData = sortedCompras[0].data
        const diffMs = now.getTime() - new Date(ultimaCompraData).getTime()
        diasSemCompra = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      }

      const alertaInatividade = diasSemCompra >= 60

      return {
        ...dist,
        total_clientes: distClientes.length,
        total_toneladas: totalTon,
        total_valor_brl: totalBrl,
        total_valor_usd: totalUsd,
        variacao_percentual: deltaPercentual,
        dias_sem_compra: diasSemCompra,
        alerta_inatividade: alertaInatividade,
      }
    })
  }, [distribuidores, compras, clientes, dateRanges])

  // Aplicar filtros de pesquisa e status
  const distribuidoresFiltrados = useMemo(() => {
    return distribuidoresProcessados.filter((d) => {
      if (statusFiltro !== 'todos' && (d.status || 'ativo') !== statusFiltro) {
        return false
      }
      if (busca.trim()) {
        const q = busca.toLowerCase().trim()
        const matchNome = d.nome.toLowerCase().includes(q)
        const matchCnpj = (d.cnpj || '').toLowerCase().includes(q)
        const matchUfs = (d.ufs_atuacao || []).some((uf) => uf.toLowerCase().includes(q))
        return matchNome || matchCnpj || matchUfs
      }
      return true
    })
  }, [distribuidoresProcessados, statusFiltro, busca])

  // Totais agregados do topo (Cards KPI)
  const kpiTotais = useMemo(() => {
    const ativos = distribuidoresFiltrados.filter((d) => (d.status || 'ativo') === 'ativo').length
    const totalClientes = distribuidoresFiltrados.reduce(
      (acc, d) => acc + (d.total_clientes || 0),
      0,
    )
    const totalTon = distribuidoresFiltrados.reduce((acc, d) => acc + (d.total_toneladas || 0), 0)
    const totalBrl = distribuidoresFiltrados.reduce((acc, d) => acc + (d.total_valor_brl || 0), 0)
    const totalUsd = distribuidoresFiltrados.reduce((acc, d) => acc + (d.total_valor_usd || 0), 0)
    const comAlerta = distribuidoresFiltrados.filter((d) => d.alerta_inatividade).length

    return { ativos, totalClientes, totalTon, totalBrl, totalUsd, comAlerta }
  }, [distribuidoresFiltrados])

  // Formatadores pt-BR
  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  const formatUSD = (val: number) =>
    `US$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const formatTon = (val: number) =>
    `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Ton`

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Distribuidores
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-primary/10 text-primary border-primary/30"
            >
              Canal Indireto Blink
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de distribuidores parceiros, quadros de volume, clientes em carteira e
            faturamento consolidado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {canEdit && (
            <Button size="sm" onClick={() => setModalNovoOpen(true)} className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" /> Cadastrar Distribuidor
            </Button>
          )}
        </div>
      </div>

      {/* ESTADO DE ERRO */}
      {error && !loading && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
              <div>
                <h3 className="font-semibold text-destructive">
                  Não foi possível carregar os dados
                </h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button variant="outline" onClick={loadData}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CARDS DE KPI NO TOPO */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          {/* Distribuidores Ativos */}
          <Card className="border border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Distribuidores Ativos</span>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground">{kpiTotais.ativos}</div>
              <p className="text-[11px] text-muted-foreground">
                {distribuidoresFiltrados.length} no escopo do filtro
              </p>
            </CardContent>
          </Card>

          {/* Clientes na Carteira */}
          <Card className="border border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Clientes na Carteira</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-foreground">{kpiTotais.totalClientes}</div>
              <p className="text-[11px] text-muted-foreground">Contas atendidas via parceiros</p>
            </CardContent>
          </Card>

          {/* Toneladas */}
          <Card className="border border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Volume (Ton)</span>
                <Weight className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {formatTon(kpiTotais.totalTon).replace(' Ton', '')}
              </div>
              <p className="text-[11px] text-muted-foreground">Toneladas no período selecionado</p>
            </CardContent>
          </Card>

          {/* Faturamento R$ */}
          <Card className="border border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Faturamento R$</span>
                <DollarSign className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl md:text-2xl font-black text-foreground truncate">
                {formatBRL(kpiTotais.totalBrl)}
              </div>
              <p className="text-[11px] text-muted-foreground">Consolidado em Reais</p>
            </CardContent>
          </Card>

          {/* Faturamento US$ */}
          <Card className="border border-border/60 shadow-sm bg-card col-span-2 sm:col-span-1 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Faturamento US$</span>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl md:text-2xl font-black text-foreground truncate">
                {formatUSD(kpiTotais.totalUsd)}
              </div>
              <p className="text-[11px] text-muted-foreground">Consolidado em Dólares</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FILTROS E BUSCA */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por distribuidor, CNPJ ou UF..."
              className="pl-9 text-xs h-9"
            />
          </div>

          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as any)}>
            <SelectTrigger className="w-36 text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: Todos</SelectItem>
              <SelectItem value="ativo">Apenas Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Período:</span>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <SelectTrigger className="w-44 text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12m">Últimos 12 meses (padrão)</SelectItem>
              <SelectItem value="mes">Mês Atual</SelectItem>
              <SelectItem value="trimestre">Último Trimestre</SelectItem>
              <SelectItem value="ano">Ano Atual</SelectItem>
              <SelectItem value="tudo">Todo o Histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* TABELA PRINCIPAL DE DISTRIBUIDORES */}
      {loading ? (
        <Card className="p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      ) : distribuidoresFiltrados.length === 0 ? (
        /* ESTADO VAZIO */
        <Card className="border-dashed border-2 border-border/80 p-8 text-center bg-card">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="text-lg font-bold text-foreground">
            {busca || statusFiltro !== 'todos'
              ? 'Nenhum distribuidor encontrado com esses filtros'
              : 'Nenhum distribuidor cadastrado'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            {busca || statusFiltro !== 'todos'
              ? 'Tente ajustar os critérios de pesquisa ou limpar os filtros para ver outros registros.'
              : 'Comece adicionando seu primeiro distribuidor parceiro para acompanhar volumes e carteira de clientes.'}
          </p>
          {canEdit && (
            <Button onClick={() => setModalNovoOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Cadastrar Distribuidor
            </Button>
          )}
        </Card>
      ) : (
        <Card className="border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  <TableHead className="w-64 font-semibold">Distribuidor</TableHead>
                  <TableHead className="font-semibold">UFs de Atuação</TableHead>
                  <TableHead className="text-center font-semibold">Clientes na Carteira</TableHead>
                  <TableHead className="text-right font-semibold">Ton</TableHead>
                  <TableHead className="text-right font-semibold">R$</TableHead>
                  <TableHead className="text-right font-semibold">US$</TableHead>
                  <TableHead className="text-center font-semibold">
                    Δ% vs Período Anterior
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distribuidoresFiltrados.map((dist) => (
                  <TableRow
                    key={dist.id}
                    onClick={() => navigate(`/distribuidores/${dist.id}`)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group text-xs"
                  >
                    {/* Nome + Status + Alerta */}
                    <TableCell className="font-medium py-3.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                            {dist.nome}
                          </span>
                          {dist.status === 'inativo' && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        {dist.cnpj && (
                          <span className="text-[11px] text-muted-foreground">
                            CNPJ: {dist.cnpj}
                          </span>
                        )}
                        {dist.alerta_inatividade && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Sem compras há {dist.dias_sem_compra} dias (Requer atenção)</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* UFs de Atuação */}
                    <TableCell className="py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {dist.ufs_atuacao && dist.ufs_atuacao.length > 0 ? (
                          dist.ufs_atuacao.map((uf) => (
                            <Badge
                              key={uf}
                              variant="secondary"
                              className="text-[10px] font-semibold px-1.5 py-0"
                            >
                              {uf}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">
                            Não informado
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Clientes na Carteira */}
                    <TableCell className="text-center py-3.5">
                      <span className="inline-flex items-center justify-center font-bold px-2.5 py-0.5 rounded-full bg-muted text-foreground text-xs">
                        {dist.total_clientes}
                      </span>
                    </TableCell>

                    {/* Toneladas */}
                    <TableCell className="text-right font-semibold text-foreground py-3.5">
                      {formatTon(dist.total_toneladas || 0)}
                    </TableCell>

                    {/* R$ */}
                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400 py-3.5">
                      {formatBRL(dist.total_valor_brl || 0)}
                    </TableCell>

                    {/* US$ */}
                    <TableCell className="text-right font-semibold text-indigo-600 dark:text-indigo-400 py-3.5">
                      {formatUSD(dist.total_valor_usd || 0)}
                    </TableCell>

                    {/* Delta % */}
                    <TableCell className="text-center py-3.5">
                      {dist.variacao_percentual !== undefined ? (
                        <div
                          className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                            dist.variacao_percentual >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {dist.variacao_percentual >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {dist.variacao_percentual >= 0 ? '+' : ''}
                            {dist.variacao_percentual.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Ícone de seta */}
                    <TableCell className="text-right py-3.5">
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Modal de cadastro de distribuidor */}
      <DistribuidorFormModal
        open={modalNovoOpen}
        onOpenChange={setModalNovoOpen}
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}
