import pb from '@/lib/pocketbase/client'
import type { HistoricoVenda } from '@/services/historico-vendas'
import type { Meta } from '@/services/metas'
import type { GestaoTecnica } from '@/services/gestao-tecnica'

export interface PerformanceFilters {
  gestorId: string
  vendedorId: string
  especie: string
  canalVendas: string
  dataInicial: string
  dataFinal: string
}

export interface MemberPerformance {
  id: string
  nome: string
  totalVendas: number
  valorTotal: number
  especieDist: Record<string, number>
  linkedDist: Record<string, number>
  metaValor: number
  valorRealizado: number
  metaAchievement: number
}

export interface PerformanceSummary {
  totalVendas: number
  valorTotal: number
  ticketMedio: number
  numClientes: number
  taxaConversao: number
}

export interface PerformanceReportData {
  summary: PerformanceSummary
  gestores: MemberPerformance[]
  vendedores: MemberPerformance[]
  gestorRanking: Array<{ id: string; nome: string; valor: number }>
  vendedorRanking: Array<{ id: string; nome: string; valor: number }>
}

export const DEFAULT_FILTERS: PerformanceFilters = {
  gestorId: 'all',
  vendedorId: 'all',
  especie: 'all',
  canalVendas: 'all',
  dataInicial: '',
  dataFinal: '',
}

function matchesFilters(v: HistoricoVenda, f: PerformanceFilters): boolean {
  if (f.gestorId !== 'all' && v.gestor_tecnico_id !== f.gestorId) return false
  if (f.vendedorId !== 'all' && v.vendedor_id !== f.vendedorId) return false
  if (f.especie !== 'all' && v.especie !== f.especie) return false
  if (f.canalVendas !== 'all' && v.canal_vendas !== f.canalVendas) return false
  if (f.dataInicial) {
    const d = new Date(v.data)
    if (d < new Date(f.dataInicial)) return false
  }
  if (f.dataFinal) {
    const d = new Date(v.data)
    if (d > new Date(f.dataFinal + 'T23:59:59')) return false
  }
  return true
}

export async function fetchPerformanceData(
  filters: PerformanceFilters,
): Promise<PerformanceReportData> {
  const [vendas, metas, gestaoTecnica, atividades] = await Promise.all([
    pb.collection('historico_vendas').getFullList<HistoricoVenda>({
      sort: '-data',
      expand: 'gestor_tecnico_id,vendedor_id',
    }),
    pb.collection('metas').getFullList<Meta>({ sort: '-created', expand: 'vendedor_id' }),
    pb.collection('gestao_tecnica').getFullList<GestaoTecnica>({ sort: 'nome' }),
    pb.collection('atividades').getFullList({ sort: '-created' }),
  ])

  const filtered = vendas.filter((v) => matchesFilters(v, filters))

  const totalVendas = filtered.length
  const valorTotal = filtered.reduce((s, v) => s + (v.valor || 0), 0)
  const ticketMedio = totalVendas > 0 ? valorTotal / totalVendas : 0
  const clientesSet = new Set(filtered.map((v) => v.cliente).filter(Boolean))

  let atvCount = (atividades as any[]).length
  if (filters.dataInicial || filters.dataFinal) {
    atvCount = (atividades as any[]).filter((a) => {
      const d = new Date(a.created)
      if (filters.dataInicial && d < new Date(filters.dataInicial)) return false
      if (filters.dataFinal && d > new Date(filters.dataFinal + 'T23:59:59')) return false
      return true
    }).length
  }
  const taxaConversao = atvCount > 0 ? (totalVendas / atvCount) * 100 : 0

  const gestorToVend = new Map<string, Set<string>>()
  const vendToGestor = new Map<string, Set<string>>()
  vendas.forEach((v) => {
    if (v.gestor_tecnico_id && v.vendedor_id) {
      if (!gestorToVend.has(v.gestor_tecnico_id)) gestorToVend.set(v.gestor_tecnico_id, new Set())
      gestorToVend.get(v.gestor_tecnico_id)!.add(v.vendedor_id)
      if (!vendToGestor.has(v.vendedor_id)) vendToGestor.set(v.vendedor_id, new Set())
      vendToGestor.get(v.vendedor_id)!.add(v.gestor_tecnico_id)
    }
  })

  const metasByVend = new Map<string, { meta: number; realizado: number }>()
  metas.forEach((m) => {
    if (!m.vendedor_id) return
    const cur = metasByVend.get(m.vendedor_id) || { meta: 0, realizado: 0 }
    cur.meta += m.meta_valor || 0
    cur.realizado += m.valor_realizado || 0
    metasByVend.set(m.vendedor_id, cur)
  })

  const idToName = new Map(gestaoTecnica.map((g) => [g.id, g.nome]))

  function buildPerf(member: GestaoTecnica, isGestor: boolean): MemberPerformance {
    const mv = filtered.filter((v) =>
      isGestor ? v.gestor_tecnico_id === member.id : v.vendedor_id === member.id,
    )
    const especieDist: Record<string, number> = {}
    mv.forEach((v) => {
      const e = v.especie || 'OUTRO'
      especieDist[e] = (especieDist[e] || 0) + 1
    })
    const linkedDist: Record<string, number> = {}
    mv.forEach((v) => {
      const lid = isGestor ? v.vendedor_id : v.gestor_tecnico_id
      if (!lid) return
      const name = idToName.get(lid) || 'N/A'
      linkedDist[name] = (linkedDist[name] || 0) + 1
    })
    let metaValor = 0
    let valorRealizado = 0
    if (isGestor) {
      gestorToVend.get(member.id)?.forEach((vid) => {
        const m = metasByVend.get(vid)
        if (m) {
          metaValor += m.meta
          valorRealizado += m.realizado
        }
      })
    } else {
      const m = metasByVend.get(member.id)
      if (m) {
        metaValor = m.meta
        valorRealizado = m.realizado
      }
    }
    return {
      id: member.id,
      nome: member.nome,
      totalVendas: mv.length,
      valorTotal: mv.reduce((s, v) => s + (v.valor || 0), 0),
      especieDist,
      linkedDist,
      metaValor,
      valorRealizado,
      metaAchievement: metaValor > 0 ? (valorRealizado / metaValor) * 100 : 0,
    }
  }

  const gestores = gestaoTecnica
    .filter((g) => g.funcao === 'gestor_tecnico')
    .map((g) => buildPerf(g, true))
  const vendedores = gestaoTecnica
    .filter((g) => g.funcao === 'vendedor')
    .map((g) => buildPerf(g, false))

  return {
    summary: { totalVendas, valorTotal, ticketMedio, numClientes: clientesSet.size, taxaConversao },
    gestores,
    vendedores,
    gestorRanking: [...gestores]
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map((g) => ({ id: g.id, nome: g.nome, valor: g.valorTotal })),
    vendedorRanking: [...vendedores]
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map((v) => ({ id: v.id, nome: v.nome, valor: v.valorTotal })),
  }
}
