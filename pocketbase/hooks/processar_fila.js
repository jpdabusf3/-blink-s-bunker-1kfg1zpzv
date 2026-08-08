cronAdd('processar_fila_audio', '* * * * *', () => {
  var adminUserId = ''
  try {
    adminUserId = $app.findAuthRecordByEmail('users', 'joaopedro_zoo@hotmail.com').id
  } catch (_) {}

  function logStep(action, details, recordId, targetCollection) {
    if (!adminUserId) return
    try {
      var lc = $app.findCollectionByNameOrId('activity_logs')
      var lr = new Record(lc)
      lr.set('user', adminUserId)
      lr.set('action', action)
      lr.set('details', details || '')
      if (recordId) lr.set('recordId', recordId)
      if (targetCollection) lr.set('target_collection', targetCollection)
      $app.save(lr)
    } catch (_) {}
  }

  try {
    var stuckItems = $app.findRecordsByFilter(
      'fila_processamento',
      'status = "processando"',
      'created',
      20,
      0,
    )
    var nowMs = new Date().getTime()
    for (var si = 0; si < stuckItems.length; si++) {
      var su = stuckItems[si].getString('updated') || ''
      if (su && nowMs - new Date(su).getTime() > 300000) {
        stuckItems[si].set('status', 'aguardando')
        $app.save(stuckItems[si])
      }
    }
  } catch (_) {}

  var pbUrl = $secrets.get('PB_INSTANCE_URL') || ''
  var superuserToken = $secrets.get('PB_SUPERUSER_TOKEN') || ''
  var evolutionUrl = $secrets.get('EVOLUTION_API_URL') || ''
  if (evolutionUrl && evolutionUrl.charAt(evolutionUrl.length - 1) === '/') {
    evolutionUrl = evolutionUrl.slice(0, -1)
  }
  var evolutionKey = $secrets.get('EVOLUTION_API_KEY') || ''
  var openaiApiKey = $secrets.get('OPENAI_API_KEY') || ''

  var items = []
  try {
    items = $app.findRecordsByFilter('fila_processamento', 'status = "aguardando"', 'created', 3, 0)
  } catch (_) {
    return
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    var itemId = item.id
    var tentativas = item.get('tentativas') || 0

    if (tentativas >= 3) {
      item.set('status', 'erro')
      item.set('ultimo_erro', 'Max attempts reached')
      $app.save(item)
      logStep('audio_erro', 'Max tentativas: ' + itemId, itemId, 'fila_processamento')
      continue
    }

    item.set('status', 'processando')
    $app.save(item)

    try {
      var payloadRaw = item.get('payload')
      var payload = {}
      if (typeof payloadRaw === 'string') {
        try {
          payload = JSON.parse(payloadRaw)
        } catch (_) {}
      } else if (payloadRaw && typeof payloadRaw === 'object') {
        payload = payloadRaw
      }

      var mediaUrl = payload.mediaUrl || ''
      var from = payload.from || ''
      var mimeType = payload.mimeType || 'audio/ogg'
      var instance = payload.instance || ''
      if (!mediaUrl) throw new Error('No mediaUrl in payload')

      var dlHeaders = {}
      if (evolutionKey) dlHeaders['apikey'] = evolutionKey
      var dlRes = $http.send({ url: mediaUrl, method: 'GET', headers: dlHeaders, timeout: 30 })
      if (dlRes.statusCode !== 200) throw new Error('Audio download failed: ' + dlRes.statusCode)
      var audioBytes = dlRes.body

      if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured')
      var boundary = '----FormBoundary' + $security.randomString(16)
      var ext = 'ogg'
      if (mimeType.indexOf('mp3') !== -1) ext = 'mp3'
      else if (mimeType.indexOf('wav') !== -1) ext = 'wav'
      else if (mimeType.indexOf('m4a') !== -1) ext = 'm4a'
      else if (mimeType.indexOf('webm') !== -1) ext = 'webm'

      var preBody =
        '--' +
        boundary +
        '\r\n' +
        'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n' +
        '--' +
        boundary +
        '\r\n' +
        'Content-Disposition: form-data; name="language"\r\n\r\npt-BR\r\n' +
        '--' +
        boundary +
        '\r\n' +
        'Content-Disposition: form-data; name="file"; filename="audio.' +
        ext +
        '"\r\n' +
        'Content-Type: ' +
        mimeType +
        '\r\n\r\n'
      var postBody = '\r\n--' + boundary + '--\r\n'
      var fullBody = preBody + audioBytes + postBody

      var transcribeRes = $http.send({
        url: 'https://api.openai.com/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + openaiApiKey,
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
        },
        body: fullBody,
        timeout: 60,
      })
      if (transcribeRes.statusCode !== 200)
        throw new Error('Transcription failed: ' + transcribeRes.statusCode)
      var transcription = (transcribeRes.json || {}).text || ''

      logStep(
        'audio_transcrito',
        'Transcricao (' + transcription.length + ' chars): ' + transcription.substring(0, 200),
        itemId,
        'fila_processamento',
      )

      var prompt =
        'Você é um assistente de CRM especializado em produção de gado de corte e\n' +
        'nutrição animal. Interprete o áudio transcrito de um vendedor e extraia os\n' +
        'dados em JSON. Não invente dados. Se um campo não foi mencionado, use null.\n' +
        'Retorne SOMENTE o JSON.\n\n' +
        'GLOSSÁRIO DO SETOR:\n' +
        '- Recria: criação de bezerros até a engorda\n' +
        '- Engorda: fase final antes do abate\n' +
        '- Confinamento: engorda intensiva com alta densidade\n' +
        '- Terminação: fase final de acabamento\n' +
        '- Arroba (@): unidade de peso (15 kg de carcaça)\n' +
        '- GTA: Guia de Trânsito Animal\n' +
        '- ICMS: imposto sobre circulação de mercadorias\n' +
        '- Premix: mistura de vitaminas e minerais para ração\n' +
        '- Núcleo: concentrado proteico-mineral\n' +
        '- Cabeça: unidade de animal (ex.: lote de 500 cabeças)\n' +
        '- Carteira (AVES/PETS/RUMINANTES/SUINOS/AQUA): segmentos de negócio\n' +
        '- Grupo de cliente: Indústrias/Distribuidores Diretos/Produtores Diretos/\n' +
        '  Premixeras/Cooperativas\n\n' +
        'SCHEMA:\n' +
        '{\n' +
        '  cliente: { nome, cnpj, cidade, estado },\n' +
        '  carteira: AVES|PETS|RUMINANTES|SUINOS|AQUA|null,\n' +
        '  grupo_cliente: Indústrias|Distribuidores Diretos|Produtores Diretos|\n' +
        '    Premixeras|Cooperativas|null,\n' +
        '  vendedor: nome,\n' +
        '  tipo_atividade: visita|ligacao|proposta|follow_up|reuniao|pedido|outro,\n' +
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
        transcription +
        ']'

      var aiReply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Setor: produção de gado de corte e nutrição animal (recria, engorda, confinamento, terminação). Empresa: Blink Biotech (soluções biotech). O vendedor relata atividades diárias: visitas, ligações, propostas, follow-ups e pedidos.',
          },
          { role: 'user', content: prompt },
        ],
      })

      var rawContent = ''
      try {
        rawContent = aiReply.choices[0].message.content || ''
      } catch (_) {}
      if (!rawContent) throw new Error('AI returned empty content')

      var jsonStr = rawContent.trim()
      var firstBrace = jsonStr.indexOf('{')
      var lastBrace = jsonStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
      }
      var parsed = JSON.parse(jsonStr)

      var confianca = typeof parsed.confianca === 'number' ? parsed.confianca : 0
      var clienteNome = parsed.cliente && parsed.cliente.nome ? parsed.cliente.nome : ''
      var tipoAtividade = parsed.tipo_atividade || ''

      logStep(
        'audio_interpretado',
        'Cliente: ' + clienteNome + ' | Confianca: ' + confianca,
        itemId,
        'fila_processamento',
      )

      var hasConflict = false
      if (clienteNome) {
        try {
          var existingClient = $app.findFirstRecordByData('factories', 'name', clienteNome)
          var ultimaEdicao = existingClient.getString('ultima_edicao_origem') || ''
          var updatedStr = existingClient.getString('updated') || ''
          if (ultimaEdicao === 'manual' && updatedStr) {
            if (new Date().getTime() - new Date(updatedStr).getTime() < 300000) hasConflict = true
          }
        } catch (_) {}
      }

      if (confianca >= 0.8 && clienteNome && tipoAtividade && !hasConflict) {
        if (!pbUrl || !superuserToken) throw new Error('PB config missing')

        var writeRes = $http.send({
          url: pbUrl + '/backend/v1/validar-e-gravar',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: superuserToken },
          body: JSON.stringify({
            origem: 'audio',
            cliente: parsed.cliente || {},
            vendedor: parsed.vendedor || '',
            tipo_atividade: tipoAtividade,
            etapa_funil: parsed.etapa_funil || '',
            valor_estimado: typeof parsed.valor_estimado === 'number' ? parsed.valor_estimado : 0,
            descricao: parsed.descricao || '',
            proximo_passo: parsed.proximo_passo || '',
            data_proxima_acao: parsed.data_proxima_acao || '',
            pendencias: parsed.pendencias || '',
            observacoes: parsed.observacoes || '',
            confianca: confianca,
            audio_transcrito: transcription,
            carteira: parsed.carteira || '',
            grupo_cliente: parsed.grupo_cliente || '',
          }),
          timeout: 30,
        })

        if (writeRes.statusCode < 200 || writeRes.statusCode >= 300) {
          throw new Error('validar-e-gravar failed: ' + writeRes.statusCode)
        }

        var valorStr =
          typeof parsed.valor_estimado === 'number'
            ? String(parsed.valor_estimado).replace('.', ',')
            : '0,00'
        var confirmMsg =
          'Atividade registrada no CRM Blink!\n' +
          'Cliente: ' +
          clienteNome +
          '\nTipo: ' +
          tipoAtividade +
          '\n' +
          'Etapa: ' +
          (parsed.etapa_funil || '') +
          '\nValor: R$ ' +
          valorStr +
          '\n' +
          'Proximo passo: ' +
          (parsed.proximo_passo || '')

        if (evolutionUrl && instance && from) {
          try {
            $http.send({
              url: evolutionUrl + '/message/sendText/' + instance,
              method: 'POST',
              headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: from, text: confirmMsg }),
              timeout: 30,
            })
          } catch (_) {}
        }
      } else {
        var pendCol = $app.findCollectionByNameOrId('confirmacoes_pendentes')
        var pendRec = new Record(pendCol)
        pendRec.set('from', from)
        pendRec.set('json_interpretacao', JSON.stringify(parsed))
        pendRec.set('audio_transcrito', transcription)
        pendRec.set('status', 'pending')
        $app.save(pendRec)

        var reason = hasConflict ? 'conflito com edicao manual recente' : 'baixa confianca'
        logStep(
          'audio_aguardando_confirmacao',
          'Roteado para confirmacao (' + reason + '): ' + clienteNome,
          pendRec.id,
          'confirmacoes_pendentes',
        )

        var valorStr2 =
          typeof parsed.valor_estimado === 'number'
            ? String(parsed.valor_estimado).replace('.', ',')
            : '0,00'
        var requestMsg =
          'Confirma a atividade? Cliente: ' +
          clienteNome +
          ' | Tipo: ' +
          tipoAtividade +
          ' | Valor: R$ ' +
          valorStr2 +
          ' | Proximo passo: ' +
          (parsed.proximo_passo || '') +
          '.\nResponda SIM para confirmar ou digite a correcao.'

        if (evolutionUrl && instance && from) {
          try {
            $http.send({
              url: evolutionUrl + '/message/sendText/' + instance,
              method: 'POST',
              headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: from, text: requestMsg }),
              timeout: 30,
            })
          } catch (_) {}
        }
      }

      var successItem = $app.findRecordById('fila_processamento', itemId)
      successItem.set('status', 'sucesso')
      $app.save(successItem)
    } catch (err) {
      try {
        var errItem = $app.findRecordById('fila_processamento', itemId)
        var newTent = (errItem.get('tentativas') || 0) + 1
        errItem.set('tentativas', newTent)
        errItem.set('ultimo_erro', String(err).substring(0, 500))
        errItem.set('status', newTent >= 3 ? 'erro' : 'aguardando')
        $app.save(errItem)
        logStep(
          'audio_erro',
          'Falha: ' + String(err).substring(0, 200),
          itemId,
          'fila_processamento',
        )
      } catch (_) {}
    }
  }
})
