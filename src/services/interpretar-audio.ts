import pb from '@/lib/pocketbase/client'

export interface InterpretarAudioCliente {
  nome: string | null
  cnpj: string | null
  cidade: string | null
  estado: string | null
}

export interface InterpretarAudioResult {
  cliente: InterpretarAudioCliente
  vendedor: string | null
  carteira: string | null
  grupo_cliente: string | null
  tipo_atividade: string | null
  etapa_funil: string | null
  valor_estimado: number | null
  descricao: string | null
  proximo_passo: string | null
  data_proxima_acao: string | null
  pendencias: string[] | null
  observacoes: string | null
  confianca: number
}

export interface InterpretarAudioPrecisaConfirmacao {
  precisa_confirmacao: true
}

export type InterpretarAudioResponse = InterpretarAudioResult | InterpretarAudioPrecisaConfirmacao

export function isPrecisaConfirmacao(
  res: InterpretarAudioResponse,
): res is InterpretarAudioPrecisaConfirmacao {
  return (res as InterpretarAudioPrecisaConfirmacao).precisa_confirmacao === true
}

export const interpretarAudio = (textoTranscrito: string) =>
  pb.send<InterpretarAudioResponse>('/backend/v1/interpretar-audio', {
    method: 'POST',
    body: JSON.stringify({ textoTranscrito }),
    headers: { 'Content-Type': 'application/json' },
  })

export interface GravarAtividadeRequest {
  cliente: {
    nome: string | null
    cnpj: string | null
    cidade: string | null
    estado: string | null
  }
  vendedor: string | null
  tipo_atividade: string | null
  etapa_funil: string | null
  valor_estimado: number | null
  descricao: string | null
  proximo_passo: string | null
  data_proxima_acao: string | null
  pendencias: string[] | null
  observacoes: string | null
  confianca: number
  precisa_confirmacao?: boolean
  audio_transcrito?: string
  carteira?: string | null
  grupo_cliente?: string | null
}

export interface GravarAtividadeResponse {
  success: boolean
  atividade_id?: string
  cliente_id?: string
  precisa_confirmacao?: boolean
  message?: string
  error?: string
}

export const gravarAtividade = (data: GravarAtividadeRequest) =>
  pb.send<GravarAtividadeResponse>('/backend/v1/gravar-atividade', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
