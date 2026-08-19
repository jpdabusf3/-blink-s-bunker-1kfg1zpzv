import pb from '@/lib/pocketbase/client'
import type { ActivityLog } from '@/types'
import type { ReportTemplateKey } from '@/lib/reportTemplates'
import { REPORT_TEMPLATE_LABEL } from '@/lib/reportTemplates'

export interface ClientReport {
  id: string
  client_id: string
  client_name: string
  generated_by: string
  generated_by_name: string
  title: string
  file: string
  periodo_inicio?: string
  periodo_fim?: string
  total_acoes?: number
  created: string
  updated: string
}

/**
 * Structured activity log entry as stored in `activity_logs` (with the new
 * fields: tipo, proximo_passo, status_anterior, status_novo, origem).
 */
export interface ActivityLogEntry extends ActivityLog {
  tipo?: string
  proximo_passo?: string
  status_anterior?: string
  status_novo?: string
  origem?: string
}

/** Fetch the full history of actions for a given client (factory). */
export const getClientHistory = (clientId: string): Promise<ActivityLogEntry[]> =>
  pb.collection('activity_logs').getFullList<ActivityLogEntry>({
    sort: 'created',
    expand: 'user',
    filter: `recordId = "${clientId}"`,
  })

export interface NewActionPayload {
  action: string
  proximo_passo?: string
  tipo?: string
  status_anterior?: string
  status_novo?: string
  origem?: string
  clientId: string
}

/** Register a new manual action in the client's history. */
export const addClientAction = (payload: NewActionPayload) =>
  pb.send('/backend/v1/log-activity', {
    method: 'POST',
    body: JSON.stringify({
      action: payload.action,
      details: payload.proximo_passo ? `Próximo passo: ${payload.proximo_passo}` : '',
      recordId: payload.clientId,
      collectionName: 'factories',
      tipo: payload.tipo || 'acao',
      proximo_passo: payload.proximo_passo || '',
      status_anterior: payload.status_anterior || '',
      status_novo: payload.status_novo || '',
      origem: payload.origem || 'manual',
    }),
    headers: { 'Content-Type': 'application/json' },
  })

export interface ClientReportOpts {
  titulo?: string
  modelo?: string
  solicitante?: string
  periodoInicio?: string
  periodoFim?: string
}

