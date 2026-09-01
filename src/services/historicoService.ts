import pb from '@/lib/pocketbase/client'
import { deriveDateParts, derivePais } from './historico-vendas'

export type HistoricoGranularity = 'mensal' | 'anual' | 'quadrienal'

export interface HistoricoFilters {
  especie?: string[] // ['Todos'] or specific array e.g. ['PET', 'AVES']
  gestor_tecnico?: string // 'Todos' or id/name
  vendedor?: string // 'Todos' or id/name
  canal_vendas?: string // 'Todos' or channel name
  pais?: string // 'Brasil', 'Paraguai', 'Chile', 'Todos'
  familia_produto?: string // 'Adsorventes', 'Minerais Organicos', etc., or 'Todos'
  data_inicio?: string // 'YYYY-MM-DD'
  data_fim?: string // 'YYYY-MM-DD'
  mostrarApenasRealizado?: boolean // default false
}

export interface HistoricoDocumentoItem {
  id: string
  origem: 'nf' | 'pedido' | string
  numero_documento: string
  data_documento: string
  mes: string
  ano: number
  trimestre?: string
  destinatario_nome: string
  destinatario_uf?: string
  pais?: string
  especie_destino?: string
  canal_vendas?: string
  gestor_tecnico?: string
  vendedor?: string
  produto_codigo?: string
  produto_descricao?: string
  produto_familia?: string
  produto_quantidade?: number
  produto_valor_unitario?: number
  produto_valor_total?: number
  valor_total_nota: number
  frete_modalidade?: string
  status: 'realizado' | 'projetado' | string
  groupKey?: string
}

export interface HistoricoMensalRow {
  groupKey: string
  mes: string
  ano: number
  mesAno: string // e.g. "08/2026" or "Agosto/2026"
  sortKey: string // "YYYY-MM"
  especie: string
  gestor_tecnico: string
  vendedor: string
  canal: string
  qtdNfs: number
  qtdPedidos: number
  valorRealizado: number
  valorProjetado: number
  total: number
  documentos: HistoricoDocumentoItem[]
}

export interface HistoricoAnualRow {
  groupKey: string
  ano: number
  especie: string
  qtdNfs: number
  valorRealizado: number
  valorProjetado: number
  total: number
  vsAnoAnteriorPercent: number | null // vs ano anterior
  documentos: HistoricoDocumentoItem[]
}

export interface HistoricoQuadrienalRow {
  groupKey: string
  ano: number
  totalRealizado: number
  totalProjetado: number
  crescimentoYoY: number | null // %
  cagr: number | null // % over 4-year rolling period
  documentos: HistoricoDocumentoItem[]
}

export interface HistoricoSummary {
  totalRealizado: number
  totalProjetado: number
  ticketMedio: number
  qtdDocumentos: number
}

export interface HistoricoChartPoint {
  mesAno: string // "MM/AAAA"
  sortKey: string
  realizado: number
  projetado: number
  total: number
}

export interface HistoricoAggregatedResult {
  rawItems: HistoricoDocumentoItem[]
  summary: HistoricoSummary
  chartData: HistoricoChartPoint[]
  mensal: HistoricoMensalRow[]
  anual: HistoricoAnualRow[]
  quadrienal: HistoricoQuadrienalRow[]
}

const MONTH_NUM_MAP: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  marco: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
}

function normalizeEspecie(esp?: string): string {
  if (!esp) return 'OUTRO'
  const e = esp.toUpperCase().trim()
  if (e.includes('PET')) return 'PET'
  if (e.includes('AVE')) return 'AVES'
  if (e.includes('SUIN')) return 'SUINOS'
  if (e.includes('BOVIN') || e.includes('RUMIN')) return 'RUMINANTES'
  if (e.includes('AQUA')) return 'AQUA'
  if (e.includes('DISTRIB')) return 'DISTRIBUICAO'
  return esp
}

function normalizeCanal(canal?: string): string {
  if (!canal) return 'Direto'
  const c = canal.trim()
  if (/ind[uú]stria/i.test(c)) return 'Industria'
  return c
}

