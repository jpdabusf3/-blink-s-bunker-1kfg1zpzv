routerAdd(
  'POST',
  '/backend/v1/interpretar-audio',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}
      var textoTranscrito = body.textoTranscrito || body.texto || ''

      if (!textoTranscrito || !textoTranscrito.trim()) {
        return e.badRequestError('textoTranscrito is required')
      }

      var prompt =
        'Você é um assistente de CRM especializado em produção de gado de corte.\n' +
        'Interprete o áudio transcrito de um vendedor e extraia os dados em JSON.\n' +
        'Não invente dados que não foram ditos. Se um campo não foi mencionado, use null.\n' +
        'Retorne SOMENTE o JSON, sem texto adicional.\n\n' +
        'SCHEMA:\n' +
        '{\n' +
        '  cliente: { nome, cnpj, cidade, estado },\n' +
        '  vendedor: nome,\n' +
        '  tipo_atividade: visita|ligacao|proposta|follow_up|reuniao|outro,\n' +
        '  etapa_funil: prospeccao|qualificacao|proposta|fechamento|pos_venda,\n' +
        '  valor_estimado: numero em reais,\n' +
        '  descricao: resumo conciso,\n' +
        '  proximo_passo: proxima acao,\n' +
        '  data_proxima_acao: AAAA-MM-DD,\n' +
        '  pendencias: [lista],\n' +
        '  observacoes: texto,\n' +
        '  confianca: numero de 0 a 1\n' +
        '}\n\n' +
        'ÁUDIO TRANSCRITO: [' +
        textoTranscrito +
        ']'

      var aiReply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Setor: produção de gado de corte (recria, engorda, confinamento, terminação). Empresa: Blink Biotech (soluções biotech). O vendedor relata atividades diárias: visitas, ligações, propostas e follow-ups.',
          },
          { role: 'user', content: prompt },
        ],
      })

      var rawContent = ''
      try {
        rawContent = aiReply.choices[0].message.content || ''
      } catch (_) {
        rawContent = ''
      }

      if (!rawContent) {
        $app.logger().error('interpretar-audio: AI returned empty content')
        return e.json(502, { status: 'erro', error: 'AI returned empty content' })
      }

      var jsonStr = rawContent.trim()

      var firstBrace = jsonStr.indexOf('{')
      var lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
      }

      var parsed = null
      try {
        parsed = JSON.parse(jsonStr)
      } catch (parseErr) {
        $app
          .logger()
          .error(
            'interpretar-audio: failed to parse AI JSON',
            'error',
            String(parseErr),
            'raw',
            rawContent.substring(0, 500),
          )
        return e.json(502, { status: 'erro', error: 'failed to parse AI response' })
      }

      var confianca = typeof parsed.confianca === 'number' ? parsed.confianca : 0
      var clienteNome = parsed.cliente && parsed.cliente.nome ? parsed.cliente.nome : ''
      var tipoAtividade = parsed.tipo_atividade ? parsed.tipo_atividade : ''

      if (confianca < 0.8 || !clienteNome || !tipoAtividade) {
        return e.json(200, { precisa_confirmacao: true })
      }

      return e.json(200, parsed)
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        $app.logger().error('interpretar-audio: AI not configured', 'error', String(err))
        return e.json(503, { status: 'erro', error: 'AI service not configured' })
      }
      if (err instanceof SkipAiError) {
        $app.logger().error('interpretar-audio: AI request failed', 'error', String(err))
        var aiStatus = err.status || 502
        return e.json(aiStatus >= 500 ? 502 : aiStatus, {
          status: 'erro',
          error: 'AI request failed',
        })
      }
      $app.logger().error('interpretar-audio: unexpected error', 'error', String(err))
      return e.json(500, { status: 'erro', error: 'unexpected error' })
    }
  },
  $apis.requireAuth(),
)
