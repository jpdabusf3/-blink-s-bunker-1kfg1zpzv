import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn, formatCurrency, formatCurrencyUSD, isStale } from '@/lib/utils'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { getMetasPorPeriodo, type Meta } from '@/services/metas'
import type {
  CompraDistribuidor,
  ClienteDistribuidor,
  Distribuidor,
} from '@/services/distribuidores-service'
import { getStageTheme } from '@/components/funil/stageTheme'
import pb from '@/lib/pocketbase/client'
import type { FunnelStage } from '@/types'

/**
 * Seções extras do Modo Monitor: visões condensadas dos dados que vivem nas
 * outras abas (Funil, Resumo/Metas, Distribuidores). Consumem as MESMAS
 * coleções das abas correspondentes e assinam tempo real via useRealtimeData —
 * nenhuma aba existante é alterada.
 */

const FUNNEL_STAGES: FunnelStage[] = [
  'Lead',
  'Primeiro Contato',
  'Diagnóstico Técnico',
  'Apresentação',
  'Teste/Trial',
  'Proposta',
  'Negociação',
  'Fechamento',
  'Pós-venda',
  'Perda',
]

const INATIVIDADE_COMPRA_DIAS = 60

function MonitorEmptyState() {
  return <p className="text-sm text-[#A1A1AA] italic py-6 text-center">Nenhum dado registrado</p>
}

function MonitorCard({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs uppercase tracking-[0.08em] font-semibold text-[#A1A1AA] truncate">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </Card>
  )
}

function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] text-center flex flex-col justify-center items-center p-4">
      <h4 className="uppercase tracking-[0.08em] font-semibold text-[12px] text-[#A1A1AA] mb-1 leading-tight">
        {label}
      </h4>
      <div className="text-[24px] font-bold tabular-nums text-white tracking-tight">{value}</div>
    </Card>
  )
}