function normalizeFamilia(fam?: string): string {
  if (!fam) return 'Outros'
  const f = fam.trim().toLowerCase()
  if (f.includes('adsorv')) return 'Adsorventes'
  if (f.includes('miner')) return 'Minerais Organicos'
  if (f.includes('prebio')) return 'Prebioticos'
  if (f.includes('blend')) return 'Blends'
  if (f.includes('ingred')) return 'Ingredientes'
  if (f.includes('inova')) return 'Inovacao'
  return fam
}

function matchFilterValue(value: string | undefined, filter: string | undefined): boolean {
  if (!filter || filter === 'Todos' || filter === '') return true
  if (!value) return false
  return value.trim().toLowerCase() === filter.trim().toLowerCase()
}

function matchMultiEspecie(
  itemEspecie: string | undefined,
  filterEspecies: string[] | undefined,
): boolean {
  if (!filterEspecies || filterEspecies.length === 0 || filterEspecies.includes('Todos'))
    return true
  if (!itemEspecie) return false
  const normItem = normalizeEspecie(itemEspecie).toLowerCase()
  return filterEspecies.some((fe) => {
    const normFe = normalizeEspecie(fe).toLowerCase()
    return normFe === normItem || normItem.includes(normFe) || normFe.includes(normItem)
  })
}

