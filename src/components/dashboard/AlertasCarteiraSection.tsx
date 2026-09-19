import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  RefreshCw,
  BellRing,
  Calendar,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { PedidoCarteira } from '@/services/pedidos-carteira'
import type { PedidoRecord } from '@/services/gestao-pedidos'
import type { Order } from '@/types'

export type AlertSeverity = 'critical' | 'risk' | 'warning'

export interface PortfolioAlert {
  id: string
  rule: 'A' | 'B' | 'C'
  severity: AlertSeverity
  message: string
  affectedMonth?: string
  ano?: number
  mesNum?: number
}

export interface MonthProjection {
  ano: number
  mes: number
  monthName: string
  monthShort: string
  label: string
  totalValor: number
  orderCount: number
}

const MONTH_NAMES_PT = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MONTH_SHORT_PT = [
  '',
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

/**
 * Normaliza strings de mês em português para número 1..12
 */
export function parseMonthToNumber(rawMes?: string | null): number | null {
  if (!rawMes) return null
  const clean = rawMes
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const num = parseInt(clean, 10)
  if (!isNaN(num) && num >= 1 && num <= 12) return num

  const monthsMap: Record<string, number> = {
    jan: 1,
    janeiro: 1,
    fev: 2,
    fevereiro: 2,
    mar: 3,
    marco: 3,
    abr: 4,
    abril: 4,
    mai: 5,
    maio: 5,
    jun: 6,
    junho: 6,
    jul: 7,
    julho: 7,
    ago: 8,
    agosto: 8,
    set: 9,
    setembro: 9,
    out: 10,
    outubro: 10,
    nov: 11,
    novembro: 11,
    dez: 12,
    dezembro: 12,
  }

  for (const [key, val] of Object.entries(monthsMap)) {
    if (clean === key || clean.startsWith(key)) {
      return val
    }
  }

  return null
}

export interface ComputeAlertsParams {
  pedidosCarteira: PedidoCarteira[]
  pedidosAbertos?: PedidoRecord[]
  globalOrders?: Order[]
  currentYear?: number
  currentMonth?: number
  windowMonths?: number
}

/**
 * Computa projeções e alertas de carteira com base nos requisitos:
 * - Regra A - Queda projetada: se o total de um mês for inferior a 70% da média dos outros meses projetados,
 *   cria alerta de 'warning' com a mensagem: "{Mês}: {R$ X} projetados, queda de {Y}% versus a média da carteira".
 * - Regra B - Concentração de cliente: se um único cliente representar mais de 80% do total da carteira,
 *   cria alerta de 'risk' com o nome do cliente e sua participação percentual.
 * - Regra C - Mês vazio: se um mês projetado tiver zero pedidos,
 *   cria alerta 'critical' com "Nenhum pedido em carteira para {Mês}".
 */
export function computePortfolioAlerts({
  pedidosCarteira = [],
  pedidosAbertos = [],
  globalOrders = [],
  currentYear = new Date().getFullYear(),
  currentMonth = new Date().getMonth() + 1,
  windowMonths = 6,
}: ComputeAlertsParams): {
  alerts: PortfolioAlert[]
  projections: MonthProjection[]
  totalCarteira: number
  referenceDateText: string
} {
  // 1. Data de referência da carteira
  let latestDate: Date | null = null
  for (const pc of pedidosCarteira) {
    if (pc.atualizado_em) {
      const d = new Date(pc.atualizado_em)
      if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) {
        latestDate = d
      }
    } else if (pc.updated) {
      const d = new Date(pc.updated)
      if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) {
        latestDate = d
      }
    } else if (pc.created) {
      const d = new Date(pc.created)
      if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) {
        latestDate = d
      }
    }
  }

  const referenceDateText = latestDate
    ? latestDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })

  // 2. Construir lista de meses projetados a partir do mês atual corrente
  const projections: MonthProjection[] = []
  for (let i = 0; i < windowMonths; i++) {
    let targetM = currentMonth + i
    let targetY = currentYear
    while (targetM > 12) {
      targetM -= 12
      targetY += 1
    }
    const mName = MONTH_NAMES_PT[targetM] || `Mês ${targetM}`
    const mShort = MONTH_SHORT_PT[targetM] || `M${targetM}`
    const label = `${mName}/${targetY}`

    projections.push({
      ano: targetY,
      mes: targetM,
      monthName: mName,
      monthShort: mShort,
      label,
      totalValor: 0,
      orderCount: 0,
    })
  }

  // 3. Agregar valores e contagem de pedidos por mês
  // a) De pedidos_carteira (reaproveitando formato do Resumo)
  for (const pc of pedidosCarteira) {
    const val = Number(pc.valor) || 0
    const mNum = parseMonthToNumber(pc.mes)
    const pcAno = (pc as unknown as { ano?: number }).ano

    for (const proj of projections) {
      const matchesMonth = mNum !== null ? mNum === proj.mes : false
      const matchesYear = pcAno ? pcAno === proj.ano : true

      if (matchesMonth && matchesYear) {
        proj.totalValor += val
        proj.orderCount += 1
      }
    }
  }

  // b) De pedidos abertos (gestao_pedidos)
  for (const po of pedidosAbertos) {
    if (po.status === 'ABERTO' && po.dataEntregaPrevista) {
      const parts = po.dataEntregaPrevista.slice(0, 7).split('-')
      if (parts.length === 2) {
        const py = parseInt(parts[0], 10)
        const pm = parseInt(parts[1], 10)
        const val = Number(po.valorTotal) || 0

        for (const proj of projections) {
          if (proj.ano === py && proj.mes === pm) {
            proj.totalValor += val
            proj.orderCount += 1
          }
        }
      }
    }
  }

  // c) Se todos os meses forem 0 mas houver globalOrders abertos no período
  const totalInProjections = projections.reduce((s, p) => s + p.totalValor, 0)
  if (totalInProjections === 0 && globalOrders.length > 0) {
    for (const ord of globalOrders) {
      const oVal = Number(ord.totalValue) || 0
      if (ord.orderDate) {
        const d = new Date(ord.orderDate)
        if (!isNaN(d.getTime())) {
          const oy = d.getFullYear()
          const om = d.getMonth() + 1
          for (const proj of projections) {
            if (proj.ano === oy && proj.mes === om) {
              proj.totalValor += oVal
              proj.orderCount += 1
            }
          }
        }
      }
    }
  }

  // 4. Concentração de clientes no total da carteira
  // Mapear clientes da coleção pedidos_carteira, pedidosAbertos e globalOrders
  const clientTotals = new Map<string, number>()
  let totalCarteiraGeral = 0

  for (const pc of pedidosCarteira) {
    const cName = ((pc as unknown as { cliente?: string }).cliente || pc.marca || 'Outro').trim()
    const val = Number(pc.valor) || 0
    if (val > 0) {
      clientTotals.set(cName, (clientTotals.get(cName) || 0) + val)
      totalCarteiraGeral += val
    }
  }

  for (const po of pedidosAbertos) {
    if (po.status === 'ABERTO') {
      const cName = (po.expand?.clienteId?.name || po.clienteId || 'Outro').trim()
      const val = Number(po.valorTotal) || 0
      if (val > 0) {
        clientTotals.set(cName, (clientTotals.get(cName) || 0) + val)
        totalCarteiraGeral += val
      }
    }
  }

  if (totalCarteiraGeral === 0 && globalOrders.length > 0) {
    for (const ord of globalOrders) {
      const cName = (ord.factoryId || 'Outro').trim()
      const val = Number(ord.totalValue) || 0
      if (val > 0) {
        clientTotals.set(cName, (clientTotals.get(cName) || 0) + val)
        totalCarteiraGeral += val
      }
    }
  }

  const generatedAlerts: PortfolioAlert[] = []

  // REGRA C: Empty month - Se um mês projetado tem zero pedidos => alerta CRÍTICO
  // "Nenhum pedido em carteira para {Mês}"
  for (const proj of projections) {
    if (proj.orderCount === 0 || proj.totalValor === 0) {
      generatedAlerts.push({
        id: `empty-month-${proj.ano}-${proj.mes}`,
        rule: 'C',
        severity: 'critical',
        message: `Nenhum pedido em carteira para ${proj.monthName}`,
        affectedMonth: proj.monthName,
        ano: proj.ano,
        mesNum: proj.mes,
      })
    }
  }

  // REGRA B: Client concentration - Se um único cliente representar > 80% do total da carteira => alerta de RISCO
  // "com o nome do cliente e sua porcentagem de participação"
  if (totalCarteiraGeral > 0) {
    for (const [clientName, val] of clientTotals.entries()) {
      const share = (val / totalCarteiraGeral) * 100
      if (share > 80) {
        const shareFormatted = Math.round(share)
        generatedAlerts.push({
          id: `client-concentration-${clientName}`,
          rule: 'B',
          severity: 'risk',
          message: `Alta concentração de carteira: cliente "${clientName}" representa ${shareFormatted}% do total da carteira`,
          affectedMonth: undefined,
        })
      }
    }
  }

  // REGRA A: Projected drop - Se o total de um mês for inferior a 70% da média dos outros meses projetados => alerta WARNING
  // Padrão: "{Mês}: R$ {valor} projetados, queda de {X}% versus a média da carteira"
  // Só avalia se o mês não for vazio (já coberto pela Regra C como crítico) e se houver outros meses com valor
  for (let i = 0; i < projections.length; i++) {
    const cur = projections[i]
    if (cur.orderCount === 0 || cur.totalValor === 0) {
      // Já gerou alerta crítico (Regra C)
      continue
    }

    const otherProjections = projections.filter((_, idx) => idx !== i)
    const otherSum = otherProjections.reduce((s, p) => s + p.totalValor, 0)
    const otherAvg = otherProjections.length > 0 ? otherSum / otherProjections.length : 0

    if (otherAvg > 0) {
      const threshold = otherAvg * 0.7
      if (cur.totalValor < threshold) {
        const dropPct = Math.round(((otherAvg - cur.totalValor) / otherAvg) * 100)
        const valorFormatado = formatCurrency(cur.totalValor)
        generatedAlerts.push({
          id: `drop-${cur.ano}-${cur.mes}`,
          rule: 'A',
          severity: 'warning',
          message: `${cur.monthName}: ${valorFormatado} projetados, queda de ${dropPct}% versus a média da carteira`,
          affectedMonth: cur.monthName,
          ano: cur.ano,
          mesNum: cur.mes,
        })
      }
    }
  }

  // Ordenação por severidade: critical primeiro, depois risk, depois warning
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 1,
    risk: 2,
    warning: 3,
  }

  generatedAlerts.sort((a, b) => {
    const diff = severityOrder[a.severity] - severityOrder[b.severity]
    if (diff !== 0) return diff
    if (a.mesNum && b.mesNum) return a.mesNum - b.mesNum
    return 0
  })

  return {
    alerts: generatedAlerts,
    projections,
    totalCarteira: totalCarteiraGeral,
    referenceDateText,
  }
}

