import pb from '@/lib/pocketbase/client'
import { generateClientWordReport } from '@/services/client-reports'
import type { ReportTemplateKey } from '@/lib/reportTemplates'
import { REPORT_TEMPLATE_LABEL } from '@/lib/reportTemplates'
import type { Factory } from '@/types'

/**
 * Minimal stored-ZIP writer (no dependencies). Produces a valid .zip whose
 * entries are stored (method 0, no compression) — same approach the backend
 * uses for .docx. Enough for bundling a handful of .docx blobs per download.
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

function safeFileName(clientName: string): string {
  const safe = (clientName || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 50)
  return `relatorio_${safe}.docx`
}

export interface BatchExportResult {
  zipBlob: Blob
  count: number
}

/**
 * Generate a Word (.docx) report for each selected client and bundle them
 * into a single ZIP download. Uses the chosen visual template for all of
 * them and stamps the requesting user's name into every document.
 */
export async function exportBatchClientReportsZip(
  clients: Pick<Factory, 'id' | 'name'>[],
  opts: { modelo: ReportTemplateKey; solicitante: string },
): Promise<BatchExportResult> {
  if (clients.length === 0) throw new Error('Selecione ao menos um cliente.')

  const entries: { name: string; data: Uint8Array }[] = []
  let count = 0

  for (const client of clients) {
    const blob = await generateClientWordReport(client.id, {
      modelo: opts.modelo,
      solicitante: opts.solicitante,
      titulo: `Relatório de Histórico — ${client.name}`,
    })
    const buf = new Uint8Array(await blob.arrayBuffer())
    entries.push({ name: safeFileName(client.name), data: buf })
    count++
  }

  if (entries.length === 0) throw new Error('Nenhum relatório gerado.')

  const zipBytes = buildStoredZip(entries)
  const zipBlob = new Blob([zipBytes as BlobPart], { type: 'application/zip' })

  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  const stamp = new Date().toISOString().slice(0, 10)
  a.download = `relatorios_blink_${opts.modelo}_${stamp}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return { zipBlob, count }
}

/**
 * Register a batch export in the `atividades` collection:
 * tipo_atividade = "exportacao_relatorio", origem = "manual", detalhes in
 * `detalhes_exportacao` (date, requesting user, # clients, template).
 */
export async function logBatchReportExport(opts: {
  solicitante: string
  solicitanteId?: string
  clienteIds: string[]
  modelo: ReportTemplateKey
  origem?: string
}): Promise<void> {
  const userId = pb.authStore.record?.id
  const modeloLabel = REPORT_TEMPLATE_LABEL[opts.modelo]
  const detalhes = {
    data: new Date().toISOString(),
    usuario_solicitante: opts.solicitante,
    usuario_solicitante_id: opts.solicitanteId || userId || '',
    quantidade_clientes: opts.clienteIds.length,
    modelo_utilizado: opts.modelo,
    modelo_label: modeloLabel,
    origem: opts.origem || 'manual',
  }
  try {
    await pb.collection('atividades').create({
      cliente_id: null,
      vendedor_id: userId || null,
      tipo_atividade: 'exportacao_relatorio',
      etapa_funil: 'pos_venda',
      valor_estimado: 0,
      descricao: `Exportação em lote de ${opts.clienteIds.length} relatório(s) — Modelo ${modeloLabel}`,
      proximo_passo: '',
      origem: 'manual',
      detalhes_exportacao: detalhes,
    })
  } catch {
    // Best-effort logging; never block the export on a logging failure.
  }
}
