import pb from '@/lib/pocketbase/client'
import {
  ChatConversa,
  ChatMensagem,
  ChatLeituraMensagem,
  ChatContextPayload,
  AppNotification,
} from '@/types'

/**
 * Serviço de Chat da Equipe Blink Biotech (PocketBase)
 */

export interface CreateConversaInput {
  tipo: 'direta' | 'grupo'
  titulo?: string
  participantes: string[]
  criador_id: string
  context?: ChatContextPayload
  mensagemInicial?: string
}

export interface SendMensagemInput {
  conversa_id: string
  autor_id: string
  autor_nome?: string
  texto: string
  context?: ChatContextPayload
}

export const chatService = {
  /**
   * Lista todas as conversas do usuário logado
   */
  async listConversas(userId: string): Promise<ChatConversa[]> {
    try {
      const records = await pb.collection('conversas').getFullList<ChatConversa>({
        filter: `participantes ~ "${userId}" || criador_id = "${userId}"`,
        sort: '-ultima_mensagem_data,-created',
        expand: 'participantes,criador_id',
      })
      return records
    } catch (err) {
      console.error('[chatService] Erro ao listar conversas:', err)
      throw err
    }
  },

  /**
   * Obtém conversa por id
   */
  async getConversa(conversaId: string): Promise<ChatConversa> {
    try {
      return await pb.collection('conversas').getOne<ChatConversa>(conversaId, {
        expand: 'participantes,criador_id',
      })
    } catch (err) {
      console.error('[chatService] Erro ao buscar conversa:', err)
      throw err
    }
  },

  /**
   * Cria ou localiza conversa direta entre dois usuários
   */
  async getOrCreateDirectConversa(
    currentUserId: string,
    otherUserId: string,
    otherUserName?: string,
  ): Promise<ChatConversa> {
    try {
      // Procura se já existe conversa direta entre os dois
      const existing = await pb.collection('conversas').getFullList<ChatConversa>({
        filter: `tipo = "direta" && participantes ~ "${currentUserId}" && participantes ~ "${otherUserId}"`,
        sort: '-created',
        limit: 1,
        expand: 'participantes,criador_id',
      })

      if (existing.length > 0) {
        return existing[0]
      }

      // Cria conversa direta
      const created = await pb.collection('conversas').create<ChatConversa>({
        tipo: 'direta',
        titulo: otherUserName || 'Conversa Direta',
        participantes: [currentUserId, otherUserId],
        criador_id: currentUserId,
        ultima_mensagem_texto: '',
        ultima_mensagem_data: new Date().toISOString(),
      })

      return await pb.collection('conversas').getOne<ChatConversa>(created.id, {
        expand: 'participantes,criador_id',
      })
    } catch (err) {
      console.error('[chatService] Erro ao obter/criar conversa direta:', err)
      throw err
    }
  },

  /**
   * Cria uma conversa de grupo ou com contexto
   */
  async createConversa(input: CreateConversaInput): Promise<ChatConversa> {
    try {
      const distinctParticipants = Array.from(
        new Set([...input.participantes, input.criador_id].filter(Boolean)),
      )

      const payload: Record<string, unknown> = {
        tipo: input.tipo,
        titulo: input.titulo || (input.tipo === 'grupo' ? 'Grupo da Equipe' : 'Conversa'),
        participantes: distinctParticipants,
        criador_id: input.criador_id,
        ultima_mensagem_texto: input.mensagemInicial || '',
        ultima_mensagem_data: new Date().toISOString(),
      }

      if (input.context) {
        if (input.context.context_type) payload.context_type = input.context.context_type
        if (input.context.context_id) payload.context_id = input.context.context_id
        if (input.context.context_titulo) payload.context_titulo = input.context.context_titulo
        if (input.context.context_link) payload.context_link = input.context.context_link
      }

      const created = await pb.collection('conversas').create<ChatConversa>(payload)

      if (input.mensagemInicial && input.mensagemInicial.trim()) {
        await this.sendMensagem({
          conversa_id: created.id,
          autor_id: input.criador_id,
          texto: input.mensagemInicial,
          context: input.context,
        })
      }

      return await pb.collection('conversas').getOne<ChatConversa>(created.id, {
        expand: 'participantes,criador_id',
      })
    } catch (err) {
      console.error('[chatService] Erro ao criar conversa:', err)
      throw err
    }
  },

  /**
   * Lista mensagens de uma conversa com os recibos de leitura
   */
  async listMensagens(conversaId: string, currentUserId: string): Promise<ChatMensagem[]> {
    try {
      const [messages, leituras] = await Promise.all([
        pb.collection('mensagens').getFullList<ChatMensagem>({
          filter: `conversa_id = "${conversaId}"`,
          sort: 'created',
          expand: 'autor_id',
        }),
        pb.collection('leituras_mensagens').getFullList<ChatLeituraMensagem>({
          filter: `conversa_id = "${conversaId}"`,
        }),
      ])

      const myReadMessageIds = new Set<string>()
      const readCountsMap = new Map<string, number>()

      for (const l of leituras) {
        if (l.user_id === currentUserId) {
          myReadMessageIds.add(l.mensagem_id)
        }
        readCountsMap.set(l.mensagem_id, (readCountsMap.get(l.mensagem_id) || 0) + 1)
      }

      return messages.map((m) => {
        const isOwn = m.autor_id === currentUserId
        // Se a mensagem foi escrita por mim, consideramos visualizada por outros quando readCount > 0 (ou seja, alguém já leu)
        const hasOthersRead = (readCountsMap.get(m.id) || 0) > 0
        const isReadByMe = isOwn || myReadMessageIds.has(m.id)

        return {
          ...m,
          isReadByMe,
          readCount: readCountsMap.get(m.id) || 0,
        }
      })
    } catch (err) {
      console.error('[chatService] Erro ao listar mensagens:', err)
      throw err
    }
  },

  /**
   * Envia uma mensagem e gera notificações para os demais participantes
   */
  async sendMensagem(input: SendMensagemInput): Promise<ChatMensagem> {
    try {
      const payload: Record<string, unknown> = {
        conversa_id: input.conversa_id,
        autor_id: input.autor_id,
        autor_nome: input.autor_nome || '',
        texto: input.texto.trim(),
      }

      if (input.context) {
        if (input.context.context_type) payload.context_type = input.context.context_type
        if (input.context.context_id) payload.context_id = input.context.context_id
        if (input.context.context_titulo) payload.context_titulo = input.context.context_titulo
        if (input.context.context_link) payload.context_link = input.context.context_link
        if (input.context.context_extra) payload.context_extra = input.context.context_extra
      }

      const msg = await pb.collection('mensagens').create<ChatMensagem>(payload)

      // Atualiza a conversa com a última mensagem
      const snippet = input.texto.length > 90 ? `${input.texto.substring(0, 90)}...` : input.texto
      try {
        await pb.collection('conversas').update(input.conversa_id, {
          ultima_mensagem_texto: snippet,
          ultima_mensagem_data: new Date().toISOString(),
        })
      } catch (upErr) {
        console.warn('[chatService] Aviso ao atualizar conversa:', upErr)
      }

      // Cria recibo de leitura do autor automaticamente
      try {
        await pb.collection('leituras_mensagens').create({
          mensagem_id: msg.id,
          conversa_id: input.conversa_id,
          user_id: input.autor_id,
          lida_em: new Date().toISOString(),
        })
      } catch {
        // Ignora caso de idempotência
      }

      // Notifica os outros participantes criando registro em `notifications`
      try {
        const conversa = await pb.collection('conversas').getOne<ChatConversa>(input.conversa_id)
        const participants = Array.isArray(conversa.participantes)
          ? conversa.participantes
          : conversa.participantes
            ? [conversa.participantes]
            : []

        const otherParticipants = participants.filter((p) => p !== input.autor_id)

        const notifTitle = input.autor_nome
          ? `Nova mensagem de ${input.autor_nome}`
          : 'Nova mensagem no Chat'

        const link = input.context?.context_link || `/mensagens?conversa=${input.conversa_id}`

        for (const recipientId of otherParticipants) {
          try {
            await pb.collection('notifications').create({
              userId: recipientId,
              title: notifTitle,
              message: snippet,
              type: 'info',
              isRead: false,
              read: false,
              context_type: input.context?.context_type || 'chat',
              context_id: msg.id,
              context_link: link,
            })
          } catch (notifErr) {
            console.warn('[chatService] Falha ao criar notificação para participante:', notifErr)
          }
        }
      } catch (convErr) {
        console.warn('[chatService] Falha ao recuperar participantes para notificação:', convErr)
      }

      return msg
    } catch (err) {
      console.error('[chatService] Erro ao enviar mensagem:', err)
      throw err
    }
  },

  /**
   * Marca uma mensagem específica como lida pelo usuário logado (persistência no banco)
   */
  async markMessageAsRead(
    mensagemId: string,
    conversaId: string,
    userId: string,
  ): Promise<ChatLeituraMensagem | null> {
    try {
      const existing = await pb.collection('leituras_mensagens').getFullList<ChatLeituraMensagem>({
        filter: `mensagem_id = "${mensagemId}" && user_id = "${userId}"`,
        limit: 1,
      })

      if (existing.length > 0) {
        return existing[0]
      }

      return await pb.collection('leituras_mensagens').create<ChatLeituraMensagem>({
        mensagem_id: mensagemId,
        conversa_id: conversaId,
        user_id: userId,
        lida_em: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[chatService] Erro ao marcar mensagem como lida:', err)
      return null
    }
  },

  /**
   * Marca todas as mensagens de uma conversa como lidas pelo usuário logado
   */
  async markConversaAsRead(conversaId: string, userId: string): Promise<void> {
    try {
      const unreadMessages = await pb.collection('mensagens').getFullList<ChatMensagem>({
        filter: `conversa_id = "${conversaId}" && autor_id != "${userId}"`,
      })

      if (unreadMessages.length === 0) return

      const existingLeituras = await pb
        .collection('leituras_mensagens')
        .getFullList<ChatLeituraMensagem>({
          filter: `conversa_id = "${conversaId}" && user_id = "${userId}"`,
        })

      const alreadyReadIds = new Set(existingLeituras.map((l) => l.mensagem_id))

      const promises = unreadMessages
        .filter((m) => !alreadyReadIds.has(m.id))
        .map((m) =>
          pb
            .collection('leituras_mensagens')
            .create({
              mensagem_id: m.id,
              conversa_id: conversaId,
              user_id: userId,
              lida_em: new Date().toISOString(),
            })
            .catch(() => null),
        )

      await Promise.all(promises)
    } catch (err) {
      console.error('[chatService] Erro ao marcar conversa como lida:', err)
    }
  },

  /**
   * Conta o total de mensagens não lidas pelo usuário em todas as suas conversas
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const conversas = await this.listConversas(userId)
      if (conversas.length === 0) return 0

      const conversaIds = conversas.map((c) => c.id)
      const conversaFilter = conversaIds.map((id) => `conversa_id = "${id}"`).join(' || ')

      const [messages, leituras] = await Promise.all([
        pb.collection('mensagens').getFullList<ChatMensagem>({
          filter: `(${conversaFilter}) && autor_id != "${userId}"`,
          fields: 'id,conversa_id,autor_id',
        }),
        pb.collection('leituras_mensagens').getFullList<ChatLeituraMensagem>({
          filter: `user_id = "${userId}"`,
          fields: 'mensagem_id',
        }),
      ])

      const readSet = new Set(leituras.map((l) => l.mensagem_id))
      let unread = 0
      for (const m of messages) {
        if (!readSet.has(m.id)) {
          unread++
        }
      }

      return unread
    } catch (err) {
      console.warn('[chatService] Falha ao calcular unreadCount:', err)
      return 0
    }
  },

  /**
   * Marca todas as notificações do usuário como lidas
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const notifs = await pb.collection('notifications').getFullList<AppNotification>({
        filter: `(userId = "${userId}" || userId = "") && isRead = false`,
      })

      const updates = notifs.map((n) =>
        pb.collection('notifications').update(n.id, { isRead: true, read: true }),
      )
      await Promise.all(updates)
    } catch (err) {
      console.error('[chatService] Erro ao marcar todas notificações como lidas:', err)
      throw err
    }
  },
}
