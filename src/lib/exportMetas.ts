import pb from '@/lib/pocketbase/client'
import { formatCurrency } from './utils'
import type { Meta } from '@/services/metas'
import type { GestaoTecnica } from '@/services/gestao-tecnica'
import { CANAL_VENDAS_OPTIONS } from '@/services/metas'

const ESPECIES = ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA']

const BLINK_LOGO_URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/38d970e5-7e8c-4a30-8b1e-ccf8a9667554/image-f220f.png'

export type MetasViewMode = 'especie' | 'gestor' | 'canal'

interface CellData {
  meta: number
  realizado: number
}

interface MatrixResult {
  columns: string[]
  labels: string[]
  matrix: Record<string, Record<string, CellData>>
  rowTotals: Record<string, CellData>
  colTotals: Record<string, CellData>
  grandTotal: CellData
}

/**
 * Builds the Meta x Realizado matrix for a given view — same logic as the
 * MetasMatrix component, so the exported PDF reflects the on-screen data.
 */
export function buildMetasMatrix(
  metas: Meta[],
  vendedores: GestaoTecnica[],
  gestores: GestaoTecnica[],
  viewMode: MetasViewMode,
): MatrixResult {
  const cols =
    viewMode === 'especie'
      ? ESPECIES
      : viewMode === 'canal'
        ? [...CANAL_VENDAS_OPTIONS]
        : gestores.map((g) => g.id)
  const lbls =
    viewMode === 'especie'
      ? ESPECIES
      : viewMode === 'canal'
        ? [...CANAL_VENDAS_OPTIONS]
        : gestores.map((g) => g.nome)
  const m: Record<string, Record<string, CellData>> = {}
  const rt: Record<string, CellData> = {}
  const ct: Record<string, CellData> = {}
  const gt: CellData = { meta: 0, realizado: 0 }

  for (const v of vendedores) {
    m[v.id] = {}
    rt[v.id] = { meta: 0, realizado: 0 }
    for (const c of cols) {
      m[v.id][c] = { meta: 0, realizado: 0 }
      ct[c] = { meta: 0, realizado: 0 }
    }
  }

  for (const meta of metas) {
    if (!meta.vendedor_id) continue
    const colKey =
      viewMode === 'especie'
        ? meta.especie
        : viewMode === 'canal'
          ? meta.canal_vendas
          : meta.gestor_tecnico_id
    if (!colKey || !cols.includes(colKey)) continue
    if (!m[meta.vendedor_id]) {
      m[meta.vendedor_id] = {}
      rt[meta.vendedor_id] = { meta: 0, realizado: 0 }
    }
    if (!m[meta.vendedor_id][colKey]) m[meta.vendedor_id][colKey] = { meta: 0, realizado: 0 }
    m[meta.vendedor_id][colKey].meta += meta.meta_valor || 0
    m[meta.vendedor_id][colKey].realizado += meta.valor_realizado || 0
    rt[meta.vendedor_id].meta += meta.meta_valor || 0
    rt[meta.vendedor_id].realizado += meta.valor_realizado || 0
    if (!ct[colKey]) ct[colKey] = { meta: 0, realizado: 0 }
    ct[colKey].meta += meta.meta_valor || 0
    ct[colKey].realizado += meta.valor_realizado || 0
    gt.meta += meta.meta_valor || 0
    gt.realizado += meta.valor_realizado || 0
  }

  return { columns: cols, labels: lbls, matrix: m, rowTotals: rt, colTotals: ct, grandTotal: gt }
}

function pct(meta: number, realizado: number): string {
  if (meta <= 0) return '—'
  const p = (realizado / meta) * 100
  return p.toFixed(0) + '%'
}

function pctColor(meta: number, realizado: number): string {
  if (meta <= 0) return '#64748b'
  const p = (realizado / meta) * 100
  if (p < 50) return '#dc2626'
  if (p >= 100) return '#16a34a'
  return '#0f172a'
}

function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function viewTitle(viewMode: MetasViewMode): string {
  if (viewMode === 'especie') return 'Por Espécie'
  if (viewMode === 'gestor') return 'Por Gestor Técnico'
  return 'Por Canal de Vendas'
}

