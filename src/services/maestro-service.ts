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
 * Valida se um objeto possui os campos mínimos para ser uma configuração de relatório do Maestro.
 * Requisito: tipo === 'relatorio_vendas_maestro' OU ('tipo' no objeto E (periodo OU modo OU ano)).
 */
function isValidReportConfig(parsed: unknown): parsed is MaestroReportConfig {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false
  }
  const obj = parsed as Record<string, unknown>
  const tipo = typeof obj.tipo === 'string' ? obj.tipo.trim() : ''

  const isExactType = tipo === 'relatorio_vendas_maestro'
  const isReportLike =
    isExactType ||
    (tipo.toLowerCase().includes('relatorio') &&
      Boolean(obj.periodo || obj.modo || obj.ano || obj.mes))

  if (!isReportLike) {
    return false
  }

  // Validação dos campos mínimos: tipo + (periodo ou modo ou ano)
  const hasPeriodOrMode = Boolean(
    obj.periodo ||
    obj.modo ||
    obj.ano ||
    (obj.filtros && typeof obj.filtros === 'object') ||
    (obj.dados_inclusos && typeof obj.dados_inclusos === 'object'),
  )

  return hasPeriodOrMode
}

/**
 * Extrai o bloco de configuração JSON de relatório caso o MAESTRO tenha gerado na resposta,
 * mesmo quando vier embutido em respostas longas de markdown com texto antes/depois,
 * múltiplos fences ou objetos JSON com quebras de linha e caracteres especiais.
 */
export function extractReportConfigFromText(text: string): MaestroReportConfig | null {
  if (!text || typeof text !== 'string') return null

  // 1. Procurar em todos os blocos com fences ```json ... ``` ou ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    const candidate = blockMatch[1].trim()
    try {
      const parsed = JSON.parse(candidate)
      if (isValidReportConfig(parsed)) {
        if (import.meta.env.DEV) {
          console.log(
            '[MAESTRO] Configuração de relatório extraída com sucesso de codeblock:',
            parsed,
          )
        }
        return parsed
      }
    } catch {
      // Tenta extrair sub-objeto JSON dentro do codeblock (caso venha com comentários ou texto)
      const innerJson = extractFirstBalancedJson(candidate)
      if (innerJson) {
        try {
          const parsed = JSON.parse(innerJson)
          if (isValidReportConfig(parsed)) {
            if (import.meta.env.DEV) {
              console.log(
                '[MAESTRO] Configuração de relatório extraída de JSON interno em codeblock:',
                parsed,
              )
            }
            return parsed
          }
        } catch {
          // segue para próxima tentativa
        }
      }
    }
  }

  // 2. Procurar em objetos balanceados {...} que contenham "tipo" ou "relatorio_vendas_maestro"
  const markerIdx = text.indexOf('relatorio_vendas_maestro')
  if (markerIdx !== -1) {
    // Achar o '{' anterior ao marcador ou o '{' que envolve o marcador
    let startIdx = text.lastIndexOf('{', markerIdx)
    while (startIdx !== -1) {
      const balanced = extractBalancedCurly(text, startIdx)
      if (balanced) {
        try {
          const parsed = JSON.parse(balanced)
          if (isValidReportConfig(parsed)) {
            if (import.meta.env.DEV) {
              console.log(
                '[MAESTRO] Configuração extraída por busca balanceada em torno do tipo:',
                parsed,
              )
            }
            return parsed
          }
        } catch {
          // tentar com o próximo '{' mais à esquerda
        }
      }
      startIdx = text.lastIndexOf('{', startIdx - 1)
    }
  }

  // 3. Fallback: escanear qualquer bloco de chaves balanceadas no texto completo
  let scanIdx = text.indexOf('{')
  while (scanIdx !== -1) {
    const balanced = extractBalancedCurly(text, scanIdx)
    if (
      balanced &&
      (balanced.includes('relatorio_vendas_maestro') || balanced.includes('dados_inclusos'))
    ) {
      try {
        const parsed = JSON.parse(balanced)
        if (isValidReportConfig(parsed)) {
          if (import.meta.env.DEV) {
            console.log('[MAESTRO] Configuração extraída por varredura balanceada global:', parsed)
          }
          return parsed
        }
      } catch {
        // continua
      }
    }
    scanIdx = text.indexOf('{', scanIdx + 1)
  }

  if (
    import.meta.env.DEV &&
    (text.includes('relatorio_vendas_maestro') || text.includes('"tipo"'))
  ) {
    console.warn('[MAESTRO] O texto parecia conter relatório mas a extração falhou:', text)
  }

  return null
}

/**
 * Extrai substring com chaves balanceadas a partir de um índice inicial `{`
 */
function extractBalancedCurly(str: string, startIndex: number): string | null {
  if (startIndex < 0 || startIndex >= str.length || str[startIndex] !== '{') {
    return null
  }
  let depth = 0
  let inString = false
  let escape = false

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0) {
          return str.slice(startIndex, i + 1)
        }
      }
    }
  }

  return null
}

/**
 * Localiza o primeiro bloco balanceado {...} em uma string
 */
function extractFirstBalancedJson(str: string): string | null {
  const start = str.indexOf('{')
  if (start === -1) return null
  return extractBalancedCurly(str, start)
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