function formatTon(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`
}

function daysSince(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

// ---------------------------------------------------------------------------
// 1. FUNIL — contagem e potencial por etapa + follow-ups sem interação recente
// ---------------------------------------------------------------------------

export function MonitorFunilSection() {
  const factories = useScopedFactories()

  const stageRows = useMemo(
    () =>
      FUNNEL_STAGES.map((stage) => {
        const items = factories.filter((f) => f.funnelStage === stage)
        return {
          stage,
          count: items.length,
          value: items.reduce((s, f) => s + (f.potentialValue || 0), 0),
        }
      }),
    [factories],
  )

  const followUps = useMemo(() => {
    return factories
      .filter((f) => isStale(f.lastInteraction) && f.funnelStage !== 'Perda')
      .map((f) => ({
        id: f.id,
        name: f.name,
        stage: f.funnelStage,
        days: daysSince(f.lastInteraction),
      }))
      .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity))
      .slice(0, 8)
  }, [factories])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <MonitorCard
        title="Funil — Etapas e Potencial"
        right={
          <span className="text-[11px] tabular-nums text-[#A1A1AA]">
            {factories.length} cliente{factories.length === 1 ? '' : 's'}
          </span>
        }
      >
        {factories.length === 0 ? (
          <MonitorEmptyState />
        ) : (
          <div className="space-y-1.5">
            {stageRows.map(({ stage, count, value }) => {
              const theme = getStageTheme(stage)
              return (
                <div
                  key={stage}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 bg-[#232329]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn('inline-block w-2 h-2 rounded-full shrink-0', theme.dot)}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-white truncate">{stage}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono tabular-nums text-[#A1A1AA] w-8 text-right">
                      {count}
                    </span>
                    <span
                      className="text-sm font-bold tabular-nums w-28 text-right"
                      style={{ color: '#E5B64E' }}
                    >
                      {formatCurrency(value)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </MonitorCard>

      <MonitorCard
        title="Follow-ups — Sem interação recente"
        right={
          <span className="text-[11px] tabular-nums text-amber-400 font-semibold">
            {followUps.length} cliente{followUps.length === 1 ? '' : 's'}
          </span>
        }
      >
        {factories.length === 0 ? (
          <MonitorEmptyState />
        ) : followUps.length === 0 ? (
          <p className="text-sm text-emerald-400 py-6 text-center">
            Nenhum follow-up pendente — carteira em dia
          </p>
        ) : (
          <div className="space-y-1.5">
            {followUps.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 bg-[#232329]"
              >
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{f.name}</div>
                  <div className="text-[11px] text-[#A1A1AA] truncate">{f.stage}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  {f.days === null ? '—' : f.days <= 0 ? 'hoje' : `${f.days} dias`}
                </span>
              </div>
            ))}
          </div>
        )}
      </MonitorCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. METAS — quadro Metas por Vendedor e Segmento do mês corrente (aba Resumo)
// ---------------------------------------------------------------------------

export function MonitorMetasSection() {
  const periodo = useMemo(() => {
    const d = new Date()
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  }, [])

  const [metas, setMetas] = useState<Meta[] | null>(null)

  const load = useCallback(async () => {
    try {
      setMetas(await getMetasPorPeriodo(periodo.mes, periodo.ano))
    } catch {
      setMetas([])
    }
  }, [periodo.mes, periodo.ano])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeData('metas', load)

  const rows = useMemo(() => metas?.filter((m) => m.vendedor || m.vendedor_nome) || [], [metas])

  return (
    <MonitorCard
      title={`Metas por Vendedor e Segmento — ${String(periodo.mes).padStart(2, '0')}/${periodo.ano}`}
      right={
        <span className="text-[11px] tabular-nums text-[#A1A1AA]">
          {rows.length} linha{rows.length === 1 ? '' : 's'}
        </span>
      }
    >
      {metas === null ? null : rows.length === 0 ? (
        <MonitorEmptyState />
      ) : (
        <div className="space-y-1.5">
          {rows.map((m) => {
            const vendedor = m.vendedor_nome || m.vendedor || m.expand?.vendedor_id?.nome || '—'
            const meta = m.valor_meta ?? m.meta_valor ?? 0
            const realizado = m.valor_realizado ?? 0
            const pct = meta > 0 ? (realizado / meta) * 100 : null
            const barColor =
              pct === null
                ? 'bg-[#3A3A42]'
                : pct >= 100
                  ? 'bg-emerald-500'
                  : pct >= 70
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
            const pctColor =
              pct === null
                ? 'text-[#A1A1AA]'
                : pct >= 100
                  ? 'text-emerald-400'
                  : pct >= 70
                    ? 'text-amber-400'
                    : 'text-rose-400'
            return (
              <div key={m.id} className="rounded-lg px-2 py-1.5 bg-[#232329]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-white truncate">{vendedor}</span>
                    {m.segmento && (
                      <span className="text-[10px] font-semibold px-1.5 py-0 rounded-full bg-[#3A3A42] text-[#A1A1AA] shrink-0">
                        {m.segmento}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-xs text-[#A1A1AA]">{formatCurrency(meta)}</span>
                    <span className="text-sm font-bold" style={{ color: '#E5B64E' }}>
                      {formatCurrency(realizado)}
                    </span>
                    <span className={cn('text-xs font-semibold w-14 text-right', pctColor)}>
                      {pct === null ? '—' : `${Math.round(pct)}%`}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-[#3A3A42] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', barColor)}
                    style={{ width: `${pct === null ? 0 : Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </MonitorCard>
  )
}

// ---------------------------------------------------------------------------
// 3. DISTRIBUIDORES — KPIs da lista geral + alerta de 60+ dias sem compra
// ---------------------------------------------------------------------------

