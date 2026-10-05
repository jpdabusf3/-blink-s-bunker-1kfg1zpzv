import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import type { Atividade } from '@/types'

export interface ValidarEGravarRequest {
  origem: 'audio' | 'manual' | 'excel'
  cliente: {
    nome: string | null
    cnpj: string | null
    cidade: string | null
    estado: string | null
  }
  vendedor: string | null
  vendedor_id?: string
  tipo_atividade: string
  etapa_funil: string
  valor_estimado?: number
  descricao?: string
  proximo_passo?: string
  data_proxima_acao?: string
  pendencias?: string[] | string | null
  observacoes?: string
  confianca?: number
  audio_transcrito?: string
  carteira?: string
  grupo_cliente?: string
}

export interface ValidarEGravarResponse {
  success?: boolean
  atividade_id?: string
  cliente_id?: string
  precisa_confirmacao?: boolean
  pending_id?: string
}

export const validarEGravar = async (data: ValidarEGravarRequest) => {
  const res = await pb.send<ValidarEGravarResponse>('/backend/v1/validar-e-gravar', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
  notifyDataChanged('atividades')
  notifyDataChanged('factories')
  return res
}

export const getAtividades = () =>
  pb.collection('atividades').getFullList<Atividade>({
    sort: '-created',
    expand: 'cliente_id,vendedor_id',
  })

/**
 * Call the backend route that generates the visit PDF, stores it on the
 * atividade.relatorio_pdf field, and returns the binary PDF for download.
 */
export async function generateAtividadePdf(atividadeId: string): Promise<Blob> {
  const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/atividade-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ atividadeId }),
  })
  if (!res.ok) throw new Error('Falha ao gerar PDF da visita')
  return res.blob()
}

/** Download the generated visit PDF to the user's machine. */
export async function downloadAtividadePdf(atividadeId: string, label?: string): Promise<void> {
  const blob = await generateAtividadePdf(atividadeId)
  const safe = (label || 'atividade').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  const fileName = `relatorio_visita_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Build the storage URL for a previously-stored relatorio_pdf file. */
export function getAtividadePdfUrl(atividade: {
  id: string
  relatorio_pdf?: string
}): string | null {
  if (!atividade.relatorio_pdf) return null
  return `${import.meta.env.VITE_POCKETBASE_URL}/api/files/atividades/${atividade.id}/${atividade.relatorio_pdf}`
}
