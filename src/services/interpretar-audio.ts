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
