import type { PerformanceReportData } from '@/services/performance-report'
import {
  openCorporatePdfReport,
  exportCorporateExcel,
  formatMoedaBRL,
  formatPercentBR,
  type PdfSection,
} from '@/lib/corporateDocuments'

export function exportPerformanceToExcel(data: PerformanceReportData) {
  exportCorporateExcel({
    slug: 'relatorio-performance',
    metadata: {
      titulo: 'Relatório Executivo de Performance Comercial',
      subtitulo: 'Metas, Vendas Realizadas e Atingimento por Vendedor e Gestor Técnico',
      origem: 'Módulo de Performance Comercial (/relatorio-performance)',
      periodo: 'Consolidado Geral',
      totalizacoes: [
        { label: 'TOTAL DE VENDAS (PEDIDOS):', valor: data.summary.totalVendas },
        { label: 'VALOR TOTAL REALIZADO (R$):', valor: formatMoedaBRL(data.summary.valorTotal) },
        { label: 'TICKET MÉDIO (R$):', valor: formatMoedaBRL(data.summary.ticketMedio) },
      ],
    },
    columns: [
      { key: 'tipo', label: 'Tipo de Função', width: 18 },
      { key: 'nome', label: 'Nome do Colaborador', width: 28 },
      { key: 'totalVendas', label: 'Quantidade de Vendas', width: 22, isNumeric: true },
      { key: 'valorTotal', label: 'Valor Total (R$)', width: 24, isCurrency: true },
      { key: 'metaValor', label: 'Meta Atribuída (R$)', width: 24, isCurrency: true },
      { key: 'valorRealizado', label: 'Valor Realizado (R$)', width: 24, isCurrency: true },
      { key: 'atingimento', label: 'Atingimento (%)', width: 18 },
    ],
    rows: [
      ...data.gestores.map((g) => ({
        tipo: 'Gestor Técnico',
        nome: g.nome,
        totalVendas: g.totalVendas,
        valorTotal: formatMoedaBRL(g.valorTotal),
        metaValor: formatMoedaBRL(g.metaValor),
        valorRealizado: formatMoedaBRL(g.valorRealizado),
        atingimento: formatPercentBR(g.metaAchievement),
      })),
      ...data.vendedores.map((v) => ({
        tipo: 'Vendedor',
        nome: v.nome,
        totalVendas: v.totalVendas,
        valorTotal: formatMoedaBRL(v.valorTotal),
        metaValor: formatMoedaBRL(v.metaValor),
        valorRealizado: formatMoedaBRL(v.valorRealizado),
        atingimento: formatPercentBR(v.metaAchievement),
      })),
    ],
  })
}

export function exportPerformanceToPDF(data: PerformanceReportData) {
  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Indicadores Globais de Performance',
      descricao:
        'Visão sintética do faturamento total acumulado, volume de transações, ticket médio e taxa média de conversão da equipe comercial.',
      kpis: [
        {
          label: 'Total de Vendas',
          valor: String(data.summary.totalVendas),
          sub: 'Pedidos faturados',
          accent: 'primary',
        },
        {
          label: 'Faturamento Total',
          valor: formatMoedaBRL(data.summary.valorTotal),
          sub: 'Receita comercial acumulada',
          accent: 'amber',
        },
        {
          label: 'Ticket Médio',
          valor: formatMoedaBRL(data.summary.ticketMedio),
          sub: 'Média por operação',
          accent: 'emerald',
        },
        {
          label: 'Clientes Atendidos',
          valor: String(data.summary.numClientes),
          sub: 'Com compras realizadas',
          accent: 'sky',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Performance por Gestor Técnico',
      descricao:
        'Acompanhamento das lideranças técnicas com volume de vendas, metas planejadas e taxa de alcance.',
      table: {
        columns: [
          { header: 'Gestor Técnico', align: 'left', isBold: true },
          { header: 'Qtd Vendas', width: '100px', align: 'right' },
          { header: 'Valor Total (R$)', align: 'right' },
          { header: 'Meta (R$)', align: 'right' },
          { header: 'Atingimento (%)', width: '130px', align: 'right' },
        ],
        rows: data.gestores.map((g) => [
          g.nome,
          String(g.totalVendas),
          formatMoedaBRL(g.valorTotal),
          formatMoedaBRL(g.metaValor),
          g.metaValor > 0 ? formatPercentBR(g.metaAchievement) : '—',
        ]),
        emptyMessage: 'Nenhum gestor técnico listado no período.',
      },
    },
    {
      numero: 3,
      titulo: 'Performance por Vendedor Comercial',
      descricao:
        'Desempenho individualizado dos vendedores com valores executados, metas e percentual de entrega.',
      table: {
        columns: [
          { header: 'Vendedor', align: 'left', isBold: true },
          { header: 'Qtd Vendas', width: '100px', align: 'right' },
          { header: 'Valor Total (R$)', align: 'right' },
          { header: 'Meta (R$)', align: 'right' },
          { header: 'Atingimento (%)', width: '130px', align: 'right' },
        ],
        rows: data.vendedores.map((v) => [
          v.nome,
          String(v.totalVendas),
          formatMoedaBRL(v.valorTotal),
          formatMoedaBRL(v.metaValor),
          v.metaValor > 0 ? formatPercentBR(v.metaAchievement) : '—',
        ]),
        emptyMessage: 'Nenhum vendedor comercial listado no período.',
      },
    },
  ]

  return openCorporatePdfReport({
    titulo: 'Relatório Executivo de Performance Comercial',
    subtitulo: 'Painel de Desempenho e Metas · Gestores Técnicos e Consultores Comerciais B2B',
    origem: 'Módulo de Performance (/relatorio-performance)',
    periodo: 'Consolidado Geral',
    sections,
    orientacao: 'portrait',
  })
}
