import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'

/**
 * Módulo Central de Modelos Corporativos de Documentos da Blink Biotech.
 *
 * Atende às diretrizes da diretoria:
 * 1. Excel (.xlsx):
 *    - Título e subtítulo institucionais "Blink Biotech — <Nome do Relatório>"
 *    - Metadados formais: Período, Data/Hora de Geração (DD/MM/AAAA HH:mm), Usuário solicitante, Origem e Filtros
 *    - Cabeçalhos formais em português correto, com iniciais maiúsculas (Title Case), nunca minúsculos
 *    - Totais somados e contagem de registros no rodapé
 *    - Padrão de nome de arquivo: <documento>-<periodo>-<AAAA-MM-DD>.xlsx
 *
 * 2. PDF Corporativo (impressão executiva pronta para arquivamento pela diretoria):
 *    - Cabeçalho / Capa institucional com branding Blink Biotech (logo, tons institucionais #0f172a, #1e3a8a, #d97706)
 *    - Bloco de metadados: Título do relatório, subtítulo, período coberto, autor/gerado por, data/hora, origem do documento e filtros aplicados
 *    - Sumário / Índice das seções do documento (TOC)
 *    - Seções numeradas (1. Indicadores Gerais, 2. ..., etc.) com descrição do que a seção apresenta
 *    - Cards de KPIs executivos destacados
 *    - Tabelas corporativas zebradas, com cabeçalhos escuros, alinhamento à direita para moedas e números, formato monetário brasileiro (R$ 1.234,56 / DD/MM/AAAA)
 *    - Rodapé em todas as páginas com "Página X de Y", assinatura corporativa e confidencialidade institucional
 */

export const BLINK_BRAND = {
  name: 'Blink Biotech',
  systemName: "Blink's Bunker · Inteligência Comercial & Gestão B2B",
  primaryColor: '#1e3a8a',
  accentColor: '#d97706',
  darkColor: '#0f172a',
  lightGray: '#f8fafc',
  borderColor: '#e2e8f0',
  logoUrl:
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/assets/Logo_Blink.png',
}