/** Date stamp formatted as DD-MM-YYYY (locale independent). */
export function dateStamp(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/** Sanitize a client name for use inside a file name. */
export function safePdfFileName(clientName: string): string {
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

/** Call the backend to generate the PDF report and return its bytes. */
export const generateClientPdfReport = async (
  clientId: string,
  opts?: ClientReportOpts,
): Promise<Blob> => {
  const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/client-reports/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({
      clientId,
      titulo: opts?.titulo,
      modelo: opts?.modelo,
      solicitante: opts?.solicitante,
      periodoInicio: opts?.periodoInicio,
      periodoFim: opts?.periodoFim,
    }),
  })
  if (!res.ok) {
    let msg = 'Falha ao gerar relatório PDF'
    try {
      const data = await res.json()
      if (data && data.error) msg = data.error
    } catch {
      /* intentionally ignored */
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  if (!blob || blob.size === 0) {
    throw new Error('Erro ao gerar relatório.')
  }
  return blob
}

/** Call the backend to generate the Google Docs (HTML) report and return the HTML string. */
export const generateClientGoogleDocsHtml = async (
  clientId: string,
  opts?: ClientReportOpts,
): Promise<string> => {
  const res = await fetch(
    `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/client-reports/google-docs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        clientId,
        titulo: opts?.titulo,
        modelo: opts?.modelo,
        solicitante: opts?.solicitante,
        periodoInicio: opts?.periodoInicio,
        periodoFim: opts?.periodoFim,
      }),
    },
  )
  if (!res.ok) {
    let msg = 'Falha ao preparar Google Docs'
    try {
      const data = await res.json()
      if (data && data.error) msg = data.error
    } catch {
      /* intentionally ignored */
    }
    throw new Error(msg)
  }
  return res.text()
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate the PDF report on the backend, download it to the user AND store
 * a copy in the `client_reports` collection so it appears in the Relatórios
 * tab for later re-download.
 *
 * `store: false` skips the browser download and the DB store (used by the
 * batch exporter, which takes the blob via `generateClientPdfReport` directly).
 */
export const generateAndStoreClientPdfReport = async (
  clientId: string,
  clientName: string,
  opts?: ClientReportOpts & { store?: boolean },
): Promise<ClientReport | null> => {
  const blob = await generateClientPdfReport(clientId, opts)
  const fileName = safePdfFileName(clientName)
  const file = new File([blob], fileName, { type: 'application/pdf' })

  const store = opts?.store !== false
  if (!store) {
    // caller takes the blob via generateClientPdfReport directly
    return null
  }

  triggerBlobDownload(blob, fileName)

  // store the generated file for later access (Relatórios tab)
  const form = new FormData()
  form.append('client_id', clientId)
  form.append('client_name', clientName)
  form.append('title', opts?.titulo || `Relatório de Histórico — ${clientName}`)
  form.append('file', file)
  const created = await pb.collection('client_reports').create<ClientReport>(form)
  return created
}

/**
 * Open the Google Docs (HTML) report in a new browser tab. The HTML is fully
 * self-contained (inline styles) so it renders ready to be copied / imported
 * into Google Docs via "File > Open".
 */
export const openClientReportInGoogleDocs = async (
  clientId: string,
  clientName: string,
  opts?: ClientReportOpts,
): Promise<void> => {
  const html = await generateClientGoogleDocsHtml(clientId, opts)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  // Some browsers block popups; fall back to a triggered download.
  if (!win) {
    triggerBlobDownload(blob, `relatorio-${clientName}-${dateStamp()} — Abrir no Google Docs.html`)
  }
  // Release the object URL after the new tab has had a chance to load.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Register a single-client report export in the funnel_activity_log (and the
 * legacy atividades collection). Best-effort: logging failures are swallowed.
 */
export async function logClientReportExport(opts: {
  solicitante: string
  solicitanteId?: string
  clientId: string
  clientName: string
  modelo: ReportTemplateKey
  formato: 'pdf' | 'google-docs'
}): Promise<void> {
  const userId = pb.authStore.record?.id
  const modeloLabel = REPORT_TEMPLATE_LABEL[opts.modelo]
  const descricao =
    opts.formato === 'pdf'
      ? `Exportou relatório ${modeloLabel} em PDF para ${opts.clientName}`
      : `Exportou relatório ${modeloLabel} para Google Docs para ${opts.clientName}`

  try {
    await pb.collection('funnel_activity_log').create({
      user: userId || '',
      action_type: 'create',
      entity_type: 'client',
      entity_id: opts.clientId,
      entity_name: opts.clientName,
      old_value: '',
      new_value: '',
      description: descricao,
    })
  } catch (err) {
    console.error('[client report] funnel_activity_log failed', err)
  }
}

/** List all generated client reports (used by the Relatórios tab). */
export const getClientReports = (): Promise<ClientReport[]> =>
  pb.collection('client_reports').getFullList<ClientReport>({
    sort: '-created',
    expand: 'client_id,generated_by',
  })

/** Build the file URL for a stored client report. */
export const getClientReportFileUrl = (report: ClientReport): string =>
  `${import.meta.env.VITE_POCKETBASE_URL}/api/files/client_reports/${report.id}/${report.file}`

/** Download a previously generated client report file. */
export const downloadClientReportFile = async (report: ClientReport) => {
  const url = getClientReportFileUrl(report)
  const res = await fetch(url, {
    headers: { Authorization: pb.authStore.token },
  })
  if (!res.ok) throw new Error('Falha no download')
  const blob = await res.blob()
  triggerBlobDownload(blob, report.file)
}

/** Delete a stored client report. */
export const deleteClientReport = (id: string) => pb.collection('client_reports').delete(id)
