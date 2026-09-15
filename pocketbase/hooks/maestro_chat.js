/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints HTTP para o agente nativo MAESTRO de Relatórios de Vendas
 */

routerAdd(
  'POST',
  '/backend/v1/maestro/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      if (!message) {
        return e.badRequestError('message is required')
      }

      const agent = $ai.agent('maestro-relatorio-vendas')
      const result = agent.chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message,
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations || [],
        message_id: result.message_id,
      })
    } catch (err) {
      $app.logger().error('maestro_chat: error', 'error', String(err))
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Não foi possível comunicar com o agente MAESTRO' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'IA temporariamente indisponível' : err.message,
        })
      }
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/maestro/chat-stream',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      if (!message) {
        return e.badRequestError('message is required')
      }

      const agent = $ai.agent('maestro-relatorio-vendas')
      const conv = agent.getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id || null,
        title: 'Relatório de Vendas MAESTRO',
      })

      const iter = agent.chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)

      $response.stream(e, iter)
    } catch (err) {
      $app.logger().error('maestro_chat_stream: error', 'error', String(err))
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'IA temporariamente indisponível' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Não foi possível comunicar com o agente MAESTRO' : err.message,
        })
      }
      return e.json(500, { error: 'Erro inesperado ao iniciar conversa: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/maestro/conversations/{conversationId}/messages',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const conversationId = e.request.pathValue('conversationId')
      if (!conversationId) return e.badRequestError('conversationId required')

      const agent = $ai.agent('maestro-relatorio-vendas')
      const messages = agent.listMessages({
        conversation_id: conversationId,
        user_id: userId,
        limit: 100,
      })

      return e.json(200, { messages: messages || [] })
    } catch (err) {
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Não foi possível carregar as mensagens' : err.message,
        })
      }
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
