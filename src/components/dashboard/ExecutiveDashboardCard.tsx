import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { useAppContext } from '@/store/AppContext'
import { getMetas, type Meta } from '@/services/metas'
import { getHistoricoVendas, type HistoricoVenda } from '@/services/historico-vendas'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils'

export function ExecutiveDashboardCard() {
  const { factories } = useAppContext()
  const [metas, setMetas] = useState<Meta[]>([])
  const [vendas, setVendas] = useState<HistoricoVenda[]>([])
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [m, v, g] = await Promise.all([getMetas(), getHistoricoVendas(), getGestaoTecnica()])
      setMetas(m)
      setVendas(v)
      setGestores(g)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('metas', () => {
    loadData()
  })
  useRealtime('historico_vendas', () => {
    loadData()
  })
  useRealtime('factories', () => {
    loadData()
  })

  const kpis = useMemo(() => {
    const funnelValue = factories.reduce((s, f) => s + (f.valor_medio || 0), 0)
    const dist = {
      Ativo: factories.filter((f) => f.funnelStage === 'Fechamento').length,
      Inativo: factories.filter((f) => f.funnelStage === 'Pós-venda').length,
      Encerradas: factories.filter((f) => f.funnelStage === 'Perda').length,
    }
    const totalMeta = metas.reduce((s, m) => s + (m.meta_valor || 0), 0)
    const totalRealizado = metas.reduce((s, m) => s + (m.valor_realizado || 0), 0)
    const totalVendas = vendas.reduce((s, v) => s + (v.valor || 0), 0)
    return { funnelValue, dist, totalMeta, totalRealizado, totalVendas }
  }, [factories, metas, vendas])

  const momData = useMemo(() => {
    const now = new Date()
    const cur = { m: now.getMonth(), y: now.getFullYear() }
    const prevD = new Date(cur.y, cur.m - 1, 1)
    const prev = { m: prevD.getMonth(), y: prevD.getFullYear() }
    const sum = (arr: HistoricoVenda[], m: number, y: number) =>
      arr
        .filter((v) => {
          const d = new Date(v.data)
          return d.getMonth() === m && d.getFullYear() === y
        })
        .reduce((s, v) => s + v.valor, 0)
    return [
      { name: 'Mês Anterior', Vendas: sum(vendas, prev.m, prev.y) },
      { name: 'Mês Atual', Vendas: sum(vendas, cur.m, cur.y) },
    ]
  }, [vendas])

  const vendorRanking = useMemo(() => {
    const byVendor = new Map<string, number>()
    vendas.forEach((v) => {
      const id = v.vendedor_id || v.gestor_tecnico_id || ''
      if (id) byVendor.set(id, (byVendor.get(id) || 0) + (v.valor || 0))
    })
    const metaByVendor = new Map<string, number>()
    metas.forEach((m) => {
      const id = m.vendedor_id || m.gestor_tecnico_id || ''
      if (id) metaByVendor.set(id, (metaByVendor.get(id) || 0) + (m.meta_valor || 0))
    })
    const gMap = new Map(gestores.map((g) => [g.id, g.nome]))
    return Array.from(byVendor.entries())
      .map(([id, valor]) => ({
        id,
        nome: gMap.get(id) || 'N/A',
        valor,
        meta: metaByVendor.get(id) || 0,
        pct: metaByVendor.get(id) ? (valor / (metaByVendor.get(id) as number)) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
  }, [vendas, metas, gestores])

  if (loading) {
    return (
      <Card className="shadow-subtle">
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando dashboard executivo...
        </CardContent>
      </Card>
    )
  }

  const kpiCards = [
    {
      label: 'Valor Total Funil',
      value: formatCompactCurrency(kpis.funnelValue),
      color: 'text-primary',
    },
    {
      label: 'Status Funil (A/I/Enc)',
      value: `${kpis.dist.Ativo}/${kpis.dist.Inativo}/${kpis.dist.Encerradas}`,
      color: '',
    },
    {
      label: 'Realizado / Meta',
      value: `${formatCompactCurrency(kpis.totalRealizado)} / ${formatCompactCurrency(kpis.totalMeta)}`,
      color: 'text-primary',
    },
    {
      label: 'Total Vendas',
      value: formatCompactCurrency(kpis.totalVendas),
      color: 'text-primary',
    },
  ]

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Dashboard Executivo Consolidado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((k, i) => (
            <div key={i} className="text-center p-3 bg-muted/40 rounded-lg">
              <p className="text-[11px] text-muted-foreground mb-1 leading-tight">{k.label}</p>
              <p className={`text-sm font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-[240px]">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Comparativo Mensal de Vendas
            </p>
            <ChartContainer
              config={{ Vendas: { label: 'Vendas (R$)', color: 'hsl(var(--primary))' } }}
              className="h-[200px] w-full"
            >
              <BarChart data={momData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="Vendas"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ChartContainer>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Ranking de Vendedores
            </p>
            <div className="space-y-1">
              {vendorRanking.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem dados de vendadores</p>
              )}
              {vendorRanking.map((v, i) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted-foreground w-5">{i + 1}º</span>
                    <span className="font-medium truncate max-w-[120px]">{v.nome}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{formatCurrency(v.valor)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {v.pct.toFixed(0)}% da meta
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
