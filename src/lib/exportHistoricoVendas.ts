import type { HistoricoVenda } from '@/services/historico-vendas'
import { familiaCompleta } from '@/constants/familiaProdutos'
import {
  exportCorporateExcel,
  openCorporatePdfReport,
  formatDataBR,
  formatMoedaBRL,
  getLoggedUserName,
  type ExcelColumnDef,
  type PdfSection,
} from './corporateDocuments'

export interface HistoricoExportFilters {
  periodo?: string
  especie?: string
  gestor?: string
  vendedor?: string
  canal?: string
  status?: string
  origem?: string
  pais?: string
  busca?: string
}

/**
 * Exporta os registros filtrados do Histórico de Vendas para planilha Excel (.xlsx)
 * com modelo formal corporativo para a diretoria da Blink Biotech.
 */
export function exportHistoricoVendasToExcel(
  items: HistoricoVenda[],
  filters?: HistoricoExportFilters,
) {
  const columns: ExcelColumnDef[] = [
    { key: 'dataDoc', label: 'Data de Emissão', width: 15 },
    { key: 'documento', label: 'Documento / NF', width: 16 },
    { key: 'cliente', label: 'Cliente / Destinatário', width: 34 },
    { key: 'uf', label: 'UF', width: 8 },
    { key: 'pais', label: 'País', width: 14 },
    { key: 'codigoProduto', label: 'Código do Produto', width: 16 },
    { key: 'descricaoProduto', label: 'Descrição do Produto', width: 36 },
    { key: 'familiaProduto', label: 'Família / Linha', width: 22 },
    { key: 'quantidade', label: 'Quantidade', width: 14, isNumeric: true },
    { key: 'valorUnitario', label: 'Valor Unitário (R$)', width: 18, isCurrency: true },
    { key: 'valorTotal', label: 'Valor Total (R$)', width: 20, isCurrency: true },
    { key: 'especie', label: 'Espécie Animal', width: 16 },
    { key: 'gestorTecnico', label: 'Gestor Técnico', width: 22 },
    { key: 'vendedor', label: 'Vendedor Responsável', width: 22 },
    { key: 'canalVendas', label: 'Canal de Vendas', width: 18 },
    { key: 'status', label: 'Status da Operação', width: 16 },
    { key: 'origem', label: 'Origem do Registro', width: 14 },
  ]

  let totalVolumeGeral = 0
  let totalQuantidade = 0

  const rows = items.map((r) => {
    const rawDate = r.data_documento || r.data
    const dataDoc = formatDataBR(rawDate)
    const documento = r.numero_documento || '—'
    const cliente = r.destinatario_nome || r.cliente || 'Não informado'
    const uf = r.destinatario_uf || '—'
    const pais = r.pais || 'Brasil'
    const codigoProduto = r.produto_codigo || '—'
    const descricaoProduto = r.produto_descricao || '—'
    const familiaProduto = familiaCompleta(codigoProduto, r.produto_familia || '')
    const qtd = Number(r.produto_quantidade || 0)
    const unit = Number(r.produto_valor_unitario || 0)
    const total = Number(r.produto_valor_total || r.valor || 0)
    const especie = r.especie_destino || r.especie || 'Não informada'
    const gestorTecnico = r.gestor_tecnico || r.expand?.gestor_tecnico_id?.nome || 'Não atribuído'
    const vendedor = r.vendedor || r.expand?.vendedor_id?.nome || 'Não atribuído'
    const canalVendas = r.canal_vendas || 'Direto'
    const status = (r.status || (r.origem === 'pedido' ? 'projetado' : 'realizado')).toUpperCase()
    const origem = (r.origem || 'nf').toUpperCase()

    totalVolumeGeral += total
    totalQuantidade += qtd

    return {
      dataDoc,
      documento,
      cliente,
      uf,
      pais,
      codigoProduto,
      descricaoProduto,
      familiaProduto,
      quantidade: qtd,
      valorUnitario: unit,
      valorTotal: total,
      especie,
      gestorTecnico,
      vendedor,
      canalVendas,
      status,
      origem,
    }
  })

  const ticketMedio = items.length > 0 ? totalVolumeGeral / items.length : 0

  exportCorporateExcel({
    slug: 'historico-vendas',
    metadata: {
      titulo: 'Histórico de Vendas Consolidado',
      subtitulo:
        'Movimentações detalhadas de notas fiscais (realizado) e pedidos de carteira (projetado)',
      origem: 'Histórico de Vendas (/historico-vendas)',
      periodo: filters?.periodo || 'Geral',
      filtros: filters as Record<string, unknown>,
      totalizacoes: [
        { label: 'VALOR TOTAL FATURADO / PROJETADO (R$):', valor: totalVolumeGeral },
        { label: 'QUANTIDADE TOTAL DE PRODUTOS:', valor: totalQuantidade },
        { label: 'TICKET MÉDIO POR OPERAÇÃO (R$):', valor: ticketMedio },
      ],
    },
    columns,
    rows,
  })
}

