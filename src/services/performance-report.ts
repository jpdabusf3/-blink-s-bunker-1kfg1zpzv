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

function normalizeEspecie(esp?: string): string {
  if (!esp) return ''
  const u = esp.toUpperCase().trim()
  if (u === 'AVES' || u === 'AVE') return 'AVE'
  if (u === 'SUINOS' || u === 'SUINO') return 'SUINO'
  if (u === 'PETS' || u === 'PET') return 'PET'
  if (u === 'RUMINANTES' || u === 'BOVINO' || u === 'BOVINOS') return 'BOVINO'
  if (u === 'AQUA') return 'AQUA'
  return u
}

function normalizeCanal(c?: string): string {
  if (!c) return ''
  const clean = c.trim()
  if (clean === 'Indústria' || clean === 'Industria') return 'Indústria'
  return clean
}

function matchesFilters(
  v: HistoricoVenda,
  f: PerformanceFilters,
  gestaoTecnica: GestaoTecnica[],
): boolean {
  const dataVal = v.data_documento || v.data || ''
  if (f.dataInicial && dataVal) {
    const d = new Date(dataVal)
    if (d < new Date(f.dataInicial)) return false
  }
  if (f.dataFinal && dataVal) {
    const d = new Date(dataVal)
    if (d > new Date(f.dataFinal + 'T23:59:59')) return false
  }

  if (f.gestorId !== 'all') {
    const target = gestaoTecnica.find((g) => g.id === f.gestorId)
    const matchId = v.gestor_tecnico_id === f.gestorId
    const vGName = (v.gestor_tecnico || v.expand?.gestor_tecnico_id?.nome || '')
      .toLowerCase()
      .trim()
    const targetName = (target?.nome || '').toLowerCase().trim()
    const matchName =
      targetName && vGName ? vGName.includes(targetName) || targetName.includes(vGName) : false
    if (!matchId && !matchName) return false
  }

  if (f.vendedorId !== 'all') {
    const target = gestaoTecnica.find((g) => g.id === f.vendedorId)
    const matchId = v.vendedor_id === f.vendedorId
    const vVName = (v.vendedor || v.expand?.vendedor_id?.nome || '').toLowerCase().trim()
    const targetName = (target?.nome || '').toLowerCase().trim()
    const matchName =
      targetName && vVName ? vVName.includes(targetName) || targetName.includes(vVName) : false
    if (!matchId && !matchName) return false
  }

  if (f.especie !== 'all') {
    const normV = normalizeEspecie(v.especie_destino || v.especie)
    const normF = normalizeEspecie(f.especie)
    if (normV !== normF && (v.especie_destino || v.especie) !== f.especie) return false
  }

  if (f.canalVendas !== 'all') {
    const normV = normalizeCanal(v.canal_vendas)
    const normF = normalizeCanal(f.canalVendas)
    if (normV !== normF && v.canal_vendas !== f.canalVendas) return false
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

  const filtered = vendas.filter((v) => matchesFilters(v, filters, gestaoTecnica))

  const totalVendas = filtered.length
  const valorTotal = filtered.reduce((s, v) => s + (v.produto_valor_total || v.valor || 0), 0)
  const ticketMedio = totalVendas > 0 ? valorTotal / totalVendas : 0
  const clientesSet = new Set(filtered.map((v) => v.destinatario_nome || v.cliente).filter(Boolean))

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
    const memNameClean = member.nome.toLowerCase().trim()
    const mv = filtered.filter((v) => {
      if (isGestor) {
        if (v.gestor_tecnico_id === member.id) return true
        const vGName = (v.gestor_tecnico || v.expand?.gestor_tecnico_id?.nome || '')
          .toLowerCase()
          .trim()
        return vGName ? vGName.includes(memNameClean) || memNameClean.includes(vGName) : false
      } else {
        if (v.vendedor_id === member.id) return true
        const vVName = (v.vendedor || v.expand?.vendedor_id?.nome || '').toLowerCase().trim()
        return vVName ? vVName.includes(memNameClean) || memNameClean.includes(vVName) : false
      }
    })
    const especieDist: Record<string, number> = {}
    mv.forEach((v) => {
      const e = v.especie_destino || v.especie || 'OUTRO'
      especieDist[e] = (especieDist[e] || 0) + 1
    })
    const linkedDist: Record<string, number> = {}
    mv.forEach((v) => {
      const explicitName = isGestor ? v.vendedor : v.gestor_tecnico
      const lid = isGestor ? v.vendedor_id : v.gestor_tecnico_id
      const resolved = explicitName || (lid ? idToName.get(lid) : null) || 'N/A'
      linkedDist[resolved] = (linkedDist[resolved] || 0) + 1
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
    const memValorTotal = mv.reduce((s, v) => s + (v.produto_valor_total || v.valor || 0), 0)
    return {
      id: member.id,
      nome: member.nome,
      totalVendas: mv.length,
      valorTotal: memValorTotal,
      especieDist,
      linkedDist,
      metaValor,
      valorRealizado: valorRealizado > 0 ? valorRealizado : memValorTotal,
      metaAchievement: metaValor > 0 ? (memValorTotal / metaValor) * 100 : 0,
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