function renderMatrixTable(title: string, res: MatrixResult, vendedores: GestaoTecnica[]): string {
  const headerCells = res.labels.map((l) => `<th class="col">${escHtml(l)}</th>`).join('')

  const rows = vendedores
    .map((v) => {
      const cells = res.columns
        .map((c) => {
          const d = res.matrix[v.id]?.[c] || { meta: 0, realizado: 0 }
          return renderCell(d)
        })
        .join('')
      const total = res.rowTotals[v.id] || { meta: 0, realizado: 0 }
      return `<tr><td class="vendedor">${escHtml(v.nome)}</td>${cells}${renderCell(total, true)}</tr>`
    })
    .join('')

  const totalCells = res.columns
    .map((c) => renderCell(res.colTotals[c] || { meta: 0, realizado: 0 }, true))
    .join('')
  const grand = res.grandTotal

  return `
    <h2>${escHtml(title)}</h2>
    <table>
      <thead>
        <tr><th class="vendedor">Vendedor</th>${headerCells}<th class="col total">Total</th></tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td class="vendedor">Total Geral</td>
          ${totalCells}
          ${renderCell(grand, true)}
        </tr>
      </tbody>
    </table>
  `
}

function renderCell(d: CellData, isTotal = false): string {
  if (d.meta === 0 && !isTotal) {
    return '<td class="cell empty">—</td>'
  }
  const color = pctColor(d.meta, d.realizado)
  return `<td class="cell${isTotal ? ' total' : ''}">
    <div class="meta">${formatCurrency(d.meta)}</div>
    <div class="realizado" style="color:${color}">${formatCurrency(d.realizado)}</div>
    <div class="pct" style="color:${color}">${pct(d.meta, d.realizado)}</div>
  </td>`
}

export interface MetasExportOptions {
  solicitante?: string
}

/**
 * Generates a printable PDF (browser print dialog → "Salvar como PDF") of the
 * full Metas x Realizado balance, unifying the three views (Espécie, Gestor,
 * Canal) into a single professional document with the Blink Biotech logo.
 */