export function MonitorDistribuidoresSection() {
  const [distribuidores, setDistribuidores] = useState<Distribuidor[] | null>(null)
  const [compras, setCompras] = useState<CompraDistribuidor[] | null>(null)
  const [clientes, setClientes] = useState<ClienteDistribuidor[] | null>(null)

  const loadDistribuidores = useCallback(async () => {
    try {
      setDistribuidores(await pb.collection('distribuidores').getFullList<Distribuidor>())
    } catch {
      setDistribuidores([])
    }
  }, [])

  const loadCompras = useCallback(async () => {
    try {
      setCompras(await pb.collection('compras_distribuidor').getFullList<CompraDistribuidor>())
    } catch {
      setCompras([])
    }
  }, [])

  const loadClientes = useCallback(async () => {
    try {
      setClientes(await pb.collection('clientes_distribuidor').getFullList<ClienteDistribuidor>())
    } catch {
      setClientes([])
    }
  }, [])

  useEffect(() => {
    void loadDistribuidores()
  }, [loadDistribuidores])
  useEffect(() => {
    void loadCompras()
  }, [loadCompras])
  useEffect(() => {
    void loadClientes()
  }, [loadClientes])

  useRealtimeData('distribuidores', loadDistribuidores)
  useRealtimeData('compras_distribuidor', loadCompras)
  useRealtimeData('clientes_distribuidor', loadClientes)

  const kpis = useMemo(() => {
    const dists = distribuidores || []
    const comprasList = compras || []
    return {
      ativos: dists.filter((d) => d.status === 'ativo').length,
      totalClientes: (clientes || []).length,
      ton: comprasList.reduce((s, c) => s + (c.toneladas || 0), 0),
      brl: comprasList.reduce((s, c) => s + (c.valor_brl || 0), 0),
      usd: comprasList.reduce((s, c) => s + (c.valor_usd || 0), 0),
    }
  }, [distribuidores, compras, clientes])

  const alerts = useMemo(() => {
    if (!distribuidores || !compras) return []
    const lastByDist = new Map<string, number>()
    for (const c of compras) {
      const t = new Date(c.data).getTime()
      if (isNaN(t)) continue
      const cur = lastByDist.get(c.distribuidor_id)
      if (cur === undefined || t > cur) lastByDist.set(c.distribuidor_id, t)
    }
    return distribuidores
      .map((d) => {
        const last = lastByDist.get(d.id)
        if (last === undefined) return null
        const days = Math.floor((Date.now() - last) / 86400000)
        return days >= INATIVIDADE_COMPRA_DIAS ? { id: d.id, nome: d.nome, days } : null
      })
      .filter((a): a is { id: string; nome: string; days: number } => a !== null)
      .sort((a, b) => b.days - a.days)
      .slice(0, 8)
  }, [distribuidores, compras])

  if (distribuidores === null && compras === null && clientes === null) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiTile label="Distribuidores Ativos" value={kpis.ativos} />
        <KpiTile label="Clientes na Carteira" value={kpis.totalClientes} />
        <KpiTile label="Ton" value={formatTon(kpis.ton)} />
        <KpiTile label="R$" value={formatCurrency(kpis.brl)} />
        <KpiTile label="US$" value={formatCurrencyUSD(kpis.usd)} />
      </div>

      <MonitorCard
        title={`Alerta — ${INATIVIDADE_COMPRA_DIAS}+ dias sem compra`}
        right={
          <span className="text-[11px] tabular-nums text-amber-400 font-semibold">
            {alerts.length} alerta{alerts.length === 1 ? '' : 's'}
          </span>
        }
      >
        {distribuidores !== null && distribuidores.length === 0 ? (
          <MonitorEmptyState />
        ) : alerts.length === 0 ? (
          <p className="text-sm text-emerald-400 py-4 text-center">
            Nenhum distribuidor com alerta de inatividade
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 bg-[#232329]"
              >
                <span className="text-sm text-white truncate">{a.nome}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  {a.days} dias
                </span>
              </div>
            ))}
          </div>
        )}
      </MonitorCard>
    </div>
  )
}
