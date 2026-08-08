import type { PerformanceReportData } from '@/services/performance-report'
import { formatCurrency } from './utils'

export function exportPerformanceToExcel(data: PerformanceReportData) {
  const sep = ';'
  const lines: string[] = []
  lines.push('RELATÓRIO DE PERFORMANCE - BLINK BIOTECH')
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
  lines.push('')
  lines.push(['Resumo Executivo', ''].join(sep))
  lines.push(['Total de Vendas', data.summary.totalVendas.toString()].join(sep))
  lines.push(['Valor Total', data.summary.valorTotal.toFixed(2).replace('.', ',')].join(sep))
  lines.push(['Ticket Médio', data.summary.ticketMedio.toFixed(2).replace('.', ',')].join(sep))
  lines.push(['Clientes Atendidos', data.summary.numClientes.toString()].join(sep))
  lines.push(
    ['Taxa de Conversão (%)', data.summary.taxaConversao.toFixed(1).replace('.', ',')].join(sep),
  )
  lines.push('')
  lines.push(['Relatório por Gestor Técnico', ''].join(sep))
  lines.push(
    ['Gestor', 'Total Vendas', 'Valor Total', 'Meta', 'Realizado', 'Atingimento (%)'].join(sep),
  )
  data.gestores.forEach((g) => {
    lines.push(
      [
        `"${g.nome}"`,
        g.totalVendas.toString(),
        g.valorTotal.toFixed(2).replace('.', ','),
        g.metaValor.toFixed(2).replace('.', ','),
        g.valorRealizado.toFixed(2).replace('.', ','),
        g.metaAchievement.toFixed(1).replace('.', ','),
      ].join(sep),
    )
  })
  lines.push('')
  lines.push(['Relatório por Vendedor', ''].join(sep))
  lines.push(
    ['Vendedor', 'Total Vendas', 'Valor Total', 'Meta', 'Realizado', 'Atingimento (%)'].join(sep),
  )
  data.vendedores.forEach((v) => {
    lines.push(
      [
        `"${v.nome}"`,
        v.totalVendas.toString(),
        v.valorTotal.toFixed(2).replace('.', ','),
        v.metaValor.toFixed(2).replace('.', ','),
        v.valorRealizado.toFixed(2).replace('.', ','),
        v.metaAchievement.toFixed(1).replace('.', ','),
      ].join(sep),
    )
  })
  lines.push('')
  lines.push(['Ranking de Gestores', ''].join(sep))
  lines.push(['Posição', 'Gestor', 'Valor Realizado'].join(sep))
  data.gestorRanking.forEach((g, i) =>
    lines.push([(i + 1).toString(), `"${g.nome}"`, g.valor.toFixed(2).replace('.', ',')].join(sep)),
  )
  lines.push('')
  lines.push(['Ranking de Vendedores', ''].join(sep))
  lines.push(['Posição', 'Vendedor', 'Valor Realizado'].join(sep))
  data.vendedorRanking.forEach((v, i) =>
    lines.push([(i + 1).toString(), `"${v.nome}"`, v.valor.toFixed(2).replace('.', ',')].join(sep)),
  )
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `relatorio_performance_${new Date().toISOString().slice(0, 10)}.csv`)
}

function triggerDownload(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.setAttribute('href', URL.createObjectURL(blob))
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportPerformanceToPDF(data: PerformanceReportData) {
  const win = window.open('', '_blank')
  if (!win) return
  const gestorRows = data.gestores
    .map(
      (g) =>
        `<tr><td>${g.nome}</td><td class="r">${g.totalVendas}</td><td class="r">${formatCurrency(g.valorTotal)}</td><td class="r">${formatCurrency(g.metaValor)}</td><td class="r">${g.metaValor > 0 ? g.metaAchievement.toFixed(1) + '%' : '—'}</td></tr>`,
    )
    .join('')
  const vendRows = data.vendedores
    .map(
      (v) =>
        `<tr><td>${v.nome}</td><td class="r">${v.totalVendas}</td><td class="r">${formatCurrency(v.valorTotal)}</td><td class="r">${formatCurrency(v.metaValor)}</td><td class="r">${v.metaValor > 0 ? v.metaAchievement.toFixed(1) + '%' : '—'}</td></tr>`,
    )
    .join('')
  const gRank = data.gestorRanking
    .map(
      (g, i) =>
        `<tr><td>${i + 1}º</td><td>${g.nome}</td><td class="r">${formatCurrency(g.valor)}</td></tr>`,
    )
    .join('')
  const vRank = data.vendedorRanking
    .map(
      (v, i) =>
        `<tr><td>${i + 1}º</td><td>${v.nome}</td><td class="r">${formatCurrency(v.valor)}</td></tr>`,
    )
    .join('')
  const html = `<!DOCTYPE html><html><head><title>Relatório de Performance - Blink Biotech</title><meta charset="utf-8"><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}h1{color:#1e3a8a}h2{color:#2563eb;margin-top:30px;border-bottom:2px solid #e2e8f0;padding-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}.r{text-align:right}.kpi{display:inline-block;margin:8px;padding:12px 20px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;text-align:center}.kpi b{display:block;font-size:22px;color:#2563eb}</style></head><body><h1>Relatório de Performance - Blink Biotech</h1><p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p><div><div class="kpi"><b>${data.summary.totalVendas}</b>Total de Vendas</div><div class="kpi"><b>${formatCurrency(data.summary.valorTotal)}</b>Valor Total</div><div class="kpi"><b>${formatCurrency(data.summary.ticketMedio)}</b>Ticket Médio</div><div class="kpi"><b>${data.summary.numClientes}</b>Clientes</div><div class="kpi"><b>${data.summary.taxaConversao.toFixed(1)}%</b>Taxa Conversão</div></div><h2>Relatório por Gestor Técnico</h2><table><thead><tr><th>Gestor</th><th class="r">Vendas</th><th class="r">Valor Total</th><th class="r">Meta</th><th class="r">Atingimento</th></tr></thead><tbody>${gestorRows}</tbody></table><h2>Relatório por Vendedor</h2><table><thead><tr><th>Vendedor</th><th class="r">Vendas</th><th class="r">Valor Total</th><th class="r">Meta</th><th class="r">Atingimento</th></tr></thead><tbody>${vendRows}</tbody></table><h2>Ranking de Gestores</h2><table><thead><tr><th>Pos</th><th>Gestor</th><th class="r">Valor</th></tr></thead><tbody>${gRank}</tbody></table><h2>Ranking de Vendedores</h2><table><thead><tr><th>Pos</th><th>Vendedor</th><th class="r">Valor</th></tr></thead><tbody>${vRank}</tbody></table><script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script></body></html>`
  win.document.write(html)
  win.document.close()
}
