import type { Factory } from '@/types'
import {
  exportCorporateExcel,
  openCorporatePdfReport,
  formatDataBR,
  formatMoedaBRL,
  getLoggedUserName,
  type ExcelColumnDef,
  type PdfSection,
} from './corporateDocuments'

export interface FunilExportRow {
  nome: string
  especie: string
  gestor: string
  vendedor: string
  statusFunil: string
  dataMudanca: string
  diasNoEstagio: number
  motivoPerda?: string
}

export function exportFunilToExcel(rowsData: FunilExportRow[]) {
  const columns: ExcelColumnDef[] = [
    { key: 'nome', label: 'Cliente / Razão Social', width: 34 },
    { key: 'especie', label: 'Espécie Animal Atendida', width: 22 },
    { key: 'gestor', label: 'Gestor Técnico Responsável', width: 24 },
    { key: 'vendedor', label: 'Vendedor Responsável', width: 24 },
    { key: 'statusFunil', label: 'Estágio Atual do Funil', width: 22 },
    { key: 'dataMudanca', label: 'Data da Última Mudança', width: 18 },
    { key: 'diasNoEstagio', label: 'Dias no Estágio', width: 16, isNumeric: true },
    { key: 'motivoPerda', label: 'Motivo da Perda (quando aplicável)', width: 32 },
  ]

  const rows = rowsData.map((r) => ({
    nome: r.nome || 'Não informado',
    especie: r.especie || '—',
    gestor: r.gestor || 'Não atribuído',
    vendedor: r.vendedor || 'Não atribuído',
    statusFunil: r.statusFunil || '—',
    dataMudanca: formatDataBR(r.dataMudanca),
    diasNoEstagio: Number(r.diasNoEstagio || 0),
    motivoPerda: r.motivoPerda || '—',
  }))

  const mediaDias =
    rowsData.length > 0
      ? Math.round(rowsData.reduce((s, r) => s + (r.diasNoEstagio || 0), 0) / rowsData.length)
      : 0

  exportCorporateExcel({
    slug: 'funil-clientes',
    metadata: {
      titulo: 'Pipeline de Clientes no Funil Comercial',
      subtitulo: 'Status de evolução das contas, tempo em cada estágio e histórico de perdas',
      origem: 'Gestão de Funil (/funil)',
      periodo: 'Consolidado Geral',
      geradoPor: getLoggedUserName(),
      totalizacoes: [
        { label: 'TOTAL DE CONTAS NO FUNIL:', valor: rowsData.length },
        { label: 'TEMPO MÉDIO NO ESTÁGIO ATUAL (DIAS):', valor: mediaDias },
      ],
    },
    columns,
    rows,
  })
}

export function exportFunilToPDF(rowsData: FunilExportRow[]) {
  const mediaDias =
    rowsData.length > 0
      ? Math.round(rowsData.reduce((s, r) => s + (r.diasNoEstagio || 0), 0) / rowsData.length)
      : 0

  const tableRows = rowsData.map((r) => [
    r.nome || '—',
    r.especie || '—',
    r.gestor || '—',
    r.vendedor || '—',
    r.statusFunil || '—',
    formatDataBR(r.dataMudanca),
    `${r.diasNoEstagio || 0} dias`,
    r.motivoPerda || '—',
  ])

  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Indicadores Globais de Funil',
      descricao: 'Visão executiva das contas ativas por maturidade comercial.',
      kpis: [
        {
          label: 'Total de Contas',
          valor: String(rowsData.length),
          sub: 'Mapeadas no processo comercial',
          accent: 'sky',
        },
        {
          label: 'Permanência Média',
          valor: `${mediaDias} dias`,
          sub: 'Tempo médio no estágio atual',
          accent: 'amber',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Listagem de Clientes por Estágio',
      descricao: 'Acompanhamento nominal dos clientes, responsáveis técnicos e comerciais.',
      table: {
        columns: [
          { header: 'Cliente / Razão Social', isBold: true },
          { header: 'Espécie', width: '85px' },
          { header: 'Gestor Técnico', width: '100px' },
          { header: 'Vendedor', width: '100px' },
          { header: 'Estágio Atual', width: '90px', align: 'center' },
          { header: 'Última Mudança', width: '85px', align: 'center' },
          { header: 'Permanência', width: '80px', align: 'right' },
          { header: 'Motivo da Perda', width: '120px' },
        ],
        rows: tableRows,
        footerRow: [
          'TOTAL DE CONTAS',
          '—',
          '—',
          '—',
          `${rowsData.length} contas`,
          '—',
          `Média: ${mediaDias} d`,
          '—',
        ],
      },
    },
  ]

  openCorporatePdfReport({
    titulo: 'Relatório Executivo do Funil de Clientes',
    subtitulo: 'Status e Evolução da Carteira Comercial de Contas',
    origem: 'Gestão de Funil (/funil)',
    periodo: 'Consolidado Geral',
    geradoPor: getLoggedUserName(),
    orientacao: 'landscape',
    sections,
  })
}

export function buildFunilExportRows(factories: Factory[]): FunilExportRow[] {
  return factories.map((f) => ({
    nome: f.name || '',
    especie: f.species || '',
    gestor: f.gestor_tecnico_name || f.technicalManagerName || '',
    vendedor: f.vendedor_name || f.salesOwnerName || '',
    statusFunil: f.status_funil || (typeof f.funnelStage === 'string' ? f.funnelStage : ''),
    dataMudanca: f.funnel_stage_changed_at || f.created || '',
    diasNoEstagio: f.funnel_stage_changed_at
      ? Math.floor(
          (Date.now() - new Date(f.funnel_stage_changed_at).getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0,
    motivoPerda: f.motivo_perda || '',
  }))
}
