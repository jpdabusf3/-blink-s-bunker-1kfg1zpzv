import pb from '@/lib/pocketbase/client'
import { generateClientPdfReport, dateStamp } from '@/services/client-reports'
import type { ReportTemplateKey } from '@/lib/reportTemplates'
import { REPORT_TEMPLATE_LABEL } from '@/lib/reportTemplates'
import type { Factory } from '@/types'

/**
 * Minimal stored-ZIP writer (no dependencies). Produces a valid .zip whose
 * entries are stored (method 0, no compression) — enough for bundling a
 * handful of PDF blobs per download.
 */

function u16(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff]
}
function u32(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]
}

// CRC-32 (IEEE) table + compute, for the ZIP local/central headers.
let CRC_TABLE: number[] | null = null
function crc32Table(): number[] {
  if (CRC_TABLE) return CRC_TABLE
  const t: number[] = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  CRC_TABLE = t
  return t
}
function crc32(bytes: Uint8Array): number {
  const table = crc32Table()
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

function strToBytes(s: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) {
      bytes.push(c)
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6))
      bytes.push(0x80 | (c & 0x3f))
    } else if (c < 0xd800 || c >= 0xe000) {
      bytes.push(0xe0 | (c >> 12))
      bytes.push(0x80 | ((c >> 6) & 0x3f))
      bytes.push(0x80 | (c & 0x3f))
    } else {
      i++
      const c2 = s.charCodeAt(i)
      const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff))
      bytes.push(0xf0 | (cp >> 18))
      bytes.push(0x80 | ((cp >> 12) & 0x3f))
      bytes.push(0x80 | ((cp >> 6) & 0x3f))
      bytes.push(0x80 | (cp & 0x3f))
    }
  }
  return bytes
}

function buildStoredZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const out: number[] = []
  const central: number[] = []
  let offset = 0
  for (const entry of entries) {
    const nameBytes = strToBytes(entry.name)
    const data = entry.data
    const crc = crc32(data)
    const size = data.length
    let lh: number[] = []
    lh = lh.concat(u32(0x04034b50))
    lh = lh.concat(u16(20))
    lh = lh.concat(u16(0))
    lh = lh.concat(u16(0))
    lh = lh.concat(u16(0))
    lh = lh.concat(u16(0))
    lh = lh.concat(u32(crc))
    lh = lh.concat(u32(size))
    lh = lh.concat(u32(size))
    lh = lh.concat(u16(nameBytes.length))
    lh = lh.concat(u16(0))
    out.push(...lh)
    out.push(...nameBytes)
    out.push(...Array.from(data))
    let cdh: number[] = []
    cdh = cdh.concat(u32(0x02014b50))
    cdh = cdh.concat(u16(20))
    cdh = cdh.concat(u16(20))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u32(crc))
    cdh = cdh.concat(u32(size))
    cdh = cdh.concat(u32(size))
    cdh = cdh.concat(u16(nameBytes.length))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u16(0))
    cdh = cdh.concat(u32(0))
    cdh = cdh.concat(u32(offset))
    cdh = cdh.concat(nameBytes)
    central.push(...cdh)
    offset += lh.length + nameBytes.length + data.length
  }
  let eocd: number[] = []
  eocd = eocd.concat(u32(0x06054b50))
  eocd = eocd.concat(u16(0))
  eocd = eocd.concat(u16(0))
  eocd = eocd.concat(u16(entries.length))
  eocd = eocd.concat(u16(entries.length))
  eocd = eocd.concat(u32(central.length))
  eocd = eocd.concat(u32(offset))
  eocd = eocd.concat(u16(0))
  return new Uint8Array(out.concat(central).concat(eocd))
}