/** Formata data para DD/MM/AAAA */
export function formatDataBR(val?: string | number | Date | null): string {
  if (!val) return '—'
  const d = val instanceof Date ? val : new Date(val)
  if (isNaN(d.getTime())) return String(val)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Formata data e hora para DD/MM/AAAA HH:mm */
export function formatDataHoraBR(val?: string | number | Date | null): string {
  if (!val) return '—'
  const d = val instanceof Date ? val : new Date(val)
  if (isNaN(d.getTime())) return String(val)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/** Formata moeda brasileira R$ 1.234,56 */
export function formatMoedaBRL(val?: number | null): string {
  if (val === null || val === undefined || isNaN(Number(val))) return 'R$ 0,00'
  return Number(val).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Formata moeda americana US$ 1.234,56 */
export function formatMoedaUSD(val?: number | null): string {
  if (val === null || val === undefined || isNaN(Number(val))) return 'US$ 0,00'
  return (
    'US$ ' +
    Number(val).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

/** Obtém o nome do usuário logado atualmente no PocketBase */
export function getLoggedUserName(): string {
  try {
    const record = pb.authStore.record as { name?: string; email?: string } | null
    if (record?.name && record.name.trim()) return record.name.trim()
    if (record?.email && record.email.trim()) return record.email.trim()
  } catch {
    /* noop */
  }
  return 'João Pedro (Diretoria)'
}

/** Gera nome padronizado de arquivo: <documento>-<periodo>-<AAAA-MM-DD>.<ext> */
export function buildDocumentFileName(
  slug: string,
  periodo?: string | null,
  ext: 'xlsx' | 'pdf' | 'csv' = 'xlsx',
): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStamp = `${yyyy}-${mm}-${dd}`

  let cleanPeriod = (periodo || 'geral')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!cleanPeriod) cleanPeriod = 'geral'

  const cleanSlug = slug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `${cleanSlug}-${cleanPeriod}-${dateStamp}.${ext}`
}

/* =========================================================================
 * A) EXPORTADOR DE PLANILHAS EXCEL CORPORATIVAS (.xlsx)
 * ========================================================================= */

export interface ExcelColumnDef {
  key: string
  label: string // Cabeçalho formal (ex: "Valor Total (R$)")
  width?: number
  isNumeric?: boolean
  isCurrency?: boolean
}

export interface ExcelExportMetadata {
  titulo: string
  subtitulo?: string
  origem: string
  periodo?: string
  filtros?: string | Record<string, unknown>
  geradoPor?: string
  totalizacoes?: {
    label: string
    valor: string | number
  }[]
}

/**
 * Gera e dispara o download de um arquivo .xlsx corporativo.
 */
export function exportCorporateExcel(params: {
  slug: string
  metadata: ExcelExportMetadata
  columns: ExcelColumnDef[]
  rows: Record<string, unknown>[]
}): void {
  const { slug, metadata, columns, rows } = params
  const now = new Date()
  const dataHoraGeracao = formatDataHoraBR(now)
  const autor = metadata.geradoPor || getLoggedUserName()

  // Montagem das linhas em formato matriz bidimensional
  const sheetData: (string | number)[][] = []

  // 1. Bloco de Cabeçalho Institucional
  sheetData.push([`Blink Biotech — ${metadata.titulo}`])
  if (metadata.subtitulo) {
    sheetData.push([metadata.subtitulo])
  }
  sheetData.push([`Plataforma: ${BLINK_BRAND.systemName}`])
  sheetData.push([`Origem: ${metadata.origem}`])
  sheetData.push([`Período de Referência: ${metadata.periodo || 'Consolidado Geral'}`])
  sheetData.push([`Data/Hora de Geração: ${dataHoraGeracao}`])
  sheetData.push([`Gerado por: ${autor}`])

  if (metadata.filtros) {
    const filtrosDesc =
      typeof metadata.filtros === 'string'
        ? metadata.filtros
        : Object.entries(metadata.filtros)
            .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ') || 'Nenhum filtro restritivo aplicado'
    sheetData.push([`Filtros Aplicados: ${filtrosDesc}`])
  }

  // Linha em branco separadora
  sheetData.push([])

  // 2. Linha de Cabeçalhos das Colunas (em Title Case formal, maiúsculas adequadas)
  const headerLabels = columns.map((c) => c.label)
  sheetData.push(headerLabels)

  // 3. Linhas de Dados
  rows.forEach((r) => {
    const rowVals = columns.map((c) => {
      const v = r[c.key]
      if (v === null || v === undefined) return ''
      if (typeof v === 'number') return v
      return String(v)
    })
    sheetData.push(rowVals)
  })

  // 4. Linha em branco antes do rodapé de totais
  sheetData.push([])

  // 5. Linhas de Totais e Rodapé
  sheetData.push(['TOTAL DE REGISTROS:', rows.length])

  if (metadata.totalizacoes && metadata.totalizacoes.length > 0) {
    metadata.totalizacoes.forEach((t) => {
      sheetData.push([t.label, t.valor])
    })
  }

  sheetData.push([
    `Documento emitido para arquivamento e análise da Diretoria Executiva em ${dataHoraGeracao}`,
  ])

  // Criar planilha e workbook
  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  // Definir larguras de colunas adequadas
  const colWidths = columns.map((c) => ({
    wch: Math.max(c.width || 18, c.label.length + 4),
  }))
  // Assegurar largura mínima para a coluna A (que tem títulos)
  if (colWidths[0] && colWidths[0].wch < 32) {
    colWidths[0].wch = 32
  }
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, metadata.titulo.slice(0, 31))

  const fileName = buildDocumentFileName(slug, metadata.periodo, 'xlsx')
  XLSX.writeFile(wb, fileName)
}

/* =========================================================================
 * B) GERADOR DE RELATÓRIOS PDF CORPORATIVOS (Impressão / Arquivamento Diretoria)
 * ========================================================================= */

export interface PdfKpiItem {
  label: string
  valor: string
  sub?: string
  accent?: 'primary' | 'amber' | 'emerald' | 'sky'
}

export interface PdfTableColumn {
  header: string
  align?: 'left' | 'center' | 'right'
  width?: string
  isBold?: boolean
}

export interface PdfSection {
  id?: string
  numero?: number
  titulo: string
  descricao: string
  kpis?: PdfKpiItem[]
  table?: {
    columns: PdfTableColumn[]
    rows: (string | number)[][]
    footerRow?: (string | number)[]
    emptyMessage?: string
  }
  customHtml?: string
}

export interface CorporatePdfReportParams {
  titulo: string
  subtitulo?: string
  origem: string
  periodo?: string
  filtros?: string | Record<string, unknown>
  geradoPor?: string
  observacoes?: string
  sections: PdfSection[]
  orientacao?: 'portrait' | 'landscape'
}

/**
 * Escapa strings para HTML seguro.
 */
function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Abre a janela de visualização e impressão do PDF no modelo corporativo executivo.
 */
export function openCorporatePdfReport(params: CorporatePdfReportParams): boolean {
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Não foi possível abrir o relatório PDF. Permita pop-ups no navegador.')
  }

  const {
    titulo,
    subtitulo = 'Relatório Corporativo de Inteligência Comercial e Vendas B2B',
    origem,
    periodo = 'Consolidado Geral',
    filtros,
    geradoPor = getLoggedUserName(),
    observacoes,
    sections,
    orientacao = 'portrait',
  } = params

  const dataHoraGeracao = formatDataHoraBR(new Date())

  const filtrosDesc =
    typeof filtros === 'string'
      ? filtros
      : filtros
        ? Object.entries(filtros)
            .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
            .map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`)
            .join(' &nbsp;|&nbsp; ')
        : 'Visão Global / Sem filtros restritivos'

  // Sumário (Table of Contents) caso existam 2 ou mais seções
  const tocHtml =
    sections.length > 1
      ? `
      <div class="toc-container">
        <div class="toc-title">SUMÁRIO EXECUTIVO DO DOCUMENTO</div>
        <div class="toc-grid">
          ${sections
            .map(
              (sec, idx) => `
            <div class="toc-item">
              <span class="toc-num">${sec.numero ?? idx + 1}.</span>
              <span class="toc-name">${escapeHtml(sec.titulo)}</span>
              <span class="toc-dots"></span>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `
      : ''

  // Montagem das Seções Numeradas
  const sectionsHtml = sections
    .map((sec, idx) => {
      const num = sec.numero ?? idx + 1

      // KPIs da seção
      let kpiBlockHtml = ''
      if (sec.kpis && sec.kpis.length > 0) {
        kpiBlockHtml = `
          <div class="kpi-grid">
            ${sec.kpis
              .map(
                (k) => `
              <div class="kpi-card ${k.accent || 'primary'}">
                <div class="kpi-label">${escapeHtml(k.label)}</div>
                <div class="kpi-value">${escapeHtml(k.valor)}</div>
                ${k.sub ? `<div class="kpi-sub">${escapeHtml(k.sub)}</div>` : ''}
              </div>
            `,
              )
              .join('')}
          </div>
        `
      }

      // Tabela da seção
      let tableHtml = ''
      if (sec.table) {
        const { columns, rows, footerRow, emptyMessage = 'Nenhum registro encontrado.' } = sec.table

        const thead = `
          <thead>
            <tr>
              ${columns
                .map((c) => {
                  const alignClass = c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : 'l'
                  const style = c.width ? `style="width:${c.width};"` : ''
                  return `<th class="${alignClass}" ${style}>${escapeHtml(c.header)}</th>`
                })
                .join('')}
            </tr>
          </thead>
        `

        let tbody = ''
        if (rows.length === 0) {
          tbody = `<tbody><tr><td colspan="${columns.length}" class="c empty">${escapeHtml(emptyMessage)}</td></tr></tbody>`
        } else {
          tbody = `
            <tbody>
              ${rows
                .map((row) => {
                  const cells = columns
                    .map((c, colIdx) => {
                      const val = row[colIdx] ?? '—'
                      const alignClass =
                        c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : 'l'
                      const boldClass = c.isBold ? 'font-bold' : ''
                      return `<td class="${alignClass} ${boldClass}">${escapeHtml(val)}</td>`
                    })
                    .join('')
                  return `<tr>${cells}</tr>`
                })
                .join('')}
            </tbody>
          `
        }

        let tfoot = ''
        if (footerRow && footerRow.length > 0) {
          tfoot = `
            <tfoot>
              <tr class="total-row">
                ${columns
                  .map((c, colIdx) => {
                    const val = footerRow[colIdx] ?? ''
                    const alignClass = c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : 'l'
                    return `<td class="${alignClass}">${escapeHtml(val)}</td>`
                  })
                  .join('')}
              </tr>
            </tfoot>
          `
        }

        tableHtml = `
          <div class="table-container">
            <table>
              ${thead}
              ${tbody}
              ${tfoot}
            </table>
          </div>
        `
      }

      return `
        <div class="section-block">
          <div class="section-heading">
            <div class="section-num-tag">${num}</div>
            <div>
              <h2 class="section-title">${num}. ${escapeHtml(sec.titulo)}</h2>
              <p class="section-desc">${escapeHtml(sec.descricao)}</p>
            </div>
          </div>
          ${kpiBlockHtml}
          ${sec.customHtml || ''}
          ${tableHtml}
        </div>
      `
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)} — Blink Biotech</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    @page {
      size: ${orientacao === 'landscape' ? 'landscape' : 'portrait'};
      margin: 12mm 14mm 16mm 14mm;
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11.5px;
      padding: 24px;
    }

    /* CAPA / CABEÇALHO CORPORATIVO */
    .doc-header {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }

    .brand-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .brand-logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-tag {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #b45309;
      background: #fef3c7;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #fde68a;
    }

    .system-title {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }

    .doc-title-group h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-bottom: 4px;
    }

    .doc-subtitle {
      font-size: 13px;
      color: #334155;
      margin-bottom: 14px;
    }

    /* METADADOS DA PÁGINA EXPORTADA */
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 11px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-item .meta-lbl {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 2px;
    }

    .meta-item .meta-val {
      font-size: 11.5px;
      font-weight: 600;
      color: #0f172a;
    }

    .meta-full {
      grid-column: span 4;
      border-top: 1px dashed #e2e8f0;
      padding-top: 6px;
      margin-top: 2px;
    }

    /* SUMÁRIO */
    .toc-container {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0f172a;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .toc-title {
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .toc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 16px;
    }

    .toc-item {
      display: flex;
      align-items: baseline;
      font-size: 11px;
      color: #334155;
    }

    .toc-num {
      font-weight: 700;
      color: #0f172a;
      margin-right: 6px;
    }

    .toc-name {
      font-weight: 600;
      white-space: nowrap;
    }

    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #94a3b8;
      margin: 0 6px;
    }

    /* SEÇÕES */
    .section-block {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }

    .section-heading {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }

    .section-num-tag {
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      width: 22px;
      height: 22px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }

    .section-desc {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }

    /* CARDS DE KPI */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }

    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
    }

    .kpi-card.primary { border-left: 3.5px solid #0284c7; }
    .kpi-card.amber { border-left: 3.5px solid #d97706; }
    .kpi-card.emerald { border-left: 3.5px solid #16a34a; }
    .kpi-card.sky { border-left: 3.5px solid #3b82f6; }

    .kpi-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 4px;
    }

    .kpi-value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: -0.02em;
    }

    .kpi-sub {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 3px;
    }

    /* TABELAS */
    .table-container {
      width: 100%;
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    th, td {
      border-bottom: 1px solid #e2e8f0;
      padding: 7px 9px;
      text-align: left;
    }

    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 2px solid #cbd5e1;
    }

    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }

    .l { text-align: left; }
    .c { text-align: center; }
    .r {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-variant-numeric: tabular-nums;
    }

    .font-bold { font-weight: 700; }
    .empty { color: #64748b; padding: 16px !important; font-style: italic; }

    tfoot .total-row td {
      background: #e2e8f0;
      font-weight: 800;
      color: #0f172a;
      border-top: 2px solid #94a3b8;
      border-bottom: none;
      font-size: 11.5px;
    }

    /* OBSERVAÇÕES */
    .obs-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #d97706;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 20px;
      font-size: 11px;
      color: #78350f;
    }

    .obs-box strong { color: #92400e; }

    /* RODAPÉ DO DOCUMENTO */
    .doc-footer {
      margin-top: 36px;
      padding-top: 12px;
      border-top: 1.5px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 10px;
    }

    @media print {
      body { padding: 0; }
      .section-block { page-break-inside: avoid; }
      .toc-container { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- CABEÇALHO INSTITUCIONAL COM BRANDING -->
  <header class="doc-header">
    <div class="brand-bar">
      <div class="brand-logo-area">
        <span class="brand-tag">Blink Biotech</span>
        <span class="system-title">${escapeHtml(BLINK_BRAND.systemName)}</span>
      </div>
      <div style="font-size: 10px; color: #64748b;">
        Documento Corporativo para Diretoria
      </div>
    </div>

    <div class="doc-title-group">
      <h1>${escapeHtml(titulo)}</h1>
      <div class="doc-subtitle">${escapeHtml(subtitulo)}</div>
    </div>

    <!-- METADADOS DA EXPORTAÇÃO -->
    <div class="metadata-grid">
      <div class="meta-item">
        <span class="meta-lbl">Origem do Relatório</span>
        <span class="meta-val">${escapeHtml(origem)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Período de Referência</span>
        <span class="meta-val">${escapeHtml(periodo)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Data e Hora de Emissão</span>
        <span class="meta-val">${escapeHtml(dataHoraGeracao)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">Emitido Por</span>
        <span class="meta-val">${escapeHtml(geradoPor)}</span>
      </div>
      <div class="meta-item meta-full">
        <span class="meta-lbl">Filtros e Parâmetros Aplicados:</span>
        <span class="meta-val" style="font-weight: 500;">${filtrosDesc}</span>
      </div>
    </div>
  </header>

  <!-- SUMÁRIO EXECUTIVO -->
  ${tocHtml}

  <!-- OBSERVAÇÕES EXECUTIVAS -->
  ${
    observacoes
      ? `
    <div class="obs-box">
      <strong>Observações e Parecer Estratégico:</strong> ${escapeHtml(observacoes)}
    </div>
  `
      : ''
  }

  <!-- SEÇÕES DO DOCUMENTO -->
  <main>
    ${sectionsHtml}
  </main>

  <!-- RODAPÉ CORPORATIVO -->
  <footer class="doc-footer">
    <span>Blink Biotech — Documento confidencial gerado pelo Bunker de Inteligência Comercial.</span>
    <span>Arquivo oficial da Diretoria</span>
  </footer>

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
