import { UserListItem, UserReport } from '@/services/users'
import { ActivityLog, Factory } from '@/types'
import {
  openCorporatePdfReport,
  exportCorporateExcel,
  formatMoedaBRL,
  formatPercentBR,
  formatDataBR,
  formatDataHoraBR,
  type PdfSection,
} from '@/lib/corporateDocuments'
import { COUNTRY_TO_CONTINENT } from './continent-mapping'
import { getActiveTemplate } from '@/services/excel-templates'

/**
 * Exporta relatório individual do usuário em Excel corporativo (.xlsx)
 */
export function exportUserReportToExcel(user: UserListItem, report: UserReport) {
  exportCorporateExcel({
    slug: `relatorio-usuario-${user.email}`,
    metadata: {
      titulo: `Relatório do Colaborador — ${user.name || user.email}`,
      subtitulo: `Cargo: ${user.job_title || 'N/A'} · Região: ${user.geographicArea || 'N/A'}`,
      origem: 'Módulo de Usuários (/users)',
      periodo: 'Consolidado Geral',
      totalizacoes: [
        { label: 'VENDAS TOTAIS (R$):', valor: formatMoedaBRL(report.kpis.totalOrdersValue) },
        { label: 'META TOTAL (R$):', valor: formatMoedaBRL(report.kpis.totalTargetsValue) },
        { label: 'ATINGIMENTO DE METAS:', valor: formatPercentBR(report.kpis.goalsAchieved) },
      ],
    },
    columns: [
      { key: 'data', label: 'Data / Hora', width: 18 },
      { key: 'acao', label: 'Ação Realizada', width: 28 },
      { key: 'detalhes', label: 'Detalhes da Operação', width: 45 },
    ],
    rows: report.logs.map((l) => ({
      data: formatDataHoraBR(l.created),
      acao: l.action,
      detalhes: l.details || '—',
    })),
  })
}

/**
 * Exporta relatório individual do usuário em PDF corporativo executivo
 */
export function exportUserReportToPDF(user: UserListItem, report: UserReport) {
  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Indicadores Individuais de Performance',
      descricao:
        'Acompanhamento direto do atingimento de metas comerciais, prospecção e homologação de contas.',
      kpis: [
        {
          label: 'Atingimento de Metas',
          valor: formatPercentBR(report.kpis.goalsAchieved),
          sub: 'Taxa global de metas',
          accent: 'primary',
        },
        {
          label: 'Prospectos Ativos',
          valor: String(report.kpis.prospects),
          sub: 'Contas em prospecção',
          accent: 'amber',
        },
        {
          label: 'Fábricas Homologadas',
          valor: String(report.kpis.homologated),
          sub: 'Clientes ativos',
          accent: 'emerald',
        },
        {
          label: 'Vendas Totais Realizadas',
          valor: formatMoedaBRL(report.kpis.totalOrdersValue),
          sub: 'Volume comercial fechado',
          accent: 'sky',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Histórico Recente de Ações e Logs do Usuário',
      descricao:
        "Registro de auditoria com atividades executadas pelo colaborador dentro do sistema Blink's Bunker.",
      table: {
        columns: [
          { header: 'Data e Hora', width: '130px', align: 'center', isBold: true },
          { header: 'Ação Registrada', width: '220px', align: 'left' },
          { header: 'Detalhamento da Operação', align: 'left' },
        ],
        rows: report.logs.map((l) => [formatDataHoraBR(l.created), l.action, l.details || '—']),
        footerRow: ['TOTAL DE REGISTROS:', `${report.logs.length} ação(ões)`, ''],
        emptyMessage: 'Nenhuma ação recente registrada para este colaborador.',
      },
    },
  ]

  return openCorporatePdfReport({
    titulo: `Relatório Individual do Colaborador — ${user.name || user.email}`,
    subtitulo: `Cargo: ${user.job_title || 'N/A'} · Área / Região: ${user.geographicArea || 'N/A'} · País: ${user.country || 'Brasil'}`,
    origem: 'Módulo de Usuários (/users)',
    periodo: 'Consolidado Geral',
    filtros: {
      Colaborador: user.name || user.email,
      Cargo: user.job_title || 'N/A',
      Email: user.email,
    },
    sections,
    orientacao: 'portrait',
  })
}

/**
 * Exporta macro relatório executivo da carteira em Excel (.xlsx)
 */
