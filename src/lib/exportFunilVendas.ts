import type { Factory } from '@/types'
import { formatCurrency } from './utils'

export function exportFunilVendasToExcel(items: Factory[]) {
  const sep = ';'
  const headers = [
    'Cliente',
    'Valor Médio',
    'Valor Atual',
    'Status Funil',
    'Próximos Passos',
    'Ação',
  ]
  const lines = [
    headers.join(sep),
    ...items.map((f) =>
      [
        `"${(f.name || '').replace(/"/g, '""')}"`,
        (f.valor_medio || 0).toFixed(2).replace('.', ','),
        (f.valor_atual || 0).toFixed(2).replace('.', ','),
        `"${(f.status_funil || '').replace(/"/g, '""')}"`,
        `"${(f.proximos_passos || '').replace(/"/g, '""')}"`,
        `"${(f.acao || '').replace(/"/g, '""')}"`,
      ].join(sep),
    ),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.setAttribute('href', URL.createObjectURL(blob))
  link.setAttribute('download', `funil_vendas_${new Date().toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportFunilVendasToPDF(items: Factory[]) {
  const win = window.open('', '_blank')
  if (!win) return
  const rows = items
    .map(
      (f) => `<tr>
      <td>${f.name || ''}</td>
      <td class="r">${formatCurrency(f.valor_medio || 0)}</td>
      <td class="r">${formatCurrency(f.valor_atual || 0)}</td>
      <td>${f.status_funil || '-'}</td>
      <td>${f.proximos_passos || '-'}</td>
      <td>${f.acao || '-'}</td>
    </tr>`,
    )
    .join('')
  const html = `<!DOCTYPE html><html><head><title>Funil de Vendas - Blink Biotech</title><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}
  h1{color:#1e3a8a}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
  th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}
  .r{text-align:right}
  </style></head><body>
  <h1>Funil de Vendas - Blink Biotech</h1>
  <p>Gerado em: ${new Date().toLocaleString('pt-BR')} | Total: ${items.length} cliente(s)</p>
  <table><thead><tr><th>Cliente</th><th class="r">Valor Médio</th><th class="r">Valor Atual</th><th>Status Funil</th><th>Próximos Passos</th><th>Ação</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
  </body></html>`
  win.document.write(html)
  win.document.close()
}
