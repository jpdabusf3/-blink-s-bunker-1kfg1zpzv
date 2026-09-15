import pb from '@/lib/pocketbase/client'
import type { ChatMessage } from '@/hooks/useMaestroChat'

export interface MaestroConversationRecord {
  id: string
  user_id: string
  titulo: string
  conversation_id?: string
  messages: SerializedChatMessage[]
  created: string
  updated: string
}

export type SerializedChatMessage = Omit<ChatMessage, 'timestamp' | 'quickReplies'> & {
  timestamp: string
}

/**
 * Serializa a lista de mensagens para gravação no banco,
 * limpando closures/funções (quickReplies), descartando mensagens vazias/intermediárias
 * e normalizando o estado de confirmationCard se estiver pendente ou em execução.
 */
export function serializeMessagesForStorage(messages: ChatMessage[]): SerializedChatMessage[] {
  return messages
    .filter((msg) => {
      // Descarta mensagens sem conteúdo e sem anexo ou cards
      const hasContent = Boolean(msg.content && msg.content.trim().length > 0)
      const hasCard = Boolean(msg.confirmationCard)
      const hasAttachment = Boolean(msg.attachment)
      // Descarta mensagens puramente de carregamento transitório se ainda vazias
      if (!hasContent && !hasCard && !hasAttachment) {
        return false
      }
      return true
    })
    .map((msg) => {
      let confirmationCard = msg.confirmationCard ? { ...msg.confirmationCard } : undefined

      if (confirmationCard) {
        // Se a mensagem ficou presa em 'executing' ou 'pending' na sessão anterior,
        // restauramos como 'cancelled' se pendente, ou mantemos como histórico final estático
        if (confirmationCard.status === 'executing') {
          confirmationCard.status = confirmationCard.executionResult ? 'confirmed' : 'cancelled'
        }
      }

      const serialized: SerializedChatMessage = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : String(msg.timestamp || new Date().toISOString()),
        attachment: msg.attachment ? { ...msg.attachment } : undefined,
        isAnalyzing: false, // nunca salvar em estado analisando
        isExecuting: false, // nunca salvar em estado executando
        confirmationCard,
        reportConfig: msg.reportConfig || null,
        error: msg.error,
      }

      return serialized
    })
}

/**
 * Desserializa as mensagens recuperadas do banco, convertendo timestamp para Date
 * e removendo pendências transitórias.
 */
export function deserializeMessagesFromStorage(saved: SerializedChatMessage[]): ChatMessage[] {
  if (!Array.isArray(saved)) return []

  return saved.map((msg) => {
    let card = msg.confirmationCard ? { ...msg.confirmationCard } : undefined
    if (card && (card.status === 'executing' || card.status === 'pending')) {
      // Se não havia sido concluído antes de fechar/sair, o card aparece como cancelado ou estático
      card.status = card.executionResult ? 'confirmed' : 'cancelled'
    }

    return {
      id: msg.id,
      role: msg.role,
      content: msg.content || '',
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      attachment: msg.attachment,
      isAnalyzing: false,
      isExecuting: false,
      confirmationCard: card,
      reportConfig: msg.reportConfig || null,
      error: msg.error,
    }
  })
}

/**
 * Carrega a conversa mais recente do usuário autenticado.
 */
export async function getLatestMaestroConversation(
  userId: string,
): Promise<MaestroConversationRecord | null> {
  if (!userId) return null

  try {
    const records = await pb
      .collection('maestro_conversations')
      .getList<MaestroConversationRecord>(1, 1, {
        filter: `user_id = "${userId}"`,
        sort: '-updated',
      })

    if (records.items && records.items.length > 0) {
      return records.items[0]
    }
    return null
  } catch (err) {
    console.warn('Erro ao carregar conversa salva do Maestro:', err)
    return null
  }
}

/**
 * Salva (cria ou atualiza) a conversa do usuário de forma segura.
 */
export async function saveMaestroConversation(params: {
  recordId?: string | null
  userId: string
  conversationId?: string | null
  messages: ChatMessage[]
  titulo?: string
}): Promise<MaestroConversationRecord | null> {
  const { recordId, userId, conversationId, messages, titulo } = params
  if (!userId) return null

  const serialized = serializeMessagesForStorage(messages)

  // Se não há mensagens para salvar e nenhum registro criado, nada a fazer
  if (serialized.length === 0 && !recordId) {
    return null
  }

  const defaultTitle =
    titulo ||
    `Conversa de ${new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date())}`

  const payload: Record<string, unknown> = {
    user_id: userId,
    messages: serialized,
  }

  if (conversationId) {
    payload.conversation_id = conversationId
  }

  try {
    if (recordId) {
      // Atualiza registro existente
      const updated = await pb
        .collection('maestro_conversations')
        .update<MaestroConversationRecord>(recordId, payload)
      return updated
    }

    // Se não passamos recordId, verifica se já existe uma conversa salva para esse usuário
    const existing = await getLatestMaestroConversation(userId)
    if (existing) {
      const updated = await pb
        .collection('maestro_conversations')
        .update<MaestroConversationRecord>(existing.id, payload)
      return updated
    }

    // Cria novo registro
    payload.titulo = defaultTitle
    const created = await pb
      .collection('maestro_conversations')
      .create<MaestroConversationRecord>(payload)
    return created
  } catch (err) {
    console.error('Falha ao persistir conversa do Maestro:', err)
    return null
  }
}

/**
 * Limpa ou cria uma nova conversa para o usuário, excluindo ou resetando o registro existente.
 */
export async function clearMaestroConversationRecord(recordId: string): Promise<boolean> {
  if (!recordId) return false
  try {
    await pb.collection('maestro_conversations').delete(recordId)
    return true
  } catch (err) {
    console.warn('Falha ao excluir conversa do Maestro:', err)
    return false
  }
}
