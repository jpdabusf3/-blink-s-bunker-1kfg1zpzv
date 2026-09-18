import type { Factory } from '@/types'
import type { ConsolidatedData } from '@/services/consolidated-dashboard'
import {
  openCorporatePdfReport,
  formatMoedaBRL,
  formatPercentBR,
  type PdfSection,
} from '@/lib/corporateDocuments'
import { formatCompactCurrency } from './utils'

export function exportFullDashboardToPDF(
  funnelItems: Factory[],
  dashboardData: ConsolidatedData | null,
  filters:
    | { vendedor?: string; gestor?: string; canal?: string; especie?: string; status?: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | any,
  periodView: 'mensal' | 'trimestral' = 'mensal',
) {
  const kpis = dashboardData?.kpis
  const vendorRanking = dashboardData?.vendorRanking || []
  const gestorRanking = dashboardData?.gestorRanking || []
  const comparisonData =
    periodView === 'trimestral'
      ? dashboardData?.quarterlyComparisons || []
      : dashboardData?.monthComparisons || []
  const comparisonTitle =
    periodView === 'trimestral' ? 'Comparativo Trimestral' : 'Comparativo Mensal'

  const sections: PdfSection[] = []
  let secIdx = 1

  // 1. Indicadores Consolidados
  if (kpis) {
    sections.push({
      numero: secIdx++,
      titulo: 'Indicadores Consolidados de Performance',
      descricao:
        'Visão geral do valor do funil, volume de negociações ativas, atingimento de metas e receita total de vendas.',
      kpis: [
        {
          label: 'Valor Total no Funil',
          valor: formatCompactCurrency(kpis.totalFunnelValue),
          sub: 'Pipeline consolidado',
          accent: 'primary',
        },
        {
          label: 'Ativos / Inativos / Encerrados',
          valor: `${kpis.ativoCount} / ${kpis.inativoCount} / ${kpis.encerradasCount}`,
          sub: 'Distribuição da carteira',
          accent: 'amber',
        },
        {
          label: 'Atingimento da Meta',
          valor: formatPercentBR(kpis.achievementPct),
          sub: 'Realizado vs Meta global',
          accent: 'emerald',
        },
        {
          label: 'Total de Vendas',
          valor: formatCompactCurrency(kpis.totalSales),
          sub: 'Faturamento acumulado',
          accent: 'sky',
        },
      ],
    })
  }

  // 2. Comparativo Mensal / Trimestral
  if (comparisonData.length > 0) {
    const totalVendas = comparisonData.reduce((acc, m) => acc + (m.sales || 0), 0)
    const totalMeta = comparisonData.reduce((acc, m) => acc + (m.target || 0), 0)
    const totalRealizado = comparisonData.reduce((acc, m) => acc + (m.achieved || 0), 0)

    sections.push({
      numero: secIdx++,
      titulo: comparisonTitle,
      descricao:
        'Acompanhamento temporal da evolução de vendas, metas planejadas e valores liquidados.',
      table: {
        columns: [
          { header: 'Período', align: 'left', isBold: true },
          { header: 'Vendas Totais (R$)', align: 'right' },
          { header: 'Meta Planejada (R$)', align: 'right' },
          { header: 'Realizado Liquidado (R$)', align: 'right' },
        ],
        rows: comparisonData.map((m) => [
          m.label,
          formatMoedaBRL(m.sales),
          formatMoedaBRL(m.target),
          formatMoedaBRL(m.achieved),
        ]),
        footerRow: [
          'TOTAL:',
          formatMoedaBRL(totalVendas),
          formatMoedaBRL(totalMeta),
          formatMoedaBRL(totalRealizado),
        ],
      },
    })
  }

  // 3. Ranking de Vendedores
  if (vendorRanking.length > 0) {
    const totalSales = vendorRanking.reduce((acc, v) => acc + (v.totalSales || 0), 0)
    const totalMeta = vendorRanking.reduce((acc, v) => acc + (v.metaValor || 0), 0)
    const totalRealizado = vendorRanking.reduce((acc, v) => acc + (v.valorRealizado || 0), 0)

    sections.push({
      numero: secIdx++,
      titulo: 'Ranking de Vendedores Comerciais',
      descricao:
        'Classificação individual por vendedor com valores realizados, metas atribuídas e percentual de atingimento.',
      table: {
        columns: [
          { header: 'Posição', width: '70px', align: 'center', isBold: true },
          { header: 'Vendedor', align: 'left' },
          { header: 'Vendas (R$)', align: 'right' },
          { header: 'Meta (R$)', align: 'right' },
          { header: 'Realizado (R$)', align: 'right' },
          { header: 'Atingimento (%)', width: '130px', align: 'right' },
        ],
        rows: vendorRanking.map((v, i) => [
          `${i + 1}º`,
          v.nome,
          formatMoedaBRL(v.totalSales),
          formatMoedaBRL(v.metaValor),
          formatMoedaBRL(v.valorRealizado),
          formatPercentBR(v.achievementPct),
        ]),
        footerRow: [
          'TOTAL:',
          `${vendorRanking.length} vendedor(es)`,
          formatMoedaBRL(totalSales),
          formatMoedaBRL(totalMeta),
          formatMoedaBRL(totalRealizado),
          '—',
        ],
      },
    })
  }

  // 4. Comparativo por Gestor Técnico
  if (gestorRanking.length > 0) {
    const totalMetaG = gestorRanking.reduce((acc, g) => acc + (g.metaValor || 0), 0)
    const totalRealizadoG = gestorRanking.reduce((acc, g) => acc + (g.valorRealizado || 0), 0)
    const totalSalesG = gestorRanking.reduce((acc, g) => acc + (g.totalSales || 0), 0)

    sections.push({
      numero: secIdx++,
      titulo: 'Comparativo por Gestor Técnico',
      descricao: 'Desempenho consolidado por liderança técnica e territorial da Blink Biotech.',
      table: {
        columns: [
          { header: 'Posição', width: '70px', align: 'center', isBold: true },
          { header: 'Gestor Técnico', align: 'left' },
          { header: 'Meta (R$)', align: 'right' },
          { header: 'Realizado (R$)', align: 'right' },
          { header: 'Vendas (R$)', align: 'right' },
          { header: 'Atingimento (%)', width: '130px', align: 'right' },
        ],
        rows: gestorRanking.map((g, i) => [
          `${i + 1}º`,
          g.nome,
          formatMoedaBRL(g.metaValor),
          formatMoedaBRL(g.valorRealizado),
          formatMoedaBRL(g.totalSales),
          formatPercentBR(g.achievementPct),
        ]),
        footerRow: [
          'TOTAL:',
          `${gestorRanking.length} gestor(es)`,
          formatMoedaBRL(totalMetaG),
          formatMoedaBRL(totalRealizadoG),
          formatMoedaBRL(totalSalesG),
          '—',
        ],
      },
    })
  }

  // 5. Funil de Vendas Detalhado
  const totalValorMedio = funnelItems.reduce((acc, f) => acc + (f.valor_medio || 0), 0)
  const totalValorAtual = funnelItems.reduce((acc, f) => acc + (f.valor_atual || 0), 0)

  sections.push({
    numero: secIdx++,
    titulo: 'Detalhamento do Funil Comercial',
    descricao:
      'Listagem analítica das oportunidades ativas e em negociação com estágio, valores e planos de ação.',
    table: {
      columns: [
        { header: 'Cliente / Fábrica', align: 'left', isBold: true },
        { header: 'Valor Médio (R$)', align: 'right' },
        { header: 'Valor Atual (R$)', align: 'right' },
        { header: 'Status Funil', align: 'center' },
        { header: 'Próximos Passos', align: 'left' },
        { header: 'Ação Recomendada', align: 'left' },
      ],
      rows: funnelItems.map((f) => [
        f.name || 'Sem nome',
        formatMoedaBRL(f.valor_medio || 0),
        formatMoedaBRL(f.valor_atual || 0),
        f.status_funil || '—',
        f.proximos_passos || '—',
        f.acao || '—',
      ]),
      footerRow: [
        `TOTAL (${funnelItems.length} clientes):`,
        formatMoedaBRL(totalValorMedio),
        formatMoedaBRL(totalValorAtual),
        '',
        '',
        '',
      ],
      emptyMessage: 'Nenhuma oportunidade encontrada no funil para os filtros aplicados.',
    },
  })

  return openCorporatePdfReport({
    titulo: 'Dashboard Consolidado da Diretoria',
    subtitulo: 'Relatório Integrado de Indicadores, Rankings, Comparativos e Funil Comercial B2B',
    origem: 'Visão Geral Executiva (/funil-vendas)',
    periodo: periodView === 'trimestral' ? 'Visão Trimestral' : 'Visão Mensal',
    filtros: filters,
    sections,
    orientacao: 'landscape',
  })
}