export interface AlertasCarteiraSectionProps {
  pedidosCarteira: PedidoCarteira[]
  pedidosAbertos?: PedidoRecord[]
  globalOrders?: Order[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  className?: string
}

export function AlertasCarteiraSection({
  pedidosCarteira,
  pedidosAbertos = [],
  globalOrders = [],
  isLoading = false,
  isError = false,
  onRetry,
  className,
}: AlertasCarteiraSectionProps) {
  const currentDate = useMemo(() => new Date(), [])
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  // Cálculo dos alertas e projeções
  const { alerts, referenceDateText, projections } = useMemo(() => {
    try {
      return computePortfolioAlerts({
        pedidosCarteira,
        pedidosAbertos,
        globalOrders,
        currentYear,
        currentMonth,
        windowMonths: 6,
      })
    } catch (err) {
      console.error('[AlertasCarteira] Falha no cálculo:', err)
      return {
        alerts: [] as PortfolioAlert[],
        projections: [] as MonthProjection[],
        totalCarteira: 0,
        referenceDateText: new Date().toLocaleDateString('pt-BR'),
      }
    }
  }, [pedidosCarteira, pedidosAbertos, globalOrders, currentYear, currentMonth])

  // Identificação de severidades e estilos
  const getAlertStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          cardBorder: 'border-l-red-500 border-red-500/30 bg-red-500/5 dark:bg-red-950/20',
          badgeVariant: 'destructive' as const,
          badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
          iconColor: 'text-red-500',
          icon: AlertOctagon,
          severityLabel: 'Crítico',
        }
      case 'risk':
        return {
          cardBorder: 'border-l-amber-500 border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20',
          badgeVariant: 'outline' as const,
          badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
          iconColor: 'text-amber-500',
          icon: AlertTriangle,
          severityLabel: 'Risco',
        }
      case 'warning':
        return {
          cardBorder:
            'border-l-yellow-500 border-yellow-500/30 bg-yellow-500/5 dark:bg-yellow-950/20',
          badgeVariant: 'outline' as const,
          badgeClass: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
          iconColor: 'text-yellow-500',
          icon: Info,
          severityLabel: 'Atenção',
        }
    }
  }

  // 1. ESTADO DE LOADING: Skeletons mimetizando o formato dos cards de alerta
  if (isLoading) {
    return (
      <section className={cn('space-y-3.5', className)} aria-label="Alertas de Carteira">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Alertas de Carteira
            </h2>
          </div>
          <Skeleton className="h-4 w-44" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={`alert-skel-${i}`}
              className="border-l-4 border-l-muted border-border/40 shadow-xs"
            >
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    )
  }

  // 2. ESTADO DE ERRO: Mensagem com botão de retry
  if (isError) {
    return (
      <section className={cn('space-y-3.5', className)} aria-label="Alertas de Carteira">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Alertas de Carteira
            </h2>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Data de referência: {referenceDateText}
          </span>
        </div>

        <Card className="border-l-4 border-l-destructive border-destructive/40 bg-destructive/5 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Não foi possível calcular os alertas
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ocorreu uma instabilidade ao processar a carteira de pedidos futuros.
                </p>
              </div>
            </div>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="gap-1.5 text-xs border-destructive/30 hover:bg-destructive/10"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    )
  }

  // 3. ESTADO EMPTY (Carteira Saudável): Card verde
  if (alerts.length === 0) {
    return (
      <section className={cn('space-y-3.5', className)} aria-label="Alertas de Carteira">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Alertas de Carteira
            </h2>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Data de referência: {referenceDateText}
          </span>
        </div>

        <Card className="border-l-4 border-l-emerald-500 border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs animate-fade-in">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Carteira saudável: nenhum alerta para os próximos meses
              </p>
              <p className="text-xs text-muted-foreground">
                Todos os meses projetados mantêm estabilidade de pedidos sem concentração excessiva
                de clientes.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  // 4. ESTADO SUCCESS: Animação fade-in dos cards de alerta
  return (
    <section className={cn('space-y-3.5', className)} aria-label="Alertas de Carteira">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <BellRing className="w-5 h-5 text-primary" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Alertas de Carteira</h2>
          <Badge variant="outline" className="text-xs font-mono ml-1 bg-muted/30">
            {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
          </Badge>
        </div>

        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          Data de referência da carteira: {referenceDateText}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-fade-in">
        {alerts.map((al) => {
          const style = getAlertStyles(al.severity)
          const Icon = style.icon

          return (
            <Card
              key={al.id}
              className={cn(
                'border-l-4 transition-all hover-lift shadow-xs backdrop-blur-sm',
                style.cardBorder,
              )}
            >
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4 shrink-0', style.iconColor)} />
                    <Badge
                      variant={style.badgeVariant}
                      className={cn('text-[11px] font-semibold', style.badgeClass)}
                    >
                      {style.severityLabel}
                    </Badge>
                  </div>

                  {al.affectedMonth && (
                    <span className="text-xs font-mono font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                      {al.affectedMonth}
                      {al.ano ? `/${al.ano}` : ''}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
                  {al.message}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

export default AlertasCarteiraSection
