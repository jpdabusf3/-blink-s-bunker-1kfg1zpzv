import pb from '@/lib/pocketbase/client'
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

export const validarEGravar = (data: ValidarEGravarRequest) =>
  pb.send<ValidarEGravarResponse>('/backend/v1/validar-e-gravar', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const getAtividades = () =>
  pb.collection('atividades').getFullList<Atividade>({
    sort: '-created',
    expand: 'cliente_id,vendedor_id',
  })
