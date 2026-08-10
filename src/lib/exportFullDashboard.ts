import type { Factory } from '@/types'
import type { ConsolidatedData } from '@/services/consolidated-dashboard'
import { formatCurrency, formatCompactCurrency } from './utils'

export function exportFullDashboardToPDF(
  funnelItems: Factory[],
  dashboardData: ConsolidatedData | null,
  filters: { vendedor: string; especie: string; status: string },
) {
  const win = window.open('', '_blank')
  if (!win) return

  const kpis = dashboardData?.kpis
  const vendorRanking = dashboardData?.vendorRanking || []
  const gestorRanking = dashboardData?.gestorRanking || []
  const monthComparisons = dashboardData?.monthComparisons || []

  const funnelRows = funnelItems
    .map(
      (f) =>
        `<tr><td>${f.name || ''}</td><td class="r">${formatCurrency(f.valor_medio || 0)}</td><td class="r">${formatCurrency(f.valor_atual || 0)}</td><td>${f.status_funil || '-'}</td><td>${f.proximos_passos || '-'}</td><td>${f.acao || '-'}</td></tr>`,
    )
    .join('')

  const vendorRows = vendorRanking
    .map(
      (v, i) =>
        `<tr><td>${i + 1}º</td><td>${v.nome}</td><td class="r">${formatCurrency(v.totalSales)}</td><td class="r">${formatCurrency(v.metaValor)}</td><td class="r">${formatCurrency(v.valorRealizado)}</td><td class="r">${v.achievementPct.toFixed(1)}%</td></tr>`,
    )
    .join('')

  const gestorRows = gestorRanking
    .map(
      (g, i) =>
        `<tr><td>${i + 1}º</td><td>${g.nome}</td><td class="r">${formatCurrency(g.metaValor)}</td><td class="r">${formatCurrency(g.valorRealizado)}</td><td class="r">${formatCurrency(g.totalSales)}</td><td class="r">${g.achievementPct.toFixed(1)}%</td></tr>`,
    )
    .join('')

  const monthRows = monthComparisons
    .map(
      (m) =>
        `<tr><td>${m.label}</td><td class="r">${formatCurrency(m.sales)}</td><td class="r">${formatCurrency(m.target)}</td><td class="r">${formatCurrency(m.achieved)}</td></tr>`,
    )
    .join('')

  const filterDesc =
    Object.entries(filters)
      .filter(([, v]) => v !== 'all')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ') || 'Sem filtros'

  const html = `<!DOCTYPE html><html><head><title>Dashboard Completo - Blink Biotech</title><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}
  h1{color:#1e3a8a}h2{color:#2563eb;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:30px}
  .kpis{display:flex;gap:15px;flex-wrap:wrap;margin:20px 0}
  .kpi{flex:1;min-width:200px;padding:15px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;text-align:center}
  .kpi b{display:block;font-size:22px;color:#2563eb;margin-bottom:4px}.kpi span{font-size:12px;color:#64748b}
  table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
  th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}
  .r{text-align:right}.filters{background:#f8fafc;padding:10px;border-radius:6px;margin:10px 0;font-size:13px}
  </style></head><body>
  <h1>Dashboard Completo - Blink Biotech</h1>
  <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
  <div class="filters"><b>Filtros:</b> ${filterDesc}</div>
  ${
    kpis
      ? `<h2>Indicadores Consolidados</h2><div class="kpis">
  <div class="kpi"><b>${formatCompactCurrency(kpis.totalFunnelValue)}</b><span>Valor Total Funil</span></div>
  <div class="kpi"><b>${kpis.inativoCount} / ${kpis.mensalCount} / ${kpis.ativoCount}</b><span>Inativo / Mensal / Ativo</span></div>
  <div class="kpi"><b>${kpis.achievementPct.toFixed(1)}%</b><span>Atingimento Meta</span></div>
  <div class="kpi"><b>${formatCompactCurrency(kpis.totalSales)}</b><span>Total Vendas</span></div></div>`
      : ''
  }
  ${monthRows ? `<h2>Comparativo Mensal</h2><table><thead><tr><th>Mês</th><th class="r">Vendas</th><th class="r">Meta</th><th class="r">Realizado</th></tr></thead><tbody>${monthRows}</tbody></table>` : ''}
  ${vendorRows ? `<h2>Ranking de Vendedores</h2><table><thead><tr><th>#</th><th>Vendedor</th><th class="r">Vendas</th><th class="r">Meta</th><th class="r">Realizado</th><th class="r">%</th></tr></thead><tbody>${vendorRows}</tbody></table>` : ''}
  ${gestorRows ? `<h2>Comparativo por Gestor Técnico</h2><table><thead><tr><th>#</th><th>Gestor</th><th class="r">Meta</th><th class="r">Realizado</th><th class="r">Vendas</th><th class="r">%</th></tr></thead><tbody>${gestorRows}</tbody></table>` : ''}
  <h2>Funil de Vendas</h2><table><thead><tr><th>Cliente</th><th class="r">Valor Médio</th><th class="r">Valor Atual</th><th>Status Funil</th><th>Próximos Passos</th><th>Ação</th></tr></thead><tbody>${funnelRows}</tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
  </body></html>`

  win.document.write(html)
  win.document.close()
}
