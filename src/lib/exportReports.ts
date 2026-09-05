import { UserListItem, UserReport } from '@/services/users'
import { ActivityLog, Factory } from '@/types'
import { formatCurrency } from './utils'
import { COUNTRY_TO_CONTINENT } from './continent-mapping'
import { getActiveTemplate } from '@/services/excel-templates'

export function exportUserReportToExcel(user: UserListItem, report: UserReport) {
  const sep = ';'
  const lines = [
    ['Relatório de Usuário', 'Blink Biotech'].join(sep),
    '',
    ['Nome', user.name || 'N/A'].join(sep),
    ['Email', user.email].join(sep),
    ['Cargo', user.job_title || 'N/A'].join(sep),
    ['Região', user.geographicArea || 'N/A'].join(sep),
    ['País', user.country || 'N/A'].join(sep),
    '',
    ['Indicadores', 'Valor'].join(sep),
    ['Metas Atingidas (%)', report.kpis.goalsAchieved.toFixed(1) + '%'].join(sep),
    ['Prospectos', report.kpis.prospects].join(sep),
    ['Fábricas Homologadas', report.kpis.homologated].join(sep),
    ['Vendas Totais', report.kpis.totalOrdersValue.toString().replace('.', ',')].join(sep),
    ['Meta Total', report.kpis.totalTargetsValue.toString().replace('.', ',')].join(sep),
    '',
    ['Data', 'Ação', 'Detalhes'].join(sep),
    ...report.logs.map((l) =>
      [
        new Date(l.created).toLocaleDateString('pt-BR'),
        `"${l.action.replace(/"/g, '""')}"`,
        `"${(l.details || '-').replace(/"/g, '""')}"`,
      ].join(sep),
    ),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `relatorio_${user.email}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportUserReportToPDF(user: UserListItem, report: UserReport) {
  const win = window.open('', '_blank')
  if (!win) return
  const html = `<!DOCTYPE html><html><head><title>Relatório - ${user.name}</title><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}h1{color:#1e3a8a}
  .kpi{display:inline-block;margin:10px;padding:15px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;text-align:center}
  .kpi b{display:block;font-size:24px;color:#2563eb}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}
  th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}
  </style></head><body>
  <h1>Relatório de Usuário - Blink Biotech</h1>
  <p><b>Nome:</b> ${user.name || 'N/A'} | <b>Email:</b> ${user.email} | <b>Cargo:</b> ${user.job_title || 'N/A'}</p>
  <p><b>Região:</b> ${user.geographicArea || 'N/A'} | <b>País:</b> ${user.country || 'N/A'}</p>
  <div>
  <div class="kpi"><b>${report.kpis.goalsAchieved.toFixed(1)}%</b>Metas Atingidas</div>
  <div class="kpi"><b>${report.kpis.prospects}</b>Prospectos</div>
  <div class="kpi"><b>${report.kpis.homologated}</b>Homologadas</div>
  <div class="kpi"><b>${formatCurrency(report.kpis.totalOrdersValue)}</b>Vendas Totais</div>
  </div>
  <table><thead><tr><th>Data</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>
  ${report.logs.map((l) => `<tr><td>${new Date(l.created).toLocaleString('pt-BR')}</td><td>${l.action}</td><td>${l.details || '-'}</td></tr>`).join('')}
  </tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
  </body></html>`
  win.document.write(html)
  win.document.close()
}

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

  const aggregates = new Map<
    string,
    {
      continent: string
      country: string
      state: string
      region: string
      count: number
      potential: number
      capacity: number
      activeClients: number
      prospects: number
    }
  >()

  factories.forEach((f) => {
    const continent = COUNTRY_TO_CONTINENT[f.country || ''] || 'Outro'
    const country = f.country || 'Brasil'
    const state = f.state || f.city || 'Não informado'
    const regionStr = String(f.stateRegion || (Array.isArray(f.region) ? f.region.join(', ') : f.region) || 'Não informado')
    const key = `${continent}|${country}|${state}|${regionStr}`

    if (!aggregates.has(key)) {
      aggregates.set(key, {
        continent,
        country,
        state,
        region: regionStr,
        count: 0,
        potential: 0,
        capacity: 0,
        activeClients: 0,
        prospects: 0,
      })
    }
    const agg = aggregates.get(key)!
    agg.count++
    agg.potential += f.potentialValue || 0
    agg.capacity += f.capacity || 0
    if (f.status === 'Atendido') agg.activeClients++
    if (f.status === 'Prospeção') agg.prospects++
  })

  // Format HTML table that opens as full Excel XLSX spreadsheet natively
  const filterDesc = filtersApplied
    ? Object.entries(filtersApplied)
        .filter(([, v]) => v && v !== 'all')
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ') || 'Todas as Fábricas / Sem filtro'
    : 'Todas as Fábricas'

  const totalClients = factories.length
  const totalPotential = factories.reduce((s, f) => s + (f.potentialValue || 0), 0)
  const totalCapacity = factories.reduce((s, f) => s + (f.capacity || 0), 0)

  const xmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8"/>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Relatório Executivo Macro</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        .header { background-color: #1e3a8a; color: #ffffff; font-weight: bold; font-size: 16pt; text-align: center; }
        .sub-header { background-color: #3b82f6; color: #ffffff; font-weight: bold; font-size: 11pt; }
        .title-row { background-color: #f1f5f9; font-weight: bold; }
        .th { background-color: #0f172a; color: #ffffff; font-weight: bold; }
        .number { mso-number-format:"\\#\\,##0\\.00"; text-align: right; }
        .int { mso-number-format:"\\#\\,##0"; text-align: right; }
        .total { background-color: #e2e8f0; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="9" class="header">RELATÓRIO EXECUTIVO MACRO - BLINK BIOTECH</td></tr>
        <tr><td colspan="9"><b>Template:</b> ${templateName || 'Padrão'} | <b>Gerado em:</b> ${new Date().toLocaleString('pt-BR')}</td></tr>
        <tr><td colspan="9"><b>Filtros Aplicados:</b> ${filterDesc}</td></tr>
        <tr><td colspan="9"></td></tr>

        <tr class="title-row"><td colspan="9">RESUMO AGREGADO POR PAÍS, ESTADO E REGIÃO</td></tr>
        <tr class="th">
          <th>Continente</th>
          <th>País</th>
          <th>Estado / Cidade</th>
          <th>Região</th>
          <th>Total de Clientes</th>
          <th>Clientes Ativos</th>
          <th>Em Prospecção</th>
          <th>Potencial Total (R$)</th>
          <th>Capacidade Total (t/mês)</th>
        </tr>
        ${Array.from(aggregates.values())
          .map(
            (a) => `
          <tr>
            <td>${a.continent}</td>
            <td>${a.country}</td>
            <td>${a.state}</td>
            <td>${a.region}</td>
            <td class="int">${a.count}</td>
            <td class="int">${a.activeClients}</td>
            <td class="int">${a.prospects}</td>
            <td class="number">${a.potential.toFixed(2)}</td>
            <td class="int">${a.capacity}</td>
          </tr>
        `,
          )
          .join('')}
        <tr class="total">
          <td colspan="4" style="text-align:right">TOTAL GERAL:</td>
          <td class="int">${totalClients}</td>
          <td class="int">${factories.filter((f) => f.status === 'Atendido').length}</td>
          <td class="int">${factories.filter((f) => f.status === 'Prospeção').length}</td>
          <td class="number">${totalPotential.toFixed(2)}</td>
          <td class="int">${totalCapacity}</td>
        </tr>
        <tr><td colspan="9"></td></tr>

        <tr class="title-row"><td colspan="9">DETALHAMENTO COMPLETO DA CARTEIRA DE CLIENTES E PROSPECTOS</td></tr>
        <tr class="th">
          <th>Fábrica</th>
          <th>Perfil / Carteira</th>
          <th>Espécie Animal</th>
          <th>Canal de Venda</th>
          <th>País</th>
          <th>Estado/Cidade</th>
          <th>Status</th>
          <th>Estágio Funil</th>
          <th>Prioridade</th>
          <th>Prob. (%)</th>
          <th>Potencial (R$)</th>
          <th>Gestor Técnico / Vendedor</th>
          <th>Próximos Passos / Abordagem</th>
        </tr>
        ${factories
          .map(
            (f) => `
          <tr>
            <td>${f.name || ''}</td>
            <td>${f.profile_type || f.sector || '-'}</td>
            <td>${f.animalSpecies || 'Multiespécie'}</td>
            <td>${f.salesChannel === 'Indirect' ? `Indireto (${f.indirectChannelType || ''})` : 'Direto'}</td>
            <td>${f.country || 'Brasil'}</td>
            <td>${[f.city, f.state].filter(Boolean).join(' - ')}</td>
            <td>${f.status || ''}</td>
            <td>${f.funnelStage || ''}</td>
            <td>${f.priority || 'Medium'}</td>
            <td class="int">${f.winProbability || 0}</td>
            <td class="number">${(f.potentialValue || 0).toFixed(2)}</td>
            <td>${f.salesOwnerName || f.salesOwner || 'Não atribuído'}</td>
            <td>${f.suggested_approach || f.notes || '-'}</td>
          </tr>
        `,
          )
          .join('')}
      </table>
    </body>
    </html>
  `

  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `relatorio_executivo_macro_blink_${new Date().toISOString().slice(0, 10)}.xlsx`,
  )
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function exportGeographicReport(factories: Factory[]) {
  return exportExecutiveMacroReport(factories)
}

export function exportTeamToExcel(users: UserListItem[]) {
  const sep = ';'
  const headers = [
    'Nome',
    'Email',
    'Cargo',
    'Área de Atuação',
    'País',
    'WhatsApp',
    'Validado por WhatsApp',
    'Data de Cadastro',
  ]
  const lines = [
    headers.join(sep),
    ...users.map((u) =>
      [
        `"${(u.name || 'N/A').replace(/"/g, '""')}"`,
        `"${u.email.replace(/"/g, '""')}"`,
        `"${(u.job_title || 'N/A').replace(/"/g, '""')}"`,
        `"${(u.geographicArea || 'N/A').replace(/"/g, '""')}"`,
        `"${(u.country || 'N/A').replace(/"/g, '""')}"`,
        `"${(u.whatsapp || '').replace(/"/g, '""')}"`,
        `"${u.whatsapp_validated ? 'Sim' : 'Não'}"`,
        new Date(u.created).toLocaleDateString('pt-BR'),
      ].join(sep),
    ),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', 'relatorio_equipe_blink_biotech.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportActivityLogsToExcel(logs: ActivityLog[]) {
  const sep = ';'
  const content = [
    ['Data', 'Usuário', 'Ação', 'Detalhes'].join(sep),
    ...logs.map((l) =>
      [
        new Date(l.created).toLocaleDateString('pt-BR'),
        `"${(l.expand?.user?.name || l.expand?.user?.email || 'Sistema').replace(/"/g, '""')}"`,
        `"${l.action.replace(/"/g, '""')}"`,
        `"${(l.details || '-').replace(/"/g, '""')}"`,
      ].join(sep),
    ),
  ].join('\n')
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', 'logs_atividade_blink_biotech.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportActivityLogsToPDF(logs: ActivityLog[]) {
  const win = window.open('', '_blank')
  if (!win) return
  const html = `<!DOCTYPE html><html><head><title>Logs de Atividade - Blink Biotech</title><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}h1{color:#1e3a8a}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}
  </style></head><body>
  <h1>Logs de Atividade - Blink Biotech</h1>
  <p>Gerado em: ${new Date().toLocaleString('pt-BR')} | Total: ${logs.length} registro(s)</p>
  <table><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>
  ${logs.map((l) => `<tr><td>${new Date(l.created).toLocaleString('pt-BR')}</td><td>${l.expand?.user?.name || l.expand?.user?.email || 'Sistema'}</td><td>${l.action}</td><td>${l.details || '-'}</td></tr>`).join('')}
  </tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
  </body></html>`
  win.document.write(html)
  win.document.close()
}
