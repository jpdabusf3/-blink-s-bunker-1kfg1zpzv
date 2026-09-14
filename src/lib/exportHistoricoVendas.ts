import type { HistoricoVenda } from '@/services/historico-vendas'
import { formatCurrency } from '@/lib/utils'
import { familiaCompleta } from '@/constants/familiaProdutos'

/**
 * Exporta os registros filtrados do Histórico de Vendas para planilha Excel (.csv)
 */
export function exportHistoricoVendasToExcel(items: HistoricoVenda[]) {
  const sep = ';'
  const headers = [
    'Data',
    'Documento (NF)',
    'Cliente / Destinatário',
    'UF',
    'País',
    'Código Produto',
    'Descrição Produto',
    'Família / Linha',
    'Quantidade',
    'Valor Unitário (R$)',
    'Valor Total (R$)',
    'Espécie',
    'Gestor Técnico',
    'Vendedor',
    'Canal de Vendas',
    'Status',
    'Origem',
  ]

  const rows = items.map((r) => {
    const dataDoc = r.data_documento || r.data
    const dataFormatada = dataDoc ? new Date(dataDoc).toLocaleDateString('pt-BR') : ''
    const doc = r.numero_documento || ''
    const cliente = (r.destinatario_nome || r.cliente || '').replace(/;/g, ' ')
    const uf = r.destinatario_uf || ''
    const pais = r.pais || 'Brasil'
    const codProd = r.produto_codigo || ''
    const descProd = (r.produto_descricao || '').replace(/;/g, ' ')
    const familia = familiaCompleta(codProd, r.produto_familia || '')
    const qtd = r.produto_quantidade != null ? String(r.produto_quantidade).replace('.', ',') : ''
    const unit =
      r.produto_valor_unitario != null
        ? Number(r.produto_valor_unitario).toFixed(2).replace('.', ',')
        : ''
    const total = (r.produto_valor_total || r.valor || 0).toFixed(2).replace('.', ',')
    const especie = r.especie_destino || r.especie || ''
    const gestor = (r.gestor_tecnico || r.expand?.gestor_tecnico_id?.nome || '').replace(/;/g, ' ')
    const vendedor = (r.vendedor || r.expand?.vendedor_id?.nome || '').replace(/;/g, ' ')
    const canal = r.canal_vendas || ''
    const status = r.status || (r.origem === 'pedido' ? 'projetado' : 'realizado')
    const origem = r.origem || 'nf'

    return [
      dataFormatada,
      `"${doc}"`,
      `"${cliente}"`,
      uf,
      pais,
      `"${codProd}"`,
      `"${descProd}"`,
      `"${familia}"`,
      qtd,
      unit,
      total,
      especie,
      `"${gestor}"`,
      `"${vendedor}"`,
      `"${canal}"`,
      status,
      origem,
    ].join(sep)
  })

  const csvContent = '\uFEFF' + [headers.join(sep), ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `historico_vendas_${new Date().toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Exporta os registros filtrados do Histórico de Vendas para PDF de impressão
 */
export function exportHistoricoVendasToPDF(items: HistoricoVenda[]) {
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Pop-up bloqueado. Permita pop-ups para gerar o PDF.')
  }

  const totalValor = items.reduce((s, d) => s + (d.produto_valor_total || d.valor || 0), 0)

  const rowsHtml = items
    .map((r) => {
      const dataDoc = r.data_documento || r.data
      const dataFormatada = dataDoc ? new Date(dataDoc).toLocaleDateString('pt-BR') : '-'
      const doc = r.numero_documento || '-'
      const cliente = r.destinatario_nome || r.cliente || '-'
      const produto = r.produto_descricao || r.produto_codigo || '-'
      const especie = r.especie_destino || r.especie || '-'
      const gestor = r.gestor_tecnico || r.expand?.gestor_tecnico_id?.nome || '-'
      const vendedor = r.vendedor || r.expand?.vendedor_id?.nome || '-'
      const canal = r.canal_vendas || '-'
      const total = formatCurrency(r.produto_valor_total || r.valor || 0)
      const status = r.status || (r.origem === 'pedido' ? 'projetado' : 'realizado')

      return `<tr>
        <td>${dataFormatada}</td>
        <td>${doc}</td>
        <td>${cliente}</td>
        <td>${produto}</td>
        <td>${especie}</td>
        <td>${gestor}</td>
        <td>${vendedor}</td>
        <td>${canal}</td>
        <td class="r">${total}</td>
        <td class="c"><span class="badge ${status}">${status}</span></td>
      </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Histórico de Vendas - Blink Biotech</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1e293b; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { font-size: 20px; color: #0f172a; margin: 0 0 4px 0; }
    .meta { font-size: 12px; color: #64748b; }
    .summary-box { display: inline-flex; gap: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; margin-bottom: 20px; }
    .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .kpi-value { font-size: 18px; font-weight: 700; color: #0f172a; }
    .kpi-value.primary { color: #2563eb; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    .r { text-align: right; }
    .c { text-align: center; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
    .badge.realizado { background: #dcfce7; color: #166534; }
    .badge.projetado { background: #dbeafe; color: #1e40af; }
    @media print {
      body { padding: 0; }
      @page { size: landscape; margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Histórico de Vendas — Blink Biotech</h1>
      <div class="meta">Relatório gerado em: ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>

  <div class="summary-box">
    <div>
      <div class="kpi-title">Total de Registros</div>
      <div class="kpi-value">${items.length}</div>
    </div>
    <div>
      <div class="kpi-title">Volume Total</div>
      <div class="kpi-value primary">${formatCurrency(totalValor)}</div>
    </div>
    <div>
      <div class="kpi-title">Ticket Médio</div>
      <div class="kpi-value">${formatCurrency(items.length > 0 ? totalValor / items.length : 0)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Doc / NF</th>
        <th>Cliente</th>
        <th>Produto</th>
        <th>Espécie</th>
        <th>Gestor Técnico</th>
        <th>Vendedor</th>
        <th>Canal</th>
        <th class="r">Valor</th>
        <th class="c">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="10" class="c">Nenhum registro encontrado.</td></tr>'}
    </tbody>
  </table>

  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print()
      }, 400)
    }
  </script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}
