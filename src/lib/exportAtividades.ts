import type { Atividade } from '@/types'
import {
  openCorporatePdfReport,
  exportCorporateExcel,
  formatMoedaBRL,
  formatDataBR,
  buildDocumentFileName,
  type PdfSection,
} from '@/lib/corporateDocuments'

const TIPO_LABELS: Record<string, string> = {
  visita: 'Visita',
  ligacao: 'Ligação',
  proposta: 'Proposta',
  follow_up: 'Follow-up',
  reuniao: 'Reunião',
}

const ORIGEM_LABELS: Record<string, string> = {
  audio: 'Áudio',
  manual: 'Manual',
  excel: 'Planilha',
}

/**
 * Exporta atividades em formato Excel (.xlsx) corporativo
 */
export function exportAtividadesToCSV(
  atividades: Atividade[],
  filters: { dataInicial: string; dataFinal: string },
) {
  const periodoStr = `${filters.dataInicial ? formatDataBR(filters.dataInicial) : 'Início'} até ${filters.dataFinal ? formatDataBR(filters.dataFinal) : 'Hoje'}`
  const valorTotal = atividades.reduce((acc, a) => acc + (a.valor_estimado || 0), 0)

  exportCorporateExcel({
    slug: 'relatorio-atividades',
    metadata: {
      titulo: 'Relatório de Atividades Comerciais',
      subtitulo: 'Registro Analítico de Visitas, Reuniões, Ligações e Follow-ups de Campo',
      origem: 'Módulo de Atividades Comerciais (/atividades)',
      periodo: periodoStr,
      filtros: {
        'Data Inicial': filters.dataInicial ? formatDataBR(filters.dataInicial) : 'Início',
        'Data Final': filters.dataFinal ? formatDataBR(filters.dataFinal) : 'Hoje',
      },
      totalizacoes: [{ label: 'VALOR TOTAL ESTIMADO (R$):', valor: formatMoedaBRL(valorTotal) }],
    },
    columns: [
      { key: 'data', label: 'Data', width: 14 },
      { key: 'vendedor', label: 'Vendedor Responsável', width: 26 },
      { key: 'cliente', label: 'Cliente / Fábrica', width: 30 },
      { key: 'tipo', label: 'Tipo de Atividade', width: 18 },
      { key: 'etapa', label: 'Etapa do Funil', width: 22 },
      { key: 'valor', label: 'Valor Estimado (R$)', width: 22, isCurrency: true },
      { key: 'proximoPasso', label: 'Próximo Passo', width: 32 },
      { key: 'pendencias', label: 'Pendências', width: 30 },
      { key: 'origem', label: 'Origem do Registro', width: 18 },
    ],
    rows: atividades.map((a) => ({
      data: formatDataBR(a.created),
      vendedor: a.expand?.vendedor_id?.name || '—',
      cliente: a.expand?.cliente_id?.name || '—',
      tipo: TIPO_LABELS[a.tipo_atividade] || a.tipo_atividade || '—',
      etapa: a.etapa_funil || '—',
      valor: a.valor_estimado ? formatMoedaBRL(a.valor_estimado) : 'R$ 0,00',
      proximoPasso: a.proximo_passo || '—',
      pendencias: a.pendencias || '—',
      origem: ORIGEM_LABELS[a.origem] || a.origem || '—',
    })),
  })
}

/**
 * Exporta atividades em PDF corporativo executivo
 */
export function exportAtividadesToPDF(
  atividades: Atividade[],
  summary: {
    totalVisitas: number
    totalLigacoes: number
    valorTotal: number
    etapaDist: [string, number][]
  },
  filters: { dataInicial: string; dataFinal: string },
) {
  const periodoStr = `${filters.dataInicial ? formatDataBR(filters.dataInicial) : 'Início'} até ${filters.dataFinal ? formatDataBR(filters.dataFinal) : 'Hoje'}`

  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Resumo das Atividades de Campo',
      descricao:
        'Consolidado de atendimentos realizados pela equipe comercial, total de ligações, reuniões presenciais e estimativa financeira gerada.',
      kpis: [
        {
          label: 'Total de Visitas',
          valor: String(summary.totalVisitas),
          sub: 'Reuniões presenciais',
          accent: 'primary',
        },
        {
          label: 'Total de Ligações',
          valor: String(summary.totalLigacoes),
          sub: 'Contatos remotos e follow-ups',
          accent: 'amber',
        },
        {
          label: 'Valor Total Estimado',
          valor: formatMoedaBRL(summary.valorTotal),
          sub: 'Pipeline de propostas em campo',
          accent: 'emerald',
        },
        {
          label: 'Atividades Registradas',
          valor: String(atividades.length),
          sub: 'No período selecionado',
          accent: 'sky',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Detalhamento Analítico das Atividades',
      descricao:
        'Relação cronológica individualizada com data, vendedor, cliente, tipo de interação e encaminhamentos.',
      table: {
        columns: [
          { header: 'Data', width: '85px', align: 'center', isBold: true },
          { header: 'Vendedor', align: 'left' },
          { header: 'Cliente', align: 'left' },
          { header: 'Tipo', width: '85px', align: 'center' },
          { header: 'Etapa Funil', width: '120px', align: 'left' },
          { header: 'Valor Estimado', width: '130px', align: 'right' },
          { header: 'Próximo Passo / Pendências', align: 'left' },
        ],
        rows: atividades.map((a) => [
          formatDataBR(a.created),
          a.expand?.vendedor_id?.name || '—',
          a.expand?.cliente_id?.name || '—',
          TIPO_LABELS[a.tipo_atividade] || a.tipo_atividade || '—',
          a.etapa_funil || '—',
          a.valor_estimado ? formatMoedaBRL(a.valor_estimado) : '—',
          [a.proximo_passo, a.pendencias].filter(Boolean).join(' | ') || '—',
        ]),
        footerRow: [
          'TOTAL:',
          `${atividades.length} registro(s)`,
          '',
          '',
          '',
          formatMoedaBRL(summary.valorTotal),
          '',
        ],
        emptyMessage: 'Nenhuma atividade registrada para os filtros especificados.',
      },
    },
  ]

  return openCorporatePdfReport({
    titulo: 'Relatório Executivo de Atividades Comerciais',
    subtitulo: 'Acompanhamento de Rotina, Prospecção e Relacionamento com Clientes B2B',
    origem: 'Módulo de Atividades Comerciais (/atividades)',
    periodo: periodoStr,
    filtros: {
      'Data Inicial': filters.dataInicial ? formatDataBR(filters.dataInicial) : 'Início',
      'Data Final': filters.dataFinal ? formatDataBR(filters.dataFinal) : 'Hoje',
    },
    sections,
    orientacao: 'landscape',
  })
}