export const historicoService = {
  /**
   * Busca todas as fontes de histórico (tabela historico_vendas unificada, com fallback de notas_fiscais e pedidos),
   * aplica filtros em memória com extrema fidelidade e calcula sumarizações, tabela e gráficos.
   */
  async getHistorico(filters: HistoricoFilters): Promise<HistoricoAggregatedResult> {
    const allItems: HistoricoDocumentoItem[] = []

    // 1. Tentar buscar em historico_vendas primeiro
    let hasHvRecords = false
    try {
      const hvList = await pb.collection('historico_vendas').getFullList<any>({
        sort: '-data_documento,-created',
        expand: 'gestor_tecnico_id,vendedor_id',
      })

      if (hvList && hvList.length > 0) {
        hasHvRecords = true
        for (const r of hvList) {
          const dataDoc =
            r.data_documento || r.data || (r.created ? r.created.substring(0, 10) : '')
          const parts = deriveDateParts(dataDoc)
          const pais = r.pais || derivePais(r.destinatario_uf)
          const numDoc = r.numero_documento || (r.id ? `DOC-${r.id.substring(0, 6)}` : 'ND')
          const valorNota =
            Number(r.valor_total_nota) || Number(r.valor) || Number(r.produto_valor_total) || 0
          const status = r.status || (r.origem === 'pedido' ? 'projetado' : 'realizado')

          const gestor = r.gestor_tecnico || r.expand?.gestor_tecnico_id?.nome || ''
          const vendedor = r.vendedor || r.expand?.vendedor_id?.nome || ''

          allItems.push({
            id: r.id,
            origem: r.origem || (status === 'projetado' ? 'pedido' : 'nf'),
            numero_documento: numDoc,
            data_documento: dataDoc,
            mes: r.mes || parts.mes,
            ano: r.ano || parts.ano,
            trimestre: r.trimestre || parts.trimestre,
            destinatario_nome: r.destinatario_nome || r.cliente || 'Cliente não identificado',
            destinatario_uf: r.destinatario_uf || '',
            pais,
            especie_destino: r.especie_destino || r.especie || 'OUTRO',
            canal_vendas: r.canal_vendas || 'Direto',
            gestor_tecnico: gestor,
            vendedor: vendedor,
            produto_codigo: r.produto_codigo || '',
            produto_descricao: r.produto_descricao || '',
            produto_familia: r.produto_familia || '',
            produto_quantidade: Number(r.produto_quantidade) || 1,
            produto_valor_unitario: Number(r.produto_valor_unitario) || 0,
            produto_valor_total: Number(r.produto_valor_total) || valorNota,
            valor_total_nota: valorNota,
            frete_modalidade: r.frete_modalidade || 'CIF',
            status: status === 'projetado' ? 'projetado' : 'realizado',
          })
        }
      }
    } catch (err) {
      console.warn('Coleção historico_vendas vazia ou inacessível:', err)
    }

    // 2. Se historico_vendas não tiver dados ou para complementar, consultar notas_fiscais + nf_itens + pedidos
    if (!hasHvRecords) {
      try {
        // Carregar catálogo para enriquecer família
        const produtosList = await pb
          .collection('produtos')
          .getFullList<any>()
          .catch(() => [])
        const produtoMap = new Map<string, any>()
        produtosList.forEach((p) => {
          if (p.codigo) produtoMap.set(String(p.codigo).toUpperCase().trim(), p)
        })

        // Consultar notas fiscais
        const nfs = await pb
          .collection('notas_fiscais')
          .getFullList<any>({
            expand: 'gestor_tecnico_id,vendedor_id',
            sort: '-data_emissao',
          })
          .catch(() => [])

        // Consultar itens de NF se existirem
        const nfItens = await pb
          .collection('nf_itens')
          .getFullList<any>()
          .catch(() => [])
        const nfItensByNfId = new Map<string, any[]>()
        nfItens.forEach((it) => {
          const nId = it.nota_fiscal_id
          if (!nfItensByNfId.has(nId)) nfItensByNfId.set(nId, [])
          nfItensByNfId.get(nId)!.push(it)
        })

        for (const nf of nfs) {
          const dataDoc = nf.data_emissao || (nf.created ? nf.created.substring(0, 10) : '')
          const parts = deriveDateParts(dataDoc)
          const pais = derivePais(nf.destinatario_uf)
          const gestor = nf.expand?.gestor_tecnico_id?.nome || ''
          const vendedor = nf.expand?.vendedor_id?.nome || ''
          const itemsOfThisNf = nfItensByNfId.get(nf.id) || []

          if (itemsOfThisNf.length > 0) {
            for (const it of itemsOfThisNf) {
              const pCode = String(it.produto_codigo || '').trim()
              const pInfo = produtoMap.get(pCode.toUpperCase())
              const familia = pInfo?.linha || ''
              allItems.push({
                id: `${nf.id}_${it.id}`,
                origem: 'nf',
                numero_documento: String(nf.numero_nf || nf.id),
                data_documento: dataDoc,
                mes: parts.mes,
                ano: parts.ano,
                trimestre: parts.trimestre,
                destinatario_nome: nf.destinatario_nome || 'Cliente não identificado',
                destinatario_uf: nf.destinatario_uf || '',
                pais,
                especie_destino: nf.especie_destino || 'OUTRO',
                canal_vendas: nf.canal_vendas || 'Direto',
                gestor_tecnico: gestor,
                vendedor: vendedor,
                produto_codigo: pCode,
                produto_descricao: it.produto_descricao || '',
                produto_familia: familia,
                produto_quantidade: Number(it.produto_quantidade) || 1,
                produto_valor_unitario: Number(it.produto_valor_unitario) || 0,
                produto_valor_total:
                  Number(it.produto_valor_total) || Number(nf.valor_total_nota) || 0,
                valor_total_nota: Number(nf.valor_total_nota) || 0,
                frete_modalidade: nf.frete_modalidade || 'CIF',
                status: 'realizado',
              })
            }
          } else {
            allItems.push({
              id: nf.id,
              origem: 'nf',
              numero_documento: String(nf.numero_nf || nf.id),
              data_documento: dataDoc,
              mes: parts.mes,
              ano: parts.ano,
              trimestre: parts.trimestre,
              destinatario_nome: nf.destinatario_nome || 'Cliente não identificado',
              destinatario_uf: nf.destinatario_uf || '',
              pais,
              especie_destino: nf.especie_destino || 'OUTRO',
              canal_vendas: nf.canal_vendas || 'Direto',
              gestor_tecnico: gestor,
              vendedor: vendedor,
              produto_codigo: '',
              produto_descricao: 'Produtos da NF',
              produto_familia: '',
              produto_quantidade: 1,
              produto_valor_unitario: Number(nf.valor_total_nota) || 0,
              produto_valor_total: Number(nf.valor_total_nota) || 0,
              valor_total_nota: Number(nf.valor_total_nota) || 0,
              frete_modalidade: nf.frete_modalidade || 'CIF',
              status: 'realizado',
            })
          }
        }

        // Consultar pedidos (projetado)
        const pedidosList = await pb
          .collection('pedidos')
          .getFullList<any>({
            expand: 'gestor_tecnico_id,vendedor_id,produto_id',
            sort: '-created',
          })
          .catch(() => [])

        for (const ped of pedidosList) {
          const dataDoc = ped.created
            ? ped.created.substring(0, 10)
            : new Date().toISOString().substring(0, 10)
          const parts = deriveDateParts(dataDoc)
          const pais = derivePais(ped.estado)
          const gestor = ped.expand?.gestor_tecnico_id?.nome || ''
          const vendedor = ped.expand?.vendedor_id?.nome || ''
          const prodCode = ped.produto_codigo || ped.expand?.produto_id?.codigo || ''
          const prodInfo = produtoMap.get(String(prodCode).toUpperCase().trim())
          const familia = ped.produto_linha || prodInfo?.linha || ''

          const valTotal = Number(ped.total_geral) || Number(ped.preco_base) || 0
          allItems.push({
            id: ped.id,
            origem: 'pedido',
            numero_documento: `PED-${ped.id.substring(0, 8).toUpperCase()}`,
            data_documento: dataDoc,
            mes: parts.mes,
            ano: parts.ano,
            trimestre: parts.trimestre,
            destinatario_nome: ped.cliente_nome || 'Cliente não identificado',
            destinatario_uf: ped.estado === 'Parana' ? 'PR' : '',
            pais,
            especie_destino: ped.especie_destino || ped.especie || 'OUTRO',
            canal_vendas: ped.canal_vendas || 'Direto',
            gestor_tecnico: gestor,
            vendedor: vendedor,
            produto_codigo: prodCode,
            produto_descricao: ped.produto_nome || prodInfo?.nome || '',
            produto_familia: familia,
            produto_quantidade: Number(ped.quantidade) || 1,
            produto_valor_unitario: Number(ped.preco_liquido) || 0,
            produto_valor_total: valTotal,
            valor_total_nota: valTotal,
            frete_modalidade: ped.modalidade_frete || 'FOB',
            status: 'projetado',
          })
        }
      } catch (e) {
        console.error('Erro ao consultar coleções de fallback:', e)
      }
    }

    // 3. Aplicar Filtros
    const filtered = allItems.filter((item) => {
      // Toggle "Mostrar apenas realizado"
      if (filters.mostrarApenasRealizado && item.status !== 'realizado') {
        return false
      }

      // Filtro Especie (múltipla seleção)
      if (!matchMultiEspecie(item.especie_destino, filters.especie)) {
        return false
      }

      // Filtro Gestor Técnico
      if (!matchFilterValue(item.gestor_tecnico, filters.gestor_tecnico)) {
        return false
      }

      // Filtro Vendedor
      if (!matchFilterValue(item.vendedor, filters.vendedor)) {
        return false
      }

      // Filtro Canal Vendas
      if (filters.canal_vendas && filters.canal_vendas !== 'Todos') {
        const itemCanalNorm = normalizeCanal(item.canal_vendas).toLowerCase()
        const filterCanalNorm = normalizeCanal(filters.canal_vendas).toLowerCase()
        if (itemCanalNorm !== filterCanalNorm) return false
      }

      // Filtro País
      if (filters.pais && filters.pais !== 'Todos') {
        const itemPaisNorm = (item.pais || 'Brasil').trim().toLowerCase()
        const filterPaisNorm = filters.pais.trim().toLowerCase()
        if (itemPaisNorm !== filterPaisNorm) return false
      }

      // Filtro Família Produto
      if (filters.familia_produto && filters.familia_produto !== 'Todos') {
        const itemFamNorm = normalizeFamilia(item.produto_familia).toLowerCase()
        const filterFamNorm = normalizeFamilia(filters.familia_produto).toLowerCase()
        if (itemFamNorm !== filterFamNorm) return false
      }

      // Intervalo de Data (YYYY-MM-DD)
      if (item.data_documento) {
        const docDateStr = item.data_documento.substring(0, 10)
        if (filters.data_inicio && docDateStr < filters.data_inicio) return false
        if (filters.data_fim && docDateStr > filters.data_fim) return false
      }

      return true
    })

    // 4. Calcular Resumo
    let totalRealizado = 0
    let totalProjetado = 0
    const distinctDocsRealizados = new Set<string>()
    const allDistinctDocs = new Set<string>()

    filtered.forEach((item) => {
      const docKey = `${item.origem}_${item.numero_documento || item.id}`
      allDistinctDocs.add(docKey)

      const val = item.produto_valor_total || item.valor_total_nota || 0
      if (item.status === 'realizado') {
        totalRealizado += val
        distinctDocsRealizados.add(docKey)
      } else {
        totalProjetado += val
      }
    })

    const qtdDocumentos = allDistinctDocs.size
    const ticketMedio =
      distinctDocsRealizados.size > 0 ? totalRealizado / distinctDocsRealizados.size : 0

    const summary: HistoricoSummary = {
      totalRealizado,
      totalProjetado,
      ticketMedio,
      qtdDocumentos,
    }

    // 5. Agregações Mensal, Anual, Quadrienal e Gráfico

    // Mensal
    const mensalMap = new Map<string, HistoricoMensalRow>()
    const chartMap = new Map<string, { realizado: number; projetado: number; total: number }>()

    filtered.forEach((item) => {
      const mesName = (item.mes || 'janeiro').toLowerCase()
      const mm = MONTH_NUM_MAP[mesName] || '01'
      const sortKey = `${item.ano}-${mm}`
      const mesAno = `${mm}/${item.ano}`
      const esp = normalizeEspecie(item.especie_destino)
      const gest = item.gestor_tecnico || 'Não informado'
      const vend = item.vendedor || 'Não informado'
      const canal = item.canal_vendas || 'Direto'
      const groupKey = `m_${sortKey}_${esp}_${gest}_${vend}_${canal}`

      // Chart points
      if (!chartMap.has(sortKey)) {
        chartMap.set(sortKey, { realizado: 0, projetado: 0, total: 0 })
      }
      const cPt = chartMap.get(sortKey)!
      const itemVal = item.produto_valor_total || item.valor_total_nota || 0
      if (item.status === 'realizado') {
        cPt.realizado += itemVal
      } else {
        cPt.projetado += itemVal
      }
      cPt.total += itemVal

      // Table Mensal Row
      if (!mensalMap.has(groupKey)) {
        mensalMap.set(groupKey, {
          groupKey,
          mes: item.mes,
          ano: item.ano,
          mesAno,
          sortKey,
          especie: esp,
          gestor_tecnico: gest,
          vendedor: vend,
          canal,
          qtdNfs: 0,
          qtdPedidos: 0,
          valorRealizado: 0,
          valorProjetado: 0,
          total: 0,
          documentos: [],
        })
      }
      const mRow = mensalMap.get(groupKey)!
      item.groupKey = groupKey
      mRow.documentos.push(item)

      if (item.status === 'realizado') {
        mRow.valorRealizado += itemVal
        if (item.origem === 'nf') mRow.qtdNfs += 1
      } else {
        mRow.valorProjetado += itemVal
        if (item.origem === 'pedido') mRow.qtdPedidos += 1
      }
      mRow.total += itemVal
    })

    const mensalRows = Array.from(mensalMap.values()).sort((a, b) =>
      b.sortKey.localeCompare(a.sortKey),
    )

    // Chart points sorted chronologically
    const chartData: HistoricoChartPoint[] = Array.from(chartMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sortKey, val]) => {
        const [yyyy, mm] = sortKey.split('-')
        return {
          mesAno: `${mm}/${yyyy}`,
          sortKey,
          realizado: Number(val.realizado.toFixed(2)),
          projetado: Number(val.projetado.toFixed(2)),
          total: Number(val.total.toFixed(2)),
        }
      })

    // Anual Aggregation
    const anualMap = new Map<string, HistoricoAnualRow>()
    const totalAnoMap = new Map<number, number>()

    filtered.forEach((item) => {
      const esp = normalizeEspecie(item.especie_destino)
      const groupKey = `a_${item.ano}_${esp}`
      const itemVal = item.produto_valor_total || item.valor_total_nota || 0

      totalAnoMap.set(item.ano, (totalAnoMap.get(item.ano) || 0) + itemVal)

      if (!anualMap.has(groupKey)) {
        anualMap.set(groupKey, {
          groupKey,
          ano: item.ano,
          especie: esp,
          qtdNfs: 0,
          valorRealizado: 0,
          valorProjetado: 0,
          total: 0,
          vsAnoAnteriorPercent: null,
          documentos: [],
        })
      }
      const aRow = anualMap.get(groupKey)!
      item.groupKey = groupKey
      aRow.documentos.push(item)

      if (item.status === 'realizado') {
        aRow.valorRealizado += itemVal
        if (item.origem === 'nf') aRow.qtdNfs += 1
      } else {
        aRow.valorProjetado += itemVal
      }
      aRow.total += itemVal
    })

    // Compute vs ano anterior for annual rows
    const anualRows = Array.from(anualMap.values()).sort(
      (a, b) => b.ano - a.ano || a.especie.localeCompare(b.especie),
    )

    // Helper map to look up previous year's total for the SAME specie
    const anualSpecieMap = new Map<string, number>()
    anualRows.forEach((r) => {
      anualSpecieMap.set(`${r.ano}_${r.especie}`, r.total)
    })
    anualRows.forEach((r) => {
      const prevTotal = anualSpecieMap.get(`${r.ano - 1}_${r.especie}`)
      if (prevTotal && prevTotal > 0) {
        r.vsAnoAnteriorPercent = Number((((r.total - prevTotal) / prevTotal) * 100).toFixed(2))
      } else {
        r.vsAnoAnteriorPercent = null
      }
    })

    // Quadrienal Aggregation (Agrupa por ano, mostrando Realizado, Projetado, Crescimento YoY e CAGR 4 anos)
    const quadByYearMap = new Map<
      number,
      { realizado: number; projetado: number; docs: HistoricoDocumentoItem[] }
    >()
    filtered.forEach((item) => {
      if (!quadByYearMap.has(item.ano)) {
        quadByYearMap.set(item.ano, { realizado: 0, projetado: 0, docs: [] })
      }
      const yData = quadByYearMap.get(item.ano)!
      const itemVal = item.produto_valor_total || item.valor_total_nota || 0
      if (item.status === 'realizado') {
        yData.realizado += itemVal
      } else {
        yData.projetado += itemVal
      }
      yData.docs.push(item)
    })

    const allYearsSorted = Array.from(quadByYearMap.keys()).sort((a, b) => a - b)
    const quadrienalRows: HistoricoQuadrienalRow[] = []

    allYearsSorted.forEach((ano, idx) => {
      const yData = quadByYearMap.get(ano)!
      const currentTotal = yData.realizado + yData.projetado

      // YoY growth vs previous available year or exact ano - 1
      let crescimentoYoY: number | null = null
      if (idx > 0) {
        const prevYear = allYearsSorted[idx - 1]
        const prevData = quadByYearMap.get(prevYear)!
        const prevTotal = prevData.realizado + prevData.projetado
        if (prevTotal > 0) {
          crescimentoYoY = Number((((currentTotal - prevTotal) / prevTotal) * 100).toFixed(2))
        }
      }

      // CAGR rolling 4-year period (e.g. comparing year t with year t-3, n=3 periods or 4 years span)
      let cagr: number | null = null
      const baseYear = ano - 3
      if (quadByYearMap.has(baseYear)) {
        const baseData = quadByYearMap.get(baseYear)!
        const baseTotal = baseData.realizado + baseData.projetado
        if (baseTotal > 0 && currentTotal > 0) {
          // CAGR = (End / Start)^(1/3) - 1
          const ratio = currentTotal / baseTotal
          const rate = (Math.pow(ratio, 1 / 3) - 1) * 100
          cagr = Number(rate.toFixed(2))
        }
      }

      const groupKey = `q_${ano}`
      yData.docs.forEach((d) => {
        d.groupKey = groupKey
      })

      quadrienalRows.push({
        groupKey,
        ano,
        totalRealizado: yData.realizado,
        totalProjetado: yData.projetado,
        crescimentoYoY,
        cagr,
        documentos: yData.docs,
      })
    })

    quadrienalRows.sort((a, b) => b.ano - a.ano)

    return {
      rawItems: filtered,
      summary,
      chartData,
      mensal: mensalRows,
      anual: anualRows,
      quadrienal: quadrienalRows,
    }
  },

  /**
   * Retorna os documentos detalhados para exibição no modal de detalhe
   */
  getDetail(groupKey: string, allItems: HistoricoDocumentoItem[]): HistoricoDocumentoItem[] {
    return allItems.filter((i) => i.groupKey === groupKey)
  },
}