/**
 * Exporta os registros filtrados do Histórico de Vendas para PDF corporativo
 * pronto para arquivamento pela diretoria da Blink Biotech.
 */
export function exportHistoricoVendasToPDF(
  items: HistoricoVenda[],
  filters?: HistoricoExportFilters,
) {
  const totalValor = items.reduce((s, d) => s + (d.produto_valor_total || d.valor || 0), 0)
  const totalQtd = items.reduce((s, d) => s + Number(d.produto_quantidade || 0), 0)
  const ticketMedio = items.length > 0 ? totalValor / items.length : 0

  // Contagem de realizados vs projetados
  const totalRealizados = items.filter(
    (i) => (i.status || i.origem) !== 'projetado' && i.origem !== 'pedido',
  ).length
  const totalProjetados = items.length - totalRealizados

  const tableRows = items.map((r) => {
    const dataDoc = r.data_documento || r.data
    const dataFormatada = formatDataBR(dataDoc)
    const doc = r.numero_documento || '—'
    const cliente = r.destinatario_nome || r.cliente || '—'
    const produto = r.produto_descricao || r.produto_codigo || '—'
    const especie = r.especie_destino || r.especie || '—'
    const gestor = r.gestor_tecnico || r.expand?.gestor_tecnico_id?.nome || '—'
    const vendedor = r.vendedor || r.expand?.vendedor_id?.nome || '—'
    const canal = r.canal_vendas || '—'
    const total = formatMoedaBRL(r.produto_valor_total || r.valor || 0)
    const status = (r.status || (r.origem === 'pedido' ? 'PROJETADO' : 'REALIZADO')).toUpperCase()

    return [dataFormatada, doc, cliente, produto, especie, gestor, vendedor, canal, total, status]
  })

  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Indicadores Gerais de Volume',
      descricao: 'Visão executiva agregada de receita total, ticket médio e pedidos registrados.',
      kpis: [
        {
          label: 'Total de Registros',
          valor: String(items.length),
          sub: `${totalRealizados} faturados • ${totalProjetados} em carteira`,
          accent: 'sky',
        },
        {
          label: 'Volume Total Consolidado',
          valor: formatMoedaBRL(totalValor),
          sub: 'Receita líquida total no período',
          accent: 'primary',
        },
        {
          label: 'Ticket Médio por Operação',
          valor: formatMoedaBRL(ticketMedio),
          sub: 'Média por documento emitido',
          accent: 'emerald',
        },
        {
          label: 'Volume Físico de Produtos',
          valor: `${totalQtd.toLocaleString('pt-BR')} un.`,
          sub: 'Soma das quantidades negociadas',
          accent: 'amber',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Detalhamento dos Registros de Vendas e Pedidos',
      descricao:
        'Listagem individualizada dos documentos contendo cliente, produto, gestor, vendedor, canal e status.',
      table: {
        columns: [
          { header: 'Data', width: '70px', align: 'center' },
          { header: 'NF / Doc', width: '75px', align: 'center' },
          { header: 'Cliente / Razão Social', isBold: true },
          { header: 'Produto / Linha' },
          { header: 'Espécie', width: '75px' },
          { header: 'Gestor', width: '90px' },
          { header: 'Vendedor', width: '90px' },
          { header: 'Canal', width: '70px' },
          { header: 'Valor Total', width: '95px', align: 'right', isBold: true },
          { header: 'Status', width: '75px', align: 'center' },
        ],
        rows: tableRows,
        footerRow: [
          'TOTAL GERAL',
          `${items.length} doc(s)`,
          '—',
          '—',
          '—',
          '—',
          '—',
          '—',
          formatMoedaBRL(totalValor),
          '—',
        ],
        emptyMessage: 'Nenhum registro encontrado para os filtros selecionados.',
      },
    },
  ]

  openCorporatePdfReport({
    titulo: 'Histórico de Vendas Consolidado',
    subtitulo: 'Relatório Corporativo de Faturamento, NF-e e Backlog de Pedidos',
    origem: 'Histórico de Vendas (/historico-vendas)',
    periodo: filters?.periodo || 'Geral',
    filtros: filters as Record<string, unknown>,
    geradoPor: getLoggedUserName(),
    orientacao: 'landscape',
    sections,
  })
}
