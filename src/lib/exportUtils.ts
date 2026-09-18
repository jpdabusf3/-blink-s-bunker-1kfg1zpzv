import { Order, Factory } from '@/types'
import {
  openCorporatePdfReport,
  exportCorporateExcel,
  formatMoedaBRL,
  formatDataBR,
  type PdfSection,
} from '@/lib/corporateDocuments'

export function exportOrdersToExcel(filteredOrders: Order[], factories: Factory[]) {
  const totalGeral = filteredOrders.reduce((acc, o) => acc + (o.totalValue || 0), 0)

  exportCorporateExcel({
    slug: 'pedidos-venda',
    metadata: {
      titulo: 'Relatório Analítico de Pedidos de Venda',
      subtitulo: 'Acompanhamento Consolidado de Pedidos Comerciais e Faturamento B2B',
      origem: 'Módulo de Pedidos (/pedidos)',
      periodo: 'Consolidado Geral',
      totalizacoes: [{ label: 'VALOR TOTAL DE PEDIDOS (R$):', valor: formatMoedaBRL(totalGeral) }],
    },
    columns: [
      { key: 'id', label: 'ID do Pedido', width: 14 },
      { key: 'data', label: 'Data do Pedido', width: 14 },
      { key: 'fabrica', label: 'Fábrica / Cliente', width: 30 },
      { key: 'canal', label: 'Canal de Venda', width: 18 },
      { key: 'regiao', label: 'Região Geográfica', width: 20 },
      { key: 'produto', label: 'Produto', width: 28 },
      { key: 'linha', label: 'Linha', width: 18 },
      { key: 'qtd', label: 'Quantidade', width: 14, isNumeric: true },
      { key: 'valorUnitario', label: 'Valor Unitário (R$)', width: 20, isCurrency: true },
      { key: 'valorTotal', label: 'Valor Total (R$)', width: 22, isCurrency: true },
    ],
    rows: filteredOrders.map((o) => {
      const factory = factories.find((f) => f.id === o.factoryId)
      const channelLabel =
        factory?.salesChannel === 'Indirect' ? factory.indirectChannelType : factory?.salesChannel
      return {
        id: o.id.substring(0, 8),
        data: formatDataBR(o.orderDate),
        fabrica: factory?.name || 'Desconhecida',
        canal: channelLabel || '—',
        regiao: String(
          Array.isArray(factory?.region) ? factory?.region.join(', ') : factory?.region || '—',
        ),
        produto: o.product,
        linha: o.line || '—',
        qtd: o.quantity,
        valorUnitario: formatMoedaBRL(o.unitValue),
        valorTotal: formatMoedaBRL(o.totalValue),
      }
    }),
  })
}

export function exportOrdersToPDF(
  filteredOrders: Order[],
  factories: Factory[],
  filters?: {
    factoryIdParam?: string
    productLine?: string
    startDate?: string
    endDate?: string
    template?: string
  },
) {
  const totalOrders = filteredOrders.reduce((acc, o) => acc + (o.totalValue || 0), 0)
  const totalItens = filteredOrders.reduce((acc, o) => acc + (o.quantity || 0), 0)

  const periodoStr = `${filters?.startDate ? formatDataBR(filters.startDate) : 'Início'} até ${filters?.endDate ? formatDataBR(filters.endDate) : 'Hoje'}`
  const selectedFactoryName =
    filters?.factoryIdParam && filters.factoryIdParam !== 'all'
      ? factories.find((f) => f.id === filters.factoryIdParam)?.name || filters.factoryIdParam
      : 'Todas as Fábricas'

  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Indicadores dos Pedidos de Venda',
      descricao:
        'Síntese com montante financeiro total, volume de pedidos comercializados e unidades demandadas.',
      kpis: [
        {
          label: 'Valor Total de Pedidos',
          valor: formatMoedaBRL(totalOrders),
          sub: 'Receita comercial consolidada',
          accent: 'primary',
        },
        {
          label: 'Quantidade de Pedidos',
          valor: String(filteredOrders.length),
          sub: 'Operações emitidas',
          accent: 'amber',
        },
        {
          label: 'Total de Itens / Unidades',
          valor: String(totalItens),
          sub: 'Unidades de produtos',
          accent: 'emerald',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Detalhamento Analítico dos Pedidos',
      descricao:
        'Registro individual de cada pedido com identificação do cliente, produto, quantidades e valores monetários.',
      table: {
        columns: [
          { header: 'ID', width: '70px', align: 'center', isBold: true },
          { header: 'Data', width: '85px', align: 'center' },
          { header: 'Fábrica / Cliente', align: 'left' },
          { header: 'Produto', align: 'left' },
          { header: 'Qtd', width: '60px', align: 'right' },
          { header: 'Valor Unitário', width: '120px', align: 'right' },
          { header: 'Valor Total', width: '130px', align: 'right' },
        ],
        rows: filteredOrders.map((o) => {
          const factory = factories.find((f) => f.id === o.factoryId)
          return [
            o.id.substring(0, 8),
            formatDataBR(o.orderDate),
            factory?.name || 'Desconhecida',
            o.product,
            String(o.quantity),
            formatMoedaBRL(o.unitValue),
            formatMoedaBRL(o.totalValue),
          ]
        }),
        footerRow: [
          'TOTAL:',
          `${filteredOrders.length} pedido(s)`,
          '',
          '',
          String(totalItens),
          '',
          formatMoedaBRL(totalOrders),
        ],
        emptyMessage: 'Nenhum pedido encontrado para os filtros selecionados.',
      },
    },
  ]

  return openCorporatePdfReport({
    titulo: 'Relatório Executivo de Pedidos de Venda',
    subtitulo: 'Demonstrativo Comercial de Pedidos, Produtos e Faturamento por Cliente',
    origem: 'Módulo de Pedidos (/pedidos)',
    periodo: periodoStr,
    filtros: {
      Fábrica: selectedFactoryName,
      'Linha de Produto':
        filters?.productLine && filters.productLine !== 'all'
          ? filters.productLine
          : 'Todas as Linhas',
      Período: periodoStr,
    },
    sections,
    orientacao: 'landscape',
  })
}
