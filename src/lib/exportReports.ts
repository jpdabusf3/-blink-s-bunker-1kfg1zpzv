import { UserListItem, UserReport } from '@/services/users'
import { ActivityLog } from '@/types'
import { formatCurrency } from './utils'

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
