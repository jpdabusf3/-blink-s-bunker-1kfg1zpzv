import type { Atividade } from '@/types'
import { formatCurrency } from './utils'

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

export function exportAtividadesToCSV(
  atividades: Atividade[],
  filters: { dataInicial: string; dataFinal: string },
) {
  const sep = ';'
  const headers = [
    'Data',
    'Vendedor',
    'Cliente',
    'Tipo',
    'Etapa',
    'Valor Estimado',
    'Próximo Passo',
    'Pendências',
    'Origem',
  ]

  const lines = [
    headers.join(sep),
    ...atividades.map((a) =>
      [
        `"${new Date(a.created).toLocaleDateString('pt-BR')}"`,
        `"${(a.expand?.vendedor_id?.name || '—').replace(/"/g, '""')}"`,
        `"${(a.expand?.cliente_id?.name || '—').replace(/"/g, '""')}"`,
        `"${(TIPO_LABELS[a.tipo_atividade] || a.tipo_atividade || '—').replace(/"/g, '""')}"`,
        `"${(a.etapa_funil || '—').replace(/"/g, '""')}"`,
        (a.valor_estimado || 0).toString().replace('.', ','),
        `"${(a.proximo_passo || '—').replace(/"/g, '""')}"`,
        `"${(a.pendencias || '—').replace(/"/g, '""')}"`,
        `"${(ORIGEM_LABELS[a.origem] || a.origem || '—').replace(/"/g, '""')}"`,
      ].join(sep),
    ),
  ]

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `relatorio_atividades_${new Date().toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

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
  const win = window.open('', '_blank')
  if (!win) return

  const periodoStr = `${filters.dataInicial ? new Date(filters.dataInicial).toLocaleDateString('pt-BR') : 'Início'} a ${filters.dataFinal ? new Date(filters.dataFinal).toLocaleDateString('pt-BR') : 'Hoje'}`

  const html = `<!DOCTYPE html><html><head><title>Relatório de Atividades - Blink Biotech</title><meta charset="utf-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}h1{color:#1e3a8a}
  .summary{display:flex;gap:20px;margin:20px 0}.kpi{padding:15px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;text-align:center;flex:1}
  .kpi b{display:block;font-size:24px;color:#2563eb}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}
  .badge{display:inline-block;padding:2px 8px;background:#e2e8f0;border-radius:4px;font-size:11px;margin:2px}
  </style></head><body>
  <h1>Relatório de Atividades - Blink Biotech</h1>
  <p><b>Período:</b> ${periodoStr} | <b>Gerado em:</b> ${new Date().toLocaleString('pt-BR')} | <b>Total:</b> ${atividades.length} atividade(s)</p>
  <div class="summary">
    <div class="kpi"><b>${summary.totalVisitas}</b>Visitas</div>
    <div class="kpi"><b>${summary.totalLigacoes}</b>Ligações</div>
    <div class="kpi"><b>${formatCurrency(summary.valorTotal)}</b>Valor Total Estimado</div>
  </div>
  <div><b>Distribuição por Etapa do Funil:</b> ${summary.etapaDist.map(([e, c]) => `<span class="badge">${e}: ${c}</span>`).join('')}</div>
  <table><thead><tr><th>Data</th><th>Vendedor</th><th>Cliente</th><th>Tipo</th><th>Etapa</th><th>Valor</th><th>Próximo Passo</th><th>Pendências</th><th>Origem</th></tr></thead><tbody>
  ${atividades.map((a) => `<tr><td>${new Date(a.created).toLocaleDateString('pt-BR')}</td><td>${a.expand?.vendedor_id?.name || '—'}</td><td>${a.expand?.cliente_id?.name || '—'}</td><td>${TIPO_LABELS[a.tipo_atividade] || a.tipo_atividade}</td><td>${a.etapa_funil || '—'}</td><td>${a.valor_estimado ? formatCurrency(a.valor_estimado) : '—'}</td><td>${a.proximo_passo || '—'}</td><td>${a.pendencias || '—'}</td><td>${ORIGEM_LABELS[a.origem] || a.origem}</td></tr>`).join('')}
  </tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
  </body></html>`

  win.document.write(html)
  win.document.close()
}