/** Sanitize a client name for use inside a PDF file name. */
function safePdfFileName(clientName: string): string {
  const safe =
    (clientName || 'cliente')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'cliente'
  return `relatorio-${safe}-${dateStamp()}.pdf`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface BatchExportFailure {
  clientName: string
  error: string
}

export interface BatchExportResult {
  /** Number of reports successfully generated. */
  count: number
  /** Clients whose report failed to generate. */
  failures: BatchExportFailure[]
  /** Name of the file that was downloaded (.zip or .pdf). */
  downloadedFile: string
}

export interface BatchExportProgress {
  done: number
  total: number
  currentName?: string
}

/**
 * Generate a PDF report for each selected client and either download a single
 * PDF (when only one client is selected) or bundle them into a single .zip.
 *
 * - Uses the chosen visual template (`modelo`) for all reports.
 * - Stamps the requesting user's name (`solicitante`) into every document.
 * - If a client's report fails, generation continues with the remaining ones;
 *   failures are returned (not thrown) so the caller can show a partial toast.
 * - `onProgress` is invoked after each client (success or failure) with the
 *   number completed so far.
 */
export async function exportBatchClientReportsZip(
  clients: Pick<Factory, 'id' | 'name'>[],
  opts: {
    modelo: ReportTemplateKey
    solicitante: string
    onProgress?: (p: BatchExportProgress) => void
  },
): Promise<BatchExportResult> {
  if (clients.length === 0) throw new Error('Selecione pelo menos um cliente para exportar.')

  const failures: BatchExportFailure[] = []
  const entries: { name: string; data: Uint8Array }[] = []
  const total = clients.length

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    try {
      const blob = await generateClientPdfReport(client.id, {
        modelo: opts.modelo,
        solicitante: opts.solicitante,
        titulo: `Relatório de Histórico — ${client.name}`,
      })
      const buf = new Uint8Array(await blob.arrayBuffer())
      entries.push({ name: safePdfFileName(client.name), data: buf })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[batch export] Falha ao gerar relatório para "${client.name}":`, message)
      failures.push({ clientName: client.name, error: message })
    }
    opts.onProgress?.({ done: i + 1, total, currentName: client.name })
  }

  const count = entries.length

  if (count === 0) {
    throw new Error('Não foi possível gerar os relatórios. Tente novamente.')
  }

  // Single client → download the lone PDF directly (no zip).
  if (count === 1) {
    const entry = entries[0]
    const blob = new Blob([entry.data as BlobPart], { type: 'application/pdf' })
    triggerDownload(blob, entry.name)
    return { count, failures, downloadedFile: entry.name }
  }

  // Multiple clients → bundle into a .zip.
  const zipBytes = buildStoredZip(entries)
  const zipBlob = new Blob([zipBytes as BlobPart], { type: 'application/zip' })
  const zipName = `relatorios-lote-${dateStamp()}.zip`
  triggerDownload(zipBlob, zipName)
  return { count, failures, downloadedFile: zipName }
}

/**
 * Register a batch export in the `atividades` collection AND in the
 * `funnel_activity_log` collection (the funnel log is what the activity
 * timeline surfaces). Best-effort: logging failures are swallowed.
 */
export async function logBatchReportExport(opts: {
  solicitante: string
  solicitanteId?: string
  clienteIds: string[]
  modelo: ReportTemplateKey
  origem?: string
  formato?: 'pdf' | 'google-docs'
}): Promise<void> {
  const userId = pb.authStore.record?.id
  const modeloLabel = REPORT_TEMPLATE_LABEL[opts.modelo]
  const formato = opts.formato || 'pdf'
  const descricao =
    formato === 'pdf'
      ? `Exportou relatórios em lote (PDF) para ${opts.clienteIds.length} clientes (modelo: ${modeloLabel})`
      : `Exportou relatórios em lote (Google Docs) para ${opts.clienteIds.length} clientes (modelo: ${modeloLabel})`

  // 1) funnel_activity_log — action_type=create, entity_type=client
  try {
    await pb.collection('funnel_activity_log').create({
      user: userId || '',
      action_type: 'create',
      entity_type: 'client',
      entity_id: opts.clienteIds[0] || '',
      entity_name: '',
      old_value: '',
      new_value: '',
      description: descricao,
    })
  } catch (err) {
    console.error('[batch export] funnel_activity_log failed', err)
  }

  // 2) atividades — legacy export log entry (kept for backwards compat)
  const detalhes = {
    data: new Date().toISOString(),
    usuario_solicitante: opts.solicitante,
    usuario_solicitante_id: opts.solicitanteId || userId || '',
    quantidade_clientes: opts.clienteIds.length,
    modelo_utilizado: opts.modelo,
    modelo_label: modeloLabel,
    formato,
    origem: opts.origem || 'manual',
  }
  try {
    await pb.collection('atividades').create({
      cliente_id: null,
      vendedor_id: userId || null,
      tipo_atividade: 'exportacao_relatorio',
      etapa_funil: 'pos_venda',
      valor_estimado: 0,
      descricao,
      proximo_passo: '',
      origem: 'manual',
      detalhes_exportacao: detalhes,
    })
  } catch {
    // Best-effort logging; never block the export on a logging failure.
  }
}
