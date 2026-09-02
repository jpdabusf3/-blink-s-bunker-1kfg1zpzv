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

function filterVendas(
  vendas: HistoricoVenda[],
  f: PerformanceFilters,
  gestaoTecnica: GestaoTecnica[],
): HistoricoVenda[] {
  // Mapas por nome para cruzar caso os IDs sejam de coleções diferentes (ex: equipe vs gestao_tecnica ou nomes diretos)
  const gestorMapById = new Map(
    gestaoTecnica
      .filter((g) => g.funcao === 'gestor_tecnico')
      .map((g) => [g.id, g.nome.toLowerCase().trim()]),
  )
  const vendedorMapById = new Map(
    gestaoTecnica
      .filter((g) => g.funcao === 'vendedor')
      .map((g) => [g.id, g.nome.toLowerCase().trim()]),
  )

  const targetGestorName = f.gestorId !== 'all' ? gestorMapById.get(f.gestorId) : null
  const targetVendedorName = f.vendedorId !== 'all' ? vendedorMapById.get(f.vendedorId) : null

  return vendas.filter((v) => {
    const dataVal = v.data_documento || v.data || ''
    if (!inDateRange(dataVal, f.dataInicial, f.dataFinal)) return false

    if (f.gestorId !== 'all') {
      const matchId = v.gestor_tecnico_id === f.gestorId
      const vGestorNome = (v.gestor_tecnico || v.expand?.gestor_tecnico_id?.nome || '')
        .toLowerCase()
        .trim()
      const matchName =
        targetGestorName && vGestorNome
          ? vGestorNome.includes(targetGestorName) || targetGestorName.includes(vGestorNome)
          : false
      if (!matchId && !matchName) return false
    }

    if (f.vendedorId !== 'all') {
      const matchId = v.vendedor_id === f.vendedorId
      const vVendNome = (v.vendedor || v.expand?.vendedor_id?.nome || '').toLowerCase().trim()
      const matchName =
        targetVendedorName && vVendNome
          ? vVendNome.includes(targetVendedorName) || targetVendedorName.includes(vVendNome)
          : false
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
  })
}

function distEspecie(records: HistoricoVenda[]) {
  const m = new Map<string, number>()
  records.forEach((r) => {
    const e = r.especie_destino || r.especie || 'OUTRO'
    m.set(e, (m.get(e) || 0) + 1)
  })
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
}

function distRelation(
  records: HistoricoVenda[],
  nameField: 'gestor_tecnico' | 'vendedor',
  idField: 'gestor_tecnico_id' | 'vendedor_id',
  nameMap: Map<string, string>,
) {
  const m = new Map<string, number>()
  records.forEach((r) => {
    const val = r.produto_valor_total || r.valor || 0
    const explicitName = r[nameField]
    const id = r[idField]
    const resolvedName = explicitName || (id ? nameMap.get(id) : null) || 'Não informado'
    m.set(resolvedName, (m.get(resolvedName) || 0) + val)
  })
  return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
}

function buildMemberPerf(
  member: GestaoTecnica,
  sales: HistoricoVenda[],
  relNameField: 'gestor_tecnico' | 'vendedor',
  relIdField: 'gestor_tecnico_id' | 'vendedor_id',
  nameMap: Map<string, string>,
  metaValor: number,
): MemberPerformance {
  const valorTotal = sales.reduce((s, v) => s + (v.produto_valor_total || v.valor || 0), 0)
  return {
    id: member.id,
    nome: member.nome,
    regiao: member.regiao,
    totalVendas: sales.length,
    valorTotal,
    distribuicaoEspecie: distEspecie(sales),
    distribuicaoRelacionado: distRelation(sales, relNameField, relIdField, nameMap),
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

  const filtered = filterVendas(vendas, filters, gestaoTecnica)
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

  const valorTotal = filtered.reduce((s, v) => s + (v.produto_valor_total || v.valor || 0), 0)
  const summary: ExecutiveSummary = {
    totalVendas: filtered.length,
    valorTotal,
    ticketMedio: filtered.length > 0 ? valorTotal / filtered.length : 0,
    numClientes: new Set(filtered.map((v) => v.destinatario_nome || v.cliente || 'Desconhecido'))
      .size,
    taxaConversao: atividadesCount > 0 ? (filtered.length / atividadesCount) * 100 : 0,
  }

  const gestores = gestaoTecnica
    .filter((g) => g.funcao === 'gestor_tecnico')
    .map((g) => {
      const gNomeClean = g.nome.toLowerCase().trim()
      const sales = filtered.filter((v) => {
        if (v.gestor_tecnico_id === g.id) return true
        const vGName = (v.gestor_tecnico || v.expand?.gestor_tecnico_id?.nome || '')
          .toLowerCase()
          .trim()
        return vGName ? vGName.includes(gNomeClean) || gNomeClean.includes(vGName) : false
      })
      const linkedVends = gestorVends.get(g.id) || new Set<string>()
      const metaValor = Array.from(linkedVends).reduce(
        (s, vid) => s + (metasByVend.get(vid) || 0),
        0,
      )
      return buildMemberPerf(g, sales, 'vendedor', 'vendedor_id', gestaoMap, metaValor)
    })

  const vendedores = gestaoTecnica
    .filter((g) => g.funcao === 'vendedor')
    .map((g) => {
      const vNomeClean = g.nome.toLowerCase().trim()
      const sales = filtered.filter((v) => {
        if (v.vendedor_id === g.id) return true
        const vVName = (v.vendedor || v.expand?.vendedor_id?.nome || '').toLowerCase().trim()
        return vVName ? vVName.includes(vNomeClean) || vNomeClean.includes(vVName) : false
      })
      return buildMemberPerf(
        g,
        sales,
        'gestor_tecnico',
        'gestor_tecnico_id',
        gestaoMap,
        metasByVend.get(g.id) || 0,
      )
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