export async function exportMetasBalancoPDF(
  metas: Meta[],
  vendedores: GestaoTecnica[],
  gestores: GestaoTecnica[],
  opts: MetasExportOptions = {},
): Promise<void> {
  const especieRes = buildMetasMatrix(metas, vendedores, gestores, 'especie')
  const gestorRes = buildMetasMatrix(metas, vendedores, gestores, 'gestor')
  const canalRes = buildMetasMatrix(metas, vendedores, gestores, 'canal')

  const now = new Date()
  const dataGeracao = now.toLocaleString('pt-BR')

  const logoImg = await fetchLogoAsDataUrl()

  const header = `
    <div class="header">
      ${logoImg ? `<img src="${logoImg}" alt="Blink Biotech" class="logo"/>` : ''}
      <h1>Balanço de Metas × Realizado</h1>
      <p class="subtitle">Blink Biotech · Inteligência Comercial</p>
    </div>
    <div class="meta-info">
      <span><b>Gerado em:</b> ${escHtml(dataGeracao)}</span>
      ${opts.solicitante ? `<span><b>Solicitante:</b> ${escHtml(opts.solicitante)}</span>` : ''}
      <span><b>Vendedores:</b> ${vendedores.length}</span>
      <span><b>Metas cadastradas:</b> ${metas.length}</span>
    </div>
  `

  const resumo = `
    <div class="summary">
      ${summaryCard('Meta Total', especieRes.grandTotal.meta, '#1e3a8a')}
      ${summaryCard('Realizado', especieRes.grandTotal.realizado, '#16a34a')}
      ${summaryCard('% Atingimento Geral', null, '#b91c1c', pct(especieRes.grandTotal.meta, especieRes.grandTotal.realizado))}
    </div>
  `

  const tables = [
    renderMatrixTable('Visão: Por Espécie', especieRes, vendedores),
    renderMatrixTable('Visão: Por Gestor Técnico', gestorRes, vendedores),
    renderMatrixTable('Visão: Por Canal de Vendas', canalRes, vendedores),
  ].join('<div class="page-break"></div>')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Balanço de Metas × Realizado — Blink Biotech</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; font-size: 11px; }
    .header { text-align: center; margin-bottom: 18px; border-bottom: 3px solid #1e3a8a; padding-bottom: 14px; }
    .header .logo { max-height: 60px; margin-bottom: 8px; }
    .header h1 { margin: 0; color: #1e3a8a; font-size: 22px; font-weight: 700; }
    .header .subtitle { margin: 4px 0 0; color: #64748b; font-size: 12px; }
    .meta-info { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; font-size: 10px; color: #475569; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .summary { display: flex; gap: 12px; margin-bottom: 22px; }
    .summary .card { flex: 1; padding: 14px; border-radius: 8px; text-align: center; }
    .summary .card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .summary .card .val { font-size: 18px; font-weight: 700; }
    h2 { color: #1e3a8a; font-size: 14px; margin: 18px 0 8px; border-left: 4px solid #2563eb; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; table-layout: fixed; }
    th, td { border: 1px solid #e2e8f0; padding: 5px 4px; vertical-align: middle; }
    thead th { background: #1e3a8a; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; }
    th.vendedor, td.vendedor { text-align: left; font-weight: 600; width: 130px; min-width: 110px; background: #f8fafc; }
    th.col { text-align: center; min-width: 84px; }
    th.total, td.total { background: #e0e7ff !important; font-weight: 700; }
    td.cell { text-align: center; }
    td.cell.empty { color: #cbd5e1; }
    td.cell .meta { font-size: 8px; color: #94a3b8; }
    td.cell .realizado { font-size: 10px; font-weight: 700; }
    td.cell .pct { font-size: 9px; font-weight: 700; margin-top: 1px; }
    tr.total-row td { background: #e0e7ff; font-weight: 700; border-top: 2px solid #1e3a8a; }
    .page-break { page-break-after: always; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.2cm; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  ${header}
  ${resumo}
  ${tables}
  <div class="footer">Documento gerado automaticamente pelo Blink's Bunker · ${escHtml(dataGeracao)}</div>
  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 400); };
  </script>
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('Pop-up bloqueado. Permita pop-ups para exportar o PDF.')
  }
  w.document.write(html)
  w.document.close()
}

function summaryCard(
  label: string,
  value: number | null,
  color: string,
  customText?: string,
): string {
  const display = customText ?? (value !== null ? formatCurrency(value) : '—')
  return `<div class="card" style="background:${color}11;border:1px solid ${color}33">
    <div class="lbl" style="color:${color}">${escHtml(label)}</div>
    <div class="val" style="color:${color}">${escHtml(display)}</div>
  </div>`
}

/**
 * Fetch the Blink logo and convert it to a data URL so it renders inside the
 * print window (avoids cross-origin issues with <img src=remote> in print).
 */
async function fetchLogoAsDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(BLINK_LOGO_URL)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Registers a metas-balance PDF export in the `atividades` collection so it
 * appears in /relatorio-atividades (and /relatorios via the same collection).
 * Best-effort: never throws to avoid blocking the download.
 */
export async function logMetasBalancoExport(opts: {
  solicitante?: string
  totalMetas: number
  totalVendedores: number
  metaTotal: number
  realizadoTotal: number
}): Promise<void> {
  const userId = pb.authStore.record?.id
  const detalhes = {
    data: new Date().toISOString(),
    usuario_solicitante: opts.solicitante || '',
    usuario_solicitante_id: userId || '',
    tipo_exportacao: 'pdf',
    objeto: 'balanco_metas',
    total_metas: opts.totalMetas,
    total_vendedores: opts.totalVendedores,
    meta_total: opts.metaTotal,
    realizado_total: opts.realizadoTotal,
    pct_atingimento:
      opts.metaTotal > 0 ? Number(((opts.realizadoTotal / opts.metaTotal) * 100).toFixed(1)) : 0,
  }
  try {
    await pb.collection('atividades').create({
      cliente_id: null,
      vendedor_id: userId || null,
      tipo_atividade: 'exportacao_relatorio',
      etapa_funil: 'pos_venda',
      valor_estimado: 0,
      descricao: 'Exportação de Balanço de Metas × Realizado (PDF)',
      proximo_passo: '',
      origem: 'manual',
      detalhes_exportacao: detalhes,
    })
  } catch {
    /* best-effort */
  }
}
