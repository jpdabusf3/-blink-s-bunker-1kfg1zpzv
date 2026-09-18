import type { Factory } from '@/types'
import {
  exportCorporateExcel,
  openCorporatePdfReport,
  formatMoedaBRL,
  getLoggedUserName,
  type ExcelColumnDef,
  type PdfSection,
} from './corporateDocuments'

export function exportFunilVendasToExcel(items: Factory[]) {
  const columns: ExcelColumnDef[] = [
    { key: 'cliente', label: 'Cliente / Razão Social', width: 34 },
    { key: 'valorMedio', label: 'Valor Médio de Compra (R$)', width: 22, isCurrency: true },
    { key: 'valorAtual', label: 'Valor em Negociação (R$)', width: 22, isCurrency: true },
    { key: 'statusFunil', label: 'Status no Funil Comercial', width: 20 },
    { key: 'proximosPassos', label: 'Próximos Passos Comerciais', width: 32 },
    { key: 'acao', label: 'Plano de Ação Estratégico', width: 32 },
    { key: 'gestor', label: 'Gestor Técnico Responsável', width: 24 },
    { key: 'vendedor', label: 'Vendedor Responsável', width: 24 },
  ]

  let somaMedio = 0
  let somaAtual = 0

  const rows = items.map((f) => {
    const vm = Number(f.valor_medio || 0)
    const va = Number(f.valor_atual || 0)
    somaMedio += vm
    somaAtual += va

    return {
      cliente: f.name || 'Não informado',
      valorMedio: vm,
      valorAtual: va,
      statusFunil: f.status_funil || (typeof f.funnelStage === 'string' ? f.funnelStage : '—'),
      proximosPassos: f.proximos_passos || '—',
      acao: f.acao || '—',
      gestor: f.gestor_tecnico_name || f.technicalManagerName || '—',
      vendedor: f.vendedor_name || f.salesOwnerName || '—',
    }
  })

  exportCorporateExcel({
    slug: 'funil-vendas',
    metadata: {
      titulo: 'Funil de Vendas e Oportunidades',
      subtitulo:
        'Acompanhamento do pipeline de contas, estágios de qualificação e ações planejadas',
      origem: 'Funil de Vendas (/funil-vendas)',
      periodo: 'Consolidado Atual',
      geradoPor: getLoggedUserName(),
      totalizacoes: [
        { label: 'VALOR MÉDIO HISTÓRICO TOTAL (R$):', valor: somaMedio },
        { label: 'VALOR ATUAL EM NEGOCIAÇÃO (R$):', valor: somaAtual },
      ],
    },
    columns,
    rows,
  })
}

export function exportFunilVendasToPDF(items: Factory[]) {
  const somaMedio = items.reduce((s, f) => s + Number(f.valor_medio || 0), 0)
  const somaAtual = items.reduce((s, f) => s + Number(f.valor_atual || 0), 0)

  const rows = items.map((f) => [
    f.name || '—',
    formatMoedaBRL(f.valor_medio || 0),
    formatMoedaBRL(f.valor_atual || 0),
    f.status_funil || (typeof f.funnelStage === 'string' ? f.funnelStage : '—'),
    f.proximos_passos || '—',
    f.acao || '—',
    f.vendedor_name || f.salesOwnerName || '—',
  ])

  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Visão Geral do Funil de Vendas',
      descricao:
        'Indicadores consolidados de oportunidades ativas e valores envolvidos no pipeline.',
      kpis: [
        {
          label: 'Total de Oportunidades',
          valor: String(items.length),
          sub: 'Contas em negociação',
          accent: 'sky',
        },
        {
          label: 'Valor em Negociação',
          valor: formatMoedaBRL(somaAtual),
          sub: 'Pipeline ativo',
          accent: 'primary',
        },
        {
          label: 'Valor Médio das Contas',
          valor: formatMoedaBRL(somaMedio),
          sub: 'Potencial consolidado',
          accent: 'emerald',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Oportunidades em Aberto e Próximos Passos',
      descricao:
        'Mapeamento detalhado por conta, estágio do funil, valor e próximas ações comerciais.',
      table: {
        columns: [
          { header: 'Cliente / Razão Social', isBold: true },
          { header: 'Valor Médio (R$)', width: '100px', align: 'right' },
          { header: 'Valor Atual (R$)', width: '100px', align: 'right', isBold: true },
          { header: 'Status no Funil', width: '90px', align: 'center' },
          { header: 'Próximos Passos', width: '140px' },
          { header: 'Plano de Ação', width: '140px' },
          { header: 'Vendedor', width: '95px' },
        ],
        rows,
        footerRow: [
          'TOTAL GERAL',
          formatMoedaBRL(somaMedio),
          formatMoedaBRL(somaAtual),
          `${items.length} contas`,
          '—',
          '—',
          '—',
        ],
      },
    },
  ]

  openCorporatePdfReport({
    titulo: 'Funil de Vendas Corporativo',
    subtitulo: 'Pipeline de Oportunidades, Estágios de Conversão e Próximos Passos',
    origem: 'Funil de Vendas (/funil-vendas)',
    periodo: 'Consolidado Vigente',
    geradoPor: getLoggedUserName(),
    orientacao: 'landscape',
    sections,
  })
}
