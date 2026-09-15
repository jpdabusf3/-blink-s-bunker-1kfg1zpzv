import { formatCurrency } from '@/lib/utils'
import { familiaCompleta } from '@/constants/familiaProdutos'
import type { ResumoClienteItem, ResumoFamiliaItem } from '@/services/resumo-vendas'

export interface MonthCoverageExportItem {
  ano: number
  mes: number
  label: string
  faturadoBrl: number
  carteiraBrl: number | null
  coberturaPercent: number | null
}

export interface ResumoPdfExportData {
  periodo: string
  faturadoBrl: number
  qtdNotas: number
  ticketMedio: number | null
  clientesAtivos: number | null
  top10Clientes: ResumoClienteItem[]
  topFamilias: ResumoFamiliaItem[]
  coverageData: MonthCoverageExportItem[]
}

export interface ResumoPdfExportOptions {
  includeCards: boolean
  includeTopClientes: boolean
  includeTopFamilias: boolean
  includeCobertura: boolean
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatPercentBR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${val.toFixed(1).replace('.', ',')}%`
}

export function exportResumoVendasToPDF(
  data: ResumoPdfExportData,
  options: ResumoPdfExportOptions,
): boolean {
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Não foi possível abrir a janela de impressão. Permita pop-ups no navegador.')
  }

  // Data e hora de geração no formato DD/MM/AAAA HH:mm
  const now = new Date()
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  const dataGeracao = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  const sectionsHtml: string[] = []

  // 1. Cards de Resumo
  if (options.includeCards) {
    sectionsHtml.push(`
      <div class="section">
        <h2 class="section-title">Indicadores Principais</h2>
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Faturamento Total</span>
            <span class="kpi-value primary">${formatCurrency(data.faturadoBrl)}</span>
            <span class="kpi-sub">Receita total no período</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Pedidos Faturados</span>
            <span class="kpi-value">${data.qtdNotas}</span>
            <span class="kpi-sub">Notas fiscais emitidas</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Ticket Médio</span>
            <span class="kpi-value">${data.ticketMedio !== null ? formatCurrency(data.ticketMedio) : '—'}</span>
            <span class="kpi-sub">Média por nota emitida</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Clientes Ativos</span>
            <span class="kpi-value">${data.clientesAtivos !== null ? data.clientesAtivos : '—'}</span>
            <span class="kpi-sub">Com compras no período</span>
          </div>
        </div>
      </div>
    `)
  }

  // 2. Top 10 Clientes
  if (options.includeTopClientes) {
    const rows =
      data.top10Clientes.length === 0
        ? '<tr><td colspan="3" class="text-center empty">Nenhum cliente com faturamento registrado.</td></tr>'
        : data.top10Clientes
            .map(
              (c, idx) => `
          <tr>
            <td class="text-center font-mono w-col-num">${idx + 1}</td>
            <td><strong>${escapeHtml(c.cliente || 'Outros')}</strong></td>
            <td class="text-right font-mono font-bold">${formatCurrency(c.valor_brl)}</td>
          </tr>
        `,
            )
            .join('')

    sectionsHtml.push(`
      <div class="section">
        <h2 class="section-title">Top 10 Clientes</h2>
        <table>
          <thead>
            <tr>
              <th class="text-center w-col-num">#</th>
              <th>Cliente</th>
              <th class="text-right">Faturamento Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `)
  }

  // 3. Top Famílias de Produtos
  if (options.includeTopFamilias) {
    const rows =
      data.topFamilias.length === 0
        ? '<tr><td colspan="3" class="text-center empty">Nenhuma família com faturamento registrado.</td></tr>'
        : data.topFamilias
            .map(
              (f, idx) => `
          <tr>
            <td class="text-center font-mono w-col-num">${idx + 1}</td>
            <td><strong>${escapeHtml(familiaCompleta('', f.familia))}</strong></td>
            <td class="text-right font-mono font-bold">${formatCurrency(f.valor_brl)}</td>
          </tr>
        `,
            )
            .join('')

    sectionsHtml.push(`
      <div class="section">
        <h2 class="section-title">Top Famílias de Produtos</h2>
        <table>
          <thead>
            <tr>
              <th class="text-center w-col-num">#</th>
              <th>Família</th>
              <th class="text-right">Faturamento Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `)
  }

  // 4. Cobertura de Carteira
  if (options.includeCobertura) {
    const rows =
      data.coverageData.length === 0
        ? '<tr><td colspan="4" class="text-center empty">Sem dados de cobertura disponíveis.</td></tr>'
        : data.coverageData
            .map((cov) => {
              const pct = cov.coberturaPercent
              let badgeClass = 'badge-neutral'
              if (pct !== null && pct !== undefined && !isNaN(pct)) {
                if (pct < 50) badgeClass = 'badge-danger'
                else if (pct <= 80) badgeClass = 'badge-warning'
                else badgeClass = 'badge-success'
              }

              return `
          <tr>
            <td><strong>${escapeHtml(cov.label)}</strong></td>
            <td class="text-right font-mono">${cov.carteiraBrl !== null ? formatCurrency(cov.carteiraBrl) : '—'}</td>
            <td class="text-right font-mono font-bold">${formatCurrency(cov.faturadoBrl)}</td>
            <td class="text-right">
              <span class="badge ${badgeClass}">${formatPercentBR(cov.coberturaPercent)}</span>
            </td>
          </tr>
        `
            })
            .join('')

    sectionsHtml.push(`
      <div class="section">
        <h2 class="section-title">Cobertura de Carteira (Backlog vs Realizado)</h2>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th class="text-right">Valor em Carteira (Backlog)</th>
              <th class="text-right">Valor Realizado (Faturado)</th>
              <th class="text-right">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `)
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Resumo de Vendas — Blink Biotech</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 32px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 13px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-brand {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      line-height: 1.2;
    }
    .header-meta {
      text-align: right;
      font-size: 12px;
      color: #475569;
    }
    .periodo-pill {
      display: inline-block;
      padding: 4px 10px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      font-weight: 700;
      color: #0f172a;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 12px 0;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .kpi-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 6px;
    }
    .kpi-value {
      display: block;
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .kpi-value.primary {
      color: #0284c7;
    }
    .kpi-sub {
      display: block;
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #334155;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 700; }
    .w-col-num { width: 44px; }
    .empty { color: #64748b; padding: 18px !important; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .badge-success {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .badge-warning {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .badge-danger {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }
    .badge-neutral {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .footer {
      margin-top: 36px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 11px;
    }
    @media print {
      body { padding: 0; }
      @page { size: portrait; margin: 12mm; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-brand">Blink Biotech</div>
      <h1>Resumo de Vendas</h1>
    </div>
    <div class="header-meta">
      <div><span class="periodo-pill">Período: ${escapeHtml(data.periodo || '—')}</span></div>
      <div>Gerado em: <strong>${escapeHtml(dataGeracao)}</strong></div>
    </div>
  </div>

  ${sectionsHtml.join('')}

  <div class="footer">
    <span>Blink Biotech — Relatório de Vendas</span>
    <span>Documento gerado automaticamente</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
  return true
}
