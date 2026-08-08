import pb from '@/lib/pocketbase/client'
import { getHistoricoVendas, type HistoricoVenda } from '@/services/historico-vendas'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { getMetas } from '@/services/metas'

export interface PerformanceFilters {
  gestorId: string
  vendedorId: string
  especie: string
  canalVendas: string
  dataInicial: string
  dataFinal: string
}

export interface ExecutiveSummary {
  totalVendas: number
  valorTotal: number
  ticketMedio: number
  numClientes: number
  taxaConversao: number
}

export interface MemberPerformance {
  id: string
  nome: string
  regiao: string
  totalVendas: number
  valorTotal: number
  distribuicaoEspecie: { name: string; value: number }[]
  distribuicaoRelacionado: { name: string; value: number }[]
  metaValor: number
  metaProgresso: number
}

export interface PerformanceData {
  summary: ExecutiveSummary
  gestores: MemberPerformance[]
  vendedores: MemberPerformance[]
  rankingGestores: { nome: string; valor: number }[]
  rankingVendedores: { nome: string; valor: number }[]
}

function inDateRange(dateStr: string, ini: string, fim: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (ini && d < new Date(ini)) return false
  if (fim && d > new Date(fim + 'T23:59:59')) return false
  return true
}

function filterVendas(vendas: HistoricoVenda[], f: PerformanceFilters): HistoricoVenda[] {
  return vendas.filter((v) => {
    if (!inDateRange(v.data, f.dataInicial, f.dataFinal)) return false
    if (f.gestorId !== 'all' && v.gestor_tecnico_id !== f.gestorId) return false
    if (f.vendedorId !== 'all' && v.vendedor_id !== f.vendedorId) return false
    if (f.especie !== 'all' && v.especie !== f.especie) return false
    if (f.canalVendas !== 'all' && v.canal_vendas !== f.canalVendas) return false
    return true
  })
}

function distEspecie(records: HistoricoVenda[]) {
  const m = new Map<string, number>()
  records.forEach((r) => {
    const e = r.especie || 'OUTRO'
    m.set(e, (m.get(e) || 0) + 1)
  })
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
}

function distRelation(
  records: HistoricoVenda[],
  field: 'gestor_tecnico_id' | 'vendedor_id',
  nameMap: Map<string, string>,
) {
  const m = new Map<string, number>()
  records.forEach((r) => {
    const id = r[field]
    if (!id) return
    const name = nameMap.get(id) || id
    m.set(name, (m.get(name) || 0) + (r.valor || 0))
  })
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
}

function buildMemberPerf(
  member: GestaoTecnica,
  sales: HistoricoVenda[],
  relField: 'gestor_tecnico_id' | 'vendedor_id',
  nameMap: Map<string, string>,
  metaValor: number,
): MemberPerformance {
  const valorTotal = sales.reduce((s, v) => s + (v.valor || 0), 0)
  return {
    id: member.id,
    nome: member.nome,
    regiao: member.regiao,
    totalVendas: sales.length,
    valorTotal,
    distribuicaoEspecie: distEspecie(sales),
    distribuicaoRelacionado: distRelation(sales, relField, nameMap),
    metaValor,
    metaProgresso: metaValor > 0 ? (valorTotal / metaValor) * 100 : 0,
  }
}

export async function fetchPerformanceData(filters: PerformanceFilters): Promise<PerformanceData> {
  const [vendas, gestaoTecnica, metas] = await Promise.all([
    getHistoricoVendas(),
    getGestaoTecnica(),
    getMetas(),
  ])

  let atividadesCount = 0
  try {
    const atvs = await pb.collection('atividades').getFullList()
    atividadesCount = atvs.filter((a: any) =>
      inDateRange(a.created, filters.dataInicial, filters.dataFinal),
    ).length
  } catch {
    /* noop */
  }

  const filtered = filterVendas(vendas, filters)
  const gestaoMap = new Map(gestaoTecnica.map((g) => [g.id, g.nome]))

  const metasByVend = new Map<string, number>()
  metas.forEach((m) => {
    const vid = m.vendedor_id
    if (!vid) return
    metasByVend.set(vid, (metasByVend.get(vid) || 0) + (m.meta_valor || 0))
  })

  const gestorVends = new Map<string, Set<string>>()
  vendas.forEach((v) => {
    if (v.gestor_tecnico_id && v.vendedor_id) {
      if (!gestorVends.has(v.gestor_tecnico_id)) gestorVends.set(v.gestor_tecnico_id, new Set())
      gestorVends.get(v.gestor_tecnico_id)!.add(v.vendedor_id)
    }
  })

  const valorTotal = filtered.reduce((s, v) => s + (v.valor || 0), 0)
  const summary: ExecutiveSummary = {
    totalVendas: filtered.length,
    valorTotal,
    ticketMedio: filtered.length > 0 ? valorTotal / filtered.length : 0,
    numClientes: new Set(filtered.map((v) => v.cliente)).size,
    taxaConversao: atividadesCount > 0 ? (filtered.length / atividadesCount) * 100 : 0,
  }

  const gestores = gestaoTecnica
    .filter((g) => g.funcao === 'gestor_tecnico')
    .map((g) => {
      const sales = filtered.filter((v) => v.gestor_tecnico_id === g.id)
      const linkedVends = gestorVends.get(g.id) || new Set<string>()
      const metaValor = Array.from(linkedVends).reduce(
        (s, vid) => s + (metasByVend.get(vid) || 0),
        0,
      )
      return buildMemberPerf(g, sales, 'vendedor_id', gestaoMap, metaValor)
    })

  const vendedores = gestaoTecnica
    .filter((g) => g.funcao === 'vendedor')
    .map((g) => {
      const sales = filtered.filter((v) => v.vendedor_id === g.id)
      return buildMemberPerf(g, sales, 'gestor_tecnico_id', gestaoMap, metasByVend.get(g.id) || 0)
    })

  return {
    summary,
    gestores,
    vendedores,
    rankingGestores: [...gestores]
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map((g) => ({ nome: g.nome, valor: g.valorTotal })),
    rankingVendedores: [...vendedores]
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map((v) => ({ nome: v.nome, valor: v.valorTotal })),
  }
}
