routerAdd('POST', '/backend/v1/confirmar-whatsapp', (e) => {
  try {
    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }

    var evolutionUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (evolutionUrl && evolutionUrl.charAt(evolutionUrl.length - 1) === '/') {
      evolutionUrl = evolutionUrl.slice(0, -1)
    }
    var evolutionKey = $secrets.get('EVOLUTION_API_KEY') || ''
    var pbUrl = $secrets.get('PB_INSTANCE_URL') || ''
    var superuserToken = $secrets.get('PB_SUPERUSER_TOKEN') || ''

    var isInitiation = !!body.interpretacao
    var from = body.from || ''
    var instance = body.instance || ''
    var mensagem = body.mensagem || ''

    if (!isInitiation && !mensagem) {
      var data = body.data || body
      var msg = data.message || body.message || {}
      var key = data.key || body.key || {}
      if (msg.conversation) {
        mensagem = msg.conversation
      } else if (msg.extendedTextMessage && msg.extendedTextMessage.text) {
        mensagem = msg.extendedTextMessage.text
      }
      if (!from) from = key.remoteJid || key.from || data.from || body.from || ''
      if (!instance) instance = body.instance || data.instance || ''
      if (from) from = String(from).replace(/@.*$/, '')
    }

    if (isInitiation) {
      var interpretacao = body.interpretacao || {}
      var audioTranscrito = body.audio_transcrito || ''
      if (!from) from = body.from || ''

      var confianca = typeof interpretacao.confianca === 'number' ? interpretacao.confianca : 0
      var clienteNome =
        interpretacao.cliente && interpretacao.cliente.nome ? interpretacao.cliente.nome : ''
      var tipoAtividade = interpretacao.tipo_atividade || ''

      if (confianca >= 0.8 && clienteNome && tipoAtividade) {
        return e.json(200, {
          status: 'nao_necessita_confirmacao',
          message: 'confidence is high enough',
        })
      }

      var col = $app.findCollectionByNameOrId('confirmacoes_pendentes')
      var record = new Record(col)
      record.set('from', from)
      record.set('json_interpretacao', JSON.stringify(interpretacao))
      record.set('audio_transcrito', audioTranscrito)
      record.set('status', 'pending')
      $app.save(record)

      var valorStr =
        typeof interpretacao.valor_estimado === 'number'
          ? String(interpretacao.valor_estimado).replace('.', ',')
          : '0,00'
      var confirmText =
        'Confirma a atividade? Cliente: ' +
        clienteNome +
        ' | Tipo: ' +
        tipoAtividade +
        ' | Valor: R$ ' +
        valorStr +
        ' | Próximo passo: ' +
        (interpretacao.proximo_passo || '') +
        '.\nResponda SIM para confirmar ou digite a correção.'

      if (evolutionUrl && instance) {
        try {
          $http.send({
            url: evolutionUrl + '/message/sendText/' + instance,
            method: 'POST',
            headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: from, text: confirmText }),
            timeout: 30,
          })
        } catch (sendErr) {
          $app
            .logger()
            .error(
              'confirmar-whatsapp: failed to send confirmation message',
              'error',
              String(sendErr),
            )
        }
      }

      return e.json(200, { status: 'aguardando_confirmacao', from: from, pending_id: record.id })
    }

    if (!from) {
      return e.json(400, { status: 'erro', error: 'from is required' })
    }

    var pendingRecord = null
    try {
      var pendingRecords = $app.findRecordsByFilter(
        'confirmacoes_pendentes',
        'from = {:f}',
        '-created',
        50,
        0,
        { f: from },
      )
      for (var pi = 0; pi < pendingRecords.length; pi++) {
        if (pendingRecords[pi].getString('status') === 'pending') {
          pendingRecord = pendingRecords[pi]
          break
        }
      }
    } catch (_) {}

    if (!pendingRecord) {
      return e.json(200, {
        status: 'sem_pendencia',
        message: 'no pending confirmation for this number',
      })
    }

    var storedRaw = pendingRecord.get('json_interpretacao')
    var storedInterpretacao = {}
    if (typeof storedRaw === 'string') {
      try {
        storedInterpretacao = JSON.parse(storedRaw)
      } catch (_) {}
    } else if (storedRaw && typeof storedRaw === 'object') {
      storedInterpretacao = storedRaw
    }
    var storedAudioTranscrito = pendingRecord.getString('audio_transcrito') || ''
    var replyText = String(mensagem || '').trim()

    function callGravarAtividade(interp, audioTxt) {
      if (!pbUrl || !superuserToken) {
        $app.logger().error('confirmar-whatsapp: missing PB URL or token')
        return null
      }
      try {
        var payload = {
          cliente: interp.cliente || {},
          vendedor: interp.vendedor || '',
          tipo_atividade: interp.tipo_atividade || '',
          etapa_funil: interp.etapa_funil || '',
          valor_estimado: typeof interp.valor_estimado === 'number' ? interp.valor_estimado : 0,
          descricao: interp.descricao || '',
          proximo_passo: interp.proximo_passo || '',
          data_proxima_acao: interp.data_proxima_acao || '',
          pendencias: interp.pendencias || '',
          observacoes: interp.observacoes || '',
          confianca: typeof interp.confianca === 'number' ? interp.confianca : 0,
          audio_transcrito: audioTxt || '',
          origem: 'audio',
        }
        var res = $http.send({
          url: pbUrl + '/backend/v1/validar-e-gravar',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: superuserToken },
          body: JSON.stringify(payload),
          timeout: 30,
        })
        if (res.statusCode < 200 || res.statusCode >= 300) {
          $app
            .logger()
            .error('confirmar-whatsapp: gravar-atividade failed', 'statusCode', res.statusCode)
          return null
        }
        return res.json || {}
      } catch (err) {
        $app.logger().error('confirmar-whatsapp: gravar-atividade error', 'error', String(err))
        return null
      }
    }

    function sendWhatsAppMessage(number, text) {
      if (!evolutionUrl || !instance) {
        $app.logger().error('confirmar-whatsapp: cannot send WhatsApp message, missing config')
        return
      }
      try {
        $http.send({
          url: evolutionUrl + '/message/sendText/' + instance,
          method: 'POST',
          headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: number, text: text }),
          timeout: 30,
        })
      } catch (err) {
        $app.logger().error('confirmar-whatsapp: WhatsApp send error', 'error', String(err))
      }
    }

    if (replyText.toUpperCase() === 'SIM') {
      var gravarResult = callGravarAtividade(storedInterpretacao, storedAudioTranscrito)
      if (gravarResult && gravarResult.success !== false && !gravarResult.precisa_confirmacao) {
        pendingRecord.set('status', 'confirmed')
        $app.save(pendingRecord)
        sendWhatsAppMessage(from, '✅ Atividade registrada com sucesso no CRM Blink.')
        return e.json(200, { status: 'confirmado', from: from })
      } else {
        $app.logger().error('confirmar-whatsapp: gravar-atividade failed on SIM')
        return e.json(500, { status: 'erro', error: 'failed to record activity' })
      }
    }

    var correctedText = storedAudioTranscrito + '\nCorreção: ' + replyText

    var prompt =
      'Você é um assistente de CRM especializado em produção de gado de corte.\n' +
      'Interprete o áudio transcrito de um vendedor e extraia os dados em JSON.\n' +
      'Não invente dados que não foram ditos. Se um campo não foi mencionado, use null.\n' +
      'Retorne SOMENTE o JSON, sem texto adicional.\n\n' +
      'SCHEMA:\n' +
      '{\n  cliente: { nome, cnpj, cidade, estado },\n  vendedor: nome,\n' +
      '  tipo_atividade: visita|ligacao|proposta|follow_up|reuniao|outro,\n' +
      '  etapa_funil: prospeccao|qualificacao|proposta|fechamento|pos_venda,\n' +
      '  valor_estimado: numero em reais,\n  descricao: resumo conciso,\n' +
      '  proximo_passo: proxima acao,\n  data_proxima_acao: AAAA-MM-DD,\n' +
      '  pendencias: [lista],\n  observacoes: texto,\n  confianca: numero de 0 a 1\n}\n\n' +
      'ÁUDIO TRANSCRITO: [' +
      correctedText +
      ']'

    var aiReply
    try {
      aiReply = $ai.chat({
        model: 'reasoning',
        messages: [
          {
            role: 'system',
            content:
              'Setor: produção de gado de corte (recria, engorda, confinamento, terminação). Empresa: Blink Biotech (soluções biotech).',
          },
          { role: 'user', content: prompt },
        ],
      })
    } catch (aiErr) {
      $app.logger().error('confirmar-whatsapp: re-interpretation AI error', 'error', String(aiErr))
      return e.json(502, { status: 'erro', error: 're-interpretation failed' })
    }

    var rawContent = ''
    try {
      rawContent = aiReply.choices[0].message.content || ''
    } catch (_) {
      rawContent = ''
    }

    var jsonStr = rawContent.trim()
    var firstBrace = jsonStr.indexOf('{')
    var lastBrace = jsonStr.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
    }

    var updatedInterpretacao = null
    try {
      updatedInterpretacao = JSON.parse(jsonStr)
    } catch (parseErr) {
      $app
        .logger()
        .error('confirmar-whatsapp: failed to parse re-interpreted JSON', 'error', String(parseErr))
      sendWhatsAppMessage(from, 'Não consegui interpretar a correção. Pode repetir?')
      return e.json(502, { status: 'erro', error: 'failed to parse re-interpreted JSON' })
    }

    var newConfianca =
      typeof updatedInterpretacao.confianca === 'number' ? updatedInterpretacao.confianca : 0
    var newClienteNome =
      updatedInterpretacao.cliente && updatedInterpretacao.cliente.nome
        ? updatedInterpretacao.cliente.nome
        : ''
    var newTipoAtividade = updatedInterpretacao.tipo_atividade || ''

    if (newConfianca >= 0.8 && newClienteNome && newTipoAtividade) {
      var gravarResult2 = callGravarAtividade(updatedInterpretacao, correctedText)
      if (gravarResult2 && gravarResult2.success !== false && !gravarResult2.precisa_confirmacao) {
        pendingRecord.set('status', 'corrected')
        pendingRecord.set('json_interpretacao', JSON.stringify(updatedInterpretacao))
        pendingRecord.set('audio_transcrito', correctedText)
        $app.save(pendingRecord)
        sendWhatsAppMessage(from, '✅ Atividade registrada com sucesso no CRM Blink.')
        return e.json(200, { status: 'corrigido_e_registrado', from: from })
      } else {
        $app.logger().error('confirmar-whatsapp: gravar-atividade failed on correction')
        return e.json(500, { status: 'erro', error: 'failed to record activity' })
      }
    }

    pendingRecord.set('json_interpretacao', JSON.stringify(updatedInterpretacao))
    pendingRecord.set('audio_transcrito', correctedText)
    $app.save(pendingRecord)

    var valorStr2 =
      typeof updatedInterpretacao.valor_estimado === 'number'
        ? String(updatedInterpretacao.valor_estimado).replace('.', ',')
        : '0,00'
    var confirmText2 =
      'Confirma a atividade? Cliente: ' +
      newClienteNome +
      ' | Tipo: ' +
      newTipoAtividade +
      ' | Valor: R$ ' +
      valorStr2 +
      ' | Próximo passo: ' +
      (updatedInterpretacao.proximo_passo || '') +
      '.\nResponda SIM para confirmar ou digite a correção.'
    sendWhatsAppMessage(from, confirmText2)

    return e.json(200, { status: 'ainda_aguardando_confirmacao', from: from })
  } catch (err) {
    if (err instanceof SkipAiConfigError) {
      return e.json(503, { status: 'erro', error: 'AI service not configured' })
    }
    if (err instanceof SkipAiError) {
      return e.json(502, { status: 'erro', error: 'AI request failed' })
    }
    $app.logger().error('confirmar-whatsapp: unexpected error', 'error', String(err))
    return e.json(500, { status: 'erro', error: 'unexpected error' })
  }
})
