import { formatCurrency } from '@/lib/utils'

export interface FunilExportRow {
  name: string
  valor_medio: number
  valor_atual: number
  status_funil: string
  proximos_passos: string
  acao: string
  vendedor_name?: string
}

export function exportFunilToExcel(rows: FunilExportRow[]) {
  const sep = ';'
  const headers = [
    'Cliente',
    'Valor Medio',
    'Valor Atual',
    'Status Funil',
    'Proximos Passos',
    'Acao',
    'Vendedor',
  ]
  const lines = [
    headers.join(sep),
    ...rows.map((r) =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        r.valor_medio.toFixed(2).replace('.', ','),
        r.valor_atual.toFixed(2).replace('.', ','),
        `"${r.status_funil}"`,
        `"${(r.proximos_passos || '-').replace(/"/g, '""')}"`,
        `"${(r.acao || '-').replace(/"/g, '""')}"`,
        `"${(r.vendedor_name || '-').replace(/"/g, '""')}"`,
      ].join(sep),
    ),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.setAttribute('href', URL.createObjectURL(blob))
  link.setAttribute('download', `funil_vendas_blink_${new Date().toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportFunilToPDF(rows: FunilExportRow[]) {
  const win = window.open('', '_blank')
  if (!win) return
  const totalMedio = rows.reduce((s, r) => s + r.valor_medio, 0)
  const totalAtual = rows.reduce((s, r) => s + r.valor_atual, 0)
  const html = `<!DOCTYPE html><html><head><title>Funil de Vendas - Blink Biotech</title><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}h1{color:#1e3a8a}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}
  .r{text-align:right}.total{font-weight:bold;background:#f8fafc}
  </style></head><body>
  <h1>Funil de Vendas - Blink Biotech</h1>
  <p>Gerado em: ${new Date().toLocaleString('pt-BR')} | Total: ${rows.length} cliente(s)</p>
  <table><thead><tr><th>Cliente</th><th class="r">Valor Medio</th><th class="r">Valor Atual</th><th>Status</th><th>Proximos Passos</th><th>Acao</th><th>Vendedor</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td>${r.name}</td><td class="r">${formatCurrency(r.valor_medio)}</td><td class="r">${formatCurrency(r.valor_atual)}</td><td>${r.status_funil}</td><td>${r.proximos_passos || '-'}</td><td>${r.acao || '-'}</td><td>${r.vendedor_name || '-'}</td></tr>`).join('')}
  <tr class="total"><td>TOTAL</td><td class="r">${formatCurrency(totalMedio)}</td><td class="r">${formatCurrency(totalAtual)}</td><td colspan="4"></td></tr>
  </tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
  </body></html>`
  win.document.write(html)
  win.document.close()
}
