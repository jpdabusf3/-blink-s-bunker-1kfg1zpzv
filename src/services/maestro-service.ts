import pb from '@/lib/pocketbase/client'
import {
  streamAgentChat,
  type DisplayMessage,
  type AgentMessage,
  displayableMessages,
} from '@/lib/skipAi'

export interface MaestroReportConfig {
  tipo?: string
  periodo?: string
  ano?: number
  mes?: number
  semana?: number
  modo?: 'month' | 'week' | 'custom' | string
  filtros?: {
    cliente?: string
    pais?: string
    estado?: string
    segmento?: string
    marca?: string
  }
  dados_inclusos?: {
    faturamento?: boolean
    pedidos?: boolean
    top_clientes?: boolean
    familias?: boolean
    cobertura?: boolean
  }
  saida?: string
  observacoes?: string
}

export interface MaestroReportGenerationResult {
  success: boolean
  document_id: string
  client_report_id?: string
  nome_arquivo: string
  titulo: string
  periodo: string
  faturado_total_brl: number
  faturado_total_usd?: number
  quantidade_notas: number
  ticket_medio?: number
  carteira_total_brl?: number
  cobertura_percent?: number
  top_clientes?: Array<{ cliente: string; valor_brl: number }>
  top_familias?: Array<{ familia: string; valor_brl: number }>
  error?: string
}

export interface MaestroChatSendResult {
  conversationId: string
  messageId: string
  content: string
}

/**
 * Envia mensagem para o agente nativo MAESTRO usando SSE streaming
 */
export async function sendMaestroMessageStream(
  message: string,
  conversationId: string | null,
  handlers: {
    onChunk?: (delta: string, full: string) => void
    onError?: (error: string) => void
    signal?: AbortSignal
  },
): Promise<MaestroChatSendResult> {
  const url = `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/maestro/chat-stream`
  const token = pb.authStore.token

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
    signal: handlers.signal,
  })

  const result = await streamAgentChat(res, {
    onChunk: handlers.onChunk,
    onError: handlers.onError,
    signal: handlers.signal,
  })

  const resolvedConvId =
    res.headers.get('X-Conversation-Id') || result.conversation_id || conversationId || ''

  return {
    conversationId: resolvedConvId,
    messageId: result.message_id,
    content: result.content,
  }
}

/**
 * Envia mensagem para o agente nativo MAESTRO de forma síncrona (fallback)
 */
export async function sendMaestroMessageSync(
  message: string,
  conversationId: string | null,
): Promise<MaestroChatSendResult> {
  const res = await pb.send<{
    conversation_id: string
    content: string
    message_id: string
  }>('/backend/v1/maestro/chat', {
    method: 'POST',
    body: {
      message,
      conversation_id: conversationId,
    },
  })

  return {
    conversationId: res.conversation_id,
    messageId: res.message_id,
    content: res.content,
  }
}

/**
 * Carrega histórico de mensagens de uma conversa
 */
export async function loadMaestroConversationMessages(
  conversationId: string,
): Promise<DisplayMessage[]> {
  const res = await pb.send<{ messages: AgentMessage[] }>(
    `/backend/v1/maestro/conversations/${conversationId}/messages`,
    {
      method: 'GET',
    },
  )

  return displayableMessages(res.messages || [])
}

/**
 * Extrai o bloco de configuração JSON de relatório caso o MAESTRO tenha gerado na resposta
 */
export function extractReportConfigFromText(text: string): MaestroReportConfig | null {
  if (!text) return null

  // Tentar encontrar bloco ```json ... ```
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i
  const match = text.match(jsonBlockRegex)
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed && typeof parsed === 'object') {
        return parsed as MaestroReportConfig
      }
    } catch {
      // Ignora erro de JSON malformado
    }
  }

  // Se houver um objeto JSON cru com "periodo" ou "tipo"
  const rawJsonRegex = /\{[\s\S]*"tipo"\s*:\s*"relatorio_vendas_maestro"[\s\S]*\}/i
  const rawMatch = text.match(rawJsonRegex)
  if (rawMatch) {
    try {
      const parsed = JSON.parse(rawMatch[0])
      if (parsed && typeof parsed === 'object') {
        return parsed as MaestroReportConfig
      }
    } catch {
      // Ignora erro
    }
  }

  return null
}

/**
 * Dispara o processamento e consolidação de relatório no backend:
 * consulta faturamento/pedidos, gera o PDF binário e salva em documents e client_reports.
 */
export async function gerarRelatorioMaestro(
  config: MaestroReportConfig,
): Promise<MaestroReportGenerationResult> {
  const res = await pb.send<MaestroReportGenerationResult>('/backend/v1/maestro/gerar-relatorio', {
    method: 'POST',
    body: {
      config,
    },
  })
  return res
}
