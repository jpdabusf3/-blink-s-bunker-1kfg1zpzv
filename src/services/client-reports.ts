import pb from '@/lib/pocketbase/client'
import type { ActivityLog } from '@/types'

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

/** Call the backend to generate the Word (.docx) report and return its bytes. */
export const generateClientWordReport = async (
  clientId: string,
  opts?: { titulo?: string; modelo?: string; solicitante?: string },
) => {
  const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/client-reports/word`, {
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
    }),
  })
  if (!res.ok) {
    let msg = 'Falha ao gerar relatório Word'
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

function safeFileName(clientName: string) {
  const safe = (clientName || 'cliente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  return `relatorio_${safe}_${new Date().toISOString().slice(0, 10)}.docx`
}

/**
 * Generate the Word report on the backend, download it to the user AND store
 * a copy in the `client_reports` collection so it appears in the Relatórios
 * tab for later re-download / PDF export.
 */
export const generateAndStoreClientWordReport = async (
  clientId: string,
  clientName: string,
  opts?: { titulo?: string; modelo?: string; solicitante?: string; store?: boolean },
): Promise<ClientReport | null> => {
  const blob = await generateClientWordReport(clientId, opts)
  const fileName = safeFileName(clientName)
  const file = new File([blob], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  // trigger browser download (skipped in batch mode where the caller zips blobs)
  const store = opts?.store !== false
  if (!store) {
    // caller takes the blob via generateClientWordReport directly
    return null
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  // store the generated file for later access (Relatórios tab)
  const form = new FormData()
  form.append('client_id', clientId)
  form.append('client_name', clientName)
  form.append('title', opts?.titulo || `Relatório de Histórico — ${clientName}`)
  form.append('file', file)
  const created = await pb.collection('client_reports').create<ClientReport>(form)
  return created
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
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = report.file
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(downloadUrl)
}

/** Delete a stored client report. */
export const deleteClientReport = (id: string) => pb.collection('client_reports').delete(id)