export async function exportExecutiveMacroReport(
  factories: Factory[],
  filtersApplied?: Record<string, string>,
) {
  let templateName = ''
  try {
    const template = await getActiveTemplate()
    if (template) templateName = template.name
  } catch {
    /* noop */
  }

  const totalPotencial = factories.reduce((s, f) => s + (f.potentialValue || 0), 0)

  exportCorporateExcel({
    slug: 'relatorio-executivo-macro',
    metadata: {
      titulo: 'Relatório Executivo Macro de Clientes e Fábricas',
      subtitulo: `Template: ${templateName || 'Padrão Corporativo'} · Mapeamento Completo da Carteira`,
      origem: 'Painel Geral de Relatórios (/relatorios)',
      periodo: 'Consolidado Geral',
      filtros: filtersApplied,
      totalizacoes: [
        { label: 'TOTAL DE CLIENTES / FÁBRICAS:', valor: factories.length },
        { label: 'POTENCIAL TOTAL DA CARTEIRA (R$):', valor: formatMoedaBRL(totalPotencial) },
      ],
    },
    columns: [
      { key: 'fabrica', label: 'Fábrica / Razão Social', width: 30 },
      { key: 'perfil', label: 'Perfil / Carteira', width: 20 },
      { key: 'especie', label: 'Espécie Animal', width: 18 },
      { key: 'canal', label: 'Canal de Venda', width: 18 },
      { key: 'pais', label: 'País', width: 16 },
      { key: 'localizacao', label: 'Estado / Cidade', width: 22 },
      { key: 'status', label: 'Status Cadastral', width: 18 },
      { key: 'estagio', label: 'Estágio do Funil', width: 18 },
      { key: 'prioridade', label: 'Prioridade', width: 14 },
      { key: 'potencial', label: 'Potencial Estimado (R$)', width: 22, isCurrency: true },
      { key: 'responsavel', label: 'Gestor / Vendedor', width: 24 },
    ],
    rows: factories.map((f) => ({
      fabrica: f.name || 'Sem nome',
      perfil: f.profile_type || f.sector || '—',
      especie: f.animalSpecies || 'Multiespécie',
      canal: f.salesChannel === 'Indirect' ? `Indireto (${f.indirectChannelType || ''})` : 'Direto',
      pais: f.country || 'Brasil',
      localizacao: [f.city, f.state].filter(Boolean).join(' - ') || '—',
      status: f.status || '—',
      estagio: f.funnelStage || '—',
      prioridade: f.priority || 'Média',
      potencial: formatMoedaBRL(f.potentialValue || 0),
      responsavel: f.salesOwnerName || f.salesOwner || 'Não atribuído',
    })),
  })
}

export async function exportGeographicReport(factories: Factory[]) {
  return exportExecutiveMacroReport(factories)
}

/**
 * Exporta equipe comercial para planilha Excel (.xlsx) corporativa
 */
export function exportTeamToExcel(users: UserListItem[]) {
  exportCorporateExcel({
    slug: 'relatorio-equipe',
    metadata: {
      titulo: 'Relatório Corporativo da Equipe Comercial',
      subtitulo: 'Cadastro, Cargos, Contatos e Áreas de Atuação dos Colaboradores',
      origem: 'Gestão de Equipe (/equipe)',
      periodo: 'Consolidado Geral',
      totalizacoes: [{ label: 'TOTAL DE COLABORADORES:', valor: users.length }],
    },
    columns: [
      { key: 'nome', label: 'Nome Completo', width: 28 },
      { key: 'email', label: 'E-mail Institucional', width: 30 },
      { key: 'cargo', label: 'Cargo / Função', width: 24 },
      { key: 'area', label: 'Área / Território de Atuação', width: 26 },
      { key: 'pais', label: 'País de Origem', width: 16 },
      { key: 'whatsapp', label: 'WhatsApp', width: 18 },
      { key: 'validado', label: 'Validado por WhatsApp', width: 20 },
      { key: 'dataCadastro', label: 'Data de Cadastro', width: 16 },
    ],
    rows: users.map((u) => ({
      nome: u.name || '—',
      email: u.email,
      cargo: u.job_title || '—',
      area: u.geographicArea || '—',
      pais: u.country || 'Brasil',
      whatsapp: u.whatsapp || '—',
      validado: u.whatsapp_validated ? 'Sim' : 'Não',
      dataCadastro: formatDataBR(u.created),
    })),
  })
}

/**
 * Exporta logs de auditoria em Excel (.xlsx) corporativo
 */
export function exportActivityLogsToExcel(logs: ActivityLog[]) {
  exportCorporateExcel({
    slug: 'logs-auditoria-atividades',
    metadata: {
      titulo: 'Logs de Auditoria e Atividades do Sistema',
      subtitulo: 'Rastreabilidade Completa de Operações, Autenticações e Alterações',
      origem: 'Painel de Auditoria (/admin/logs)',
      periodo: 'Consolidado Geral',
      totalizacoes: [{ label: 'TOTAL DE REGISTROS DE AUDITORIA:', valor: logs.length }],
    },
    columns: [
      { key: 'data', label: 'Data e Hora', width: 18 },
      { key: 'usuario', label: 'Usuário Responsável', width: 26 },
      { key: 'acao', label: 'Ação Realizada', width: 30 },
      { key: 'detalhes', label: 'Detalhamento do Registro', width: 50 },
    ],
    rows: logs.map((l) => ({
      data: formatDataHoraBR(l.created),
      usuario: l.expand?.user?.name || l.expand?.user?.email || 'Sistema / Automático',
      acao: l.action,
      detalhes: l.details || '—',
    })),
  })
}

/**
 * Exporta logs de auditoria em PDF corporativo executivo
 */
export function exportActivityLogsToPDF(logs: ActivityLog[]) {
  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Auditoria de Ações e Logs do Bunker',
      descricao:
        'Registro corporativo de eventos, sincronizações e execuções operacionais registradas no sistema.',
      table: {
        columns: [
          { header: 'Data e Hora', width: '130px', align: 'center', isBold: true },
          { header: 'Usuário', width: '180px', align: 'left' },
          { header: 'Ação', width: '220px', align: 'left' },
          { header: 'Detalhes da Operação', align: 'left' },
        ],
        rows: logs.map((l) => [
          formatDataHoraBR(l.created),
          l.expand?.user?.name || l.expand?.user?.email || 'Sistema',
          l.action,
          l.details || '—',
        ]),
        footerRow: ['TOTAL:', `${logs.length} evento(s) auditado(s)`, '', ''],
        emptyMessage: 'Nenhum registro de log encontrado.',
      },
    },
  ]

  return openCorporatePdfReport({
    titulo: 'Logs de Atividade e Auditoria do Bunker',
    subtitulo: 'Relatório Oficial de Rastreabilidade e Governança Operacional',
    origem: 'Painel Administrativo (/admin/logs)',
    periodo: 'Consolidado Geral',
    sections,
    orientacao: 'landscape',
  })
}
