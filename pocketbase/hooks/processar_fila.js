/// <reference path="../pb_data/types.d.ts" />

/**
 * Processa a fila de mensagens do WhatsApp (áudio e texto) — MULTIUSUÁRIO.
 *
 * Fluxo:
 * 1. Pega até 3 itens `aguardando` (áudio ou texto).
 * 2. Áudio: baixa da Evolution e transcreve no Whisper. Texto: usa direto.
 * 3. Classifica a INTENÇÃO da mensagem (`$ai.chat`) e, conforme ela:
 *    - registrar_atividade → grava cliente + atividade + plano de ação (validar-e-gravar)
 *    - cadastrar_cliente   → cria/atualiza a fábrica como Prospecto
 *    - conversar           → responde em linguagem natural com o contexto do vendedor
 *    - criar_proposta      → avisa que o gerador de proposta ainda não está disponível
 * 4. Responde sempre no WhatsApp do remetente.
 *
 * O vendedor vem do payload (resolvido pelo webhook pelo telefone), nunca mais do admin.
 */

cronAdd('processar_fila_audio', '* * * * *', () => {
  var pbUrl = $secrets.get('PB_INSTANCE_URL') || ''
  var superuserToken = $secrets.get('PB_SUPERUSER_TOKEN') || ''
  var evolutionUrl = $secrets.get('EVOLUTION_API_URL') || ''
  if (evolutionUrl && evolutionUrl.charAt(evolutionUrl.length - 1) === '/') {
    evolutionUrl = evolutionUrl.slice(0, evolutionUrl.length - 1)
  }
  var evolutionKey = $secrets.get('EVOLUTION_API_KEY') || ''
  var openaiApiKey = $secrets.get('OPENAI_API_KEY') || ''

  function sendText(number, instance, text) {
    if (!evolutionUrl || !instance) {
      $app.logger().warn('processar_fila: sem Evolution configurada, resposta nao enviada')
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
      $app.logger().warn('processar_fila: falha ao enviar resposta', 'error', String(err))
    }
  }

  // ---- Recupera itens travados em "processando" por mais de 5 min ----
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
      var textoDireto = payload.texto || ''
      var from = payload.from || ''
      var mimeType = payload.mimeType || 'audio/ogg'
      var instance = payload.instance || ''
      var vendedorId = payload.vendedor_id || ''
      var vendedorNome = payload.vendedor_nome || ''

      if (!vendedorId) throw new Error('payload sem vendedor_id (telefone nao identificado)')
      if (!mediaUrl && !textoDireto) throw new Error('payload sem audio nem texto')

      // ---- 1. Obter o texto: transcrição do áudio ou o texto digitado ----
      var conteudo = textoDireto
      var veioDeAudio = false

      if (mediaUrl) {
        if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured')
        var dlHeaders = {}
        if (evolutionKey) dlHeaders['apikey'] = evolutionKey
        var dlRes = $http.send({ url: mediaUrl, method: 'GET', headers: dlHeaders, timeout: 30 })
        if (dlRes.statusCode !== 200) throw new Error('Audio download failed: ' + dlRes.statusCode)
        var audioBytes = dlRes.body

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
          'Content-Disposition: form-data; name="language"\r\n\r\npt\r\n' +
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
          timeout: 90,
        })
        if (transcribeRes.statusCode !== 200)
          throw new Error('Transcription failed: ' + transcribeRes.statusCode)
        conteudo = ((transcribeRes.json || {}).text || '').trim()
        veioDeAudio = true
      }

      if (!conteudo) throw new Error('conteudo vazio apos transcricao/leitura')

      // ---- 2. Classificar a intenção ----
      var glossary =
        'GLOSSÁRIO DO SETOR:\n' +
        '- Recria: criação de bezerros até a engorda\n' +
        '- Engorda: fase final antes do abate\n' +
        '- Confinamento: engorda intensiva\n' +
        '- Arroba (@): unidade de peso (15 kg de carcaça)\n' +
        '- Premix: mistura de vitaminas e minerais\n' +
        '- Núcleo: concentrado proteico-mineral\n' +
        '- Carteira: AVES | PETS | RUMINANTES | SUINOS | AQUA\n' +
        '- Grupo de cliente: Indústrias | Distribuidores Diretos | Produtores Diretos | Premixeras | Cooperativas\n'

      var intentPrompt =
        'Você é o assistente de campo da Blink Biotech (nutrição animal) dentro do CRM Blink Bunker.\n' +
        'Um vendedor mandou a mensagem abaixo por WhatsApp. Classifique a INTENÇÃO e extraia os dados.\n' +
        'Não invente dados: campo não mencionado = null. Retorne SOMENTE um JSON válido.\n\n' +
        glossary +
        '\nINTENÇÕES POSSÍVEIS:\n' +
        '- "registrar_atividade": relato de visita, ligação, reunião, proposta enviada, pedido ou follow-up a um cliente já existente. É o caso mais comum.\n' +
        '- "cadastrar_cliente": o vendedor quer CADASTRAR uma fábrica/cliente novo no CRM.\n' +
        '- "criar_proposta": pedido para montar proposta comercial ou orçamento.\n' +
        '- "conversar": pergunta, dúvida, saudação, pedido de informação ou qualquer coisa que não seja registro.\n\n' +
        'SCHEMA DE SAÍDA:\n' +
        '{\n' +
        '  "intencao": "registrar_atividade" | "cadastrar_cliente" | "criar_proposta" | "conversar",\n' +
        '  "cliente": { "nome": string|null, "cnpj": string|null, "cidade": string|null, "estado": string|null },\n' +
        '  "carteira": string|null,\n' +
        '  "grupo_cliente": string|null,\n' +
        '  "tipo_atividade": "visita"|"ligacao"|"proposta"|"follow_up"|"reuniao"|"pedido"|"outro"|null,\n' +
        '  "etapa_funil": "prospeccao"|"qualificacao"|"proposta"|"fechamento"|"pos_venda"|null,\n' +
        '  "valor_estimado": number|null,\n' +
        '  "descricao": string|null,\n' +
        '  "proximo_passo": string|null,\n' +
        '  "data_proxima_acao": "AAAA-MM-DD"|null,\n' +
        '  "pendencias": [string]|null,\n' +
        '  "confianca": number\n' +
        '}\n\n' +
        'MENSAGEM DO VENDEDOR [' +
        vendedorNome +
        ']: [' +
        conteudo +
        ']'

      var aiReply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Setor: produção de gado de corte e nutrição animal. Empresa: Blink Biotech. ' +
              'Você interpreta mensagens curtas de vendedores em campo e devolve JSON estrito.',
          },
          { role: 'user', content: intentPrompt },
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
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
      }
      var parsed = JSON.parse(jsonStr)

      var intencao = parsed.intencao || 'registrar_atividade'
      var clienteNome = (parsed.cliente && parsed.cliente.nome) || ''
      var confianca = typeof parsed.confianca === 'number' ? parsed.confianca : 0

      // ---- 3. Executar conforme a intenção ----

      if (intencao === 'conversar') {
        var chatReply = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é o assistente comercial da Blink Biotech no WhatsApp do vendedor ' +
                vendedorNome +
                '. Responda em português do Brasil, de forma curta e útil (máximo 5 linhas), ' +
                'sem markdown. Você ajuda com: registrar visita, cadastrar fábrica, consultar carteira, ' +
                'próximos passos. Se pedirem algo que você não faz, diga o que é possível.',
            },
            { role: 'user', content: conteudo },
          ],
        })
        var chatText = ''
        try {
          chatText = chatReply.choices[0].message.content || ''
        } catch (_) {}
        sendText(from, instance, chatText || 'Não consegui responder agora. Tente de novo.')

        var okItem1 = $app.findRecordById('fila_processamento', itemId)
        okItem1.set('status', 'sucesso')
        $app.save(okItem1)
        continue
      }

      if (intencao === 'criar_proposta') {
        sendText(
          from,
          instance,
          'O gerador de propostas ainda não está disponível no Blink Bunker.\n' +
            'Por enquanto consigo registrar a atividade e o valor estimado no CRM. ' +
            'Se quiser, me mande os dados e eu registro como proposta enviada.',
        )
        var okItem2 = $app.findRecordById('fila_processamento', itemId)
        okItem2.set('status', 'sucesso')
        $app.save(okItem2)
        continue
      }

      // cadastrar_cliente e registrar_atividade usam o mesmo gravador:
      // ele cria a fábrica se não existir, atualiza se existir e grava a atividade.
      var tipoAtividade = parsed.tipo_atividade || (intencao === 'cadastrar_cliente' ? 'outro' : '')
      var etapaFunil = parsed.etapa_funil || (intencao === 'cadastrar_cliente' ? 'prospeccao' : '')

      var precisaConfirmar =
        !clienteNome ||
        !tipoAtividade ||
        !etapaFunil ||
        (intencao === 'registrar_atividade' && confianca < 0.75)

      if (precisaConfirmar) {
        var pendCol = $app.findCollectionByNameOrId('confirmacoes_pendentes')
        var pendRec = new Record(pendCol)
        pendRec.set('from', from)
        pendRec.set('json_interpretacao', JSON.stringify(parsed))
        pendRec.set('audio_transcrito', conteudo)
        pendRec.set('status', 'pending')
        $app.save(pendRec)

        var resumoPend =
          'Entendi assim:\n' +
          'Cliente: ' +
          (clienteNome || '(não identificado)') +
          '\n' +
          'Ação: ' +
          (tipoAtividade || '(não identificada)') +
          '\n' +
          'Etapa: ' +
          (etapaFunil || '-') +
          '\n' +
          'Valor: R$ ' +
          (typeof parsed.valor_estimado === 'number' ? parsed.valor_estimado : 0) +
          '\n' +
          'Próximo passo: ' +
          (parsed.proximo_passo || '-') +
          '\n\n' +
          'Responda SIM para registrar ou escreva a correção.'

        sendText(from, instance, resumoPend)

        var okItem3 = $app.findRecordById('fila_processamento', itemId)
        okItem3.set('status', 'sucesso')
        $app.save(okItem3)
        continue
      }

      if (!pbUrl || !superuserToken) throw new Error('PB config missing')

      var writeRes = $http.send({
        url: pbUrl + '/backend/v1/validar-e-gravar',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: superuserToken },
        body: JSON.stringify({
          origem: veioDeAudio ? 'audio' : 'texto',
          cliente: parsed.cliente || {},
          vendedor_id: vendedorId,
          vendedor: vendedorNome,
          tipo_atividade: tipoAtividade,
          etapa_funil: etapaFunil,
          valor_estimado: typeof parsed.valor_estimado === 'number' ? parsed.valor_estimado : 0,
          descricao: parsed.descricao || conteudo.substring(0, 400),
          proximo_passo: parsed.proximo_passo || '',
          data_proxima_acao: parsed.data_proxima_acao || '',
          pendencias: parsed.pendencias || '',
          confianca: confianca,
          audio_transcrito: conteudo,
          carteira: parsed.carteira || '',
          grupo_cliente: parsed.grupo_cliente || '',
        }),
        timeout: 40,
      })

      if (writeRes.statusCode < 200 || writeRes.statusCode >= 300) {
        throw new Error('validar-e-gravar failed: ' + writeRes.statusCode)
      }

      var gravadoId = ''
      var gravadoClienteId = ''
      try {
        var gravadoJson = writeRes.json || {}
        gravadoId = gravadoJson.atividade_id || ''
        gravadoClienteId = gravadoJson.cliente_id || ''
      } catch (_) {}

      // ---- PDF do relatório de visita (melhor esforço) ----
      var pdfLink = ''
      if (gravadoId) {
        try {
          var pdfRes = $http.send({
            url: pbUrl + '/backend/v1/atividade-pdf',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: superuserToken },
            body: JSON.stringify({ atividadeId: gravadoId }),
            timeout: 40,
          })
          if (pdfRes.statusCode >= 200 && pdfRes.statusCode < 300) {
            pdfLink =
              pbUrl +
              '/api/files/atividades/' +
              gravadoId +
              '/relatorio_visita_' +
              gravadoId.substring(0, 8) +
              '.pdf'
          }
        } catch (_) {}
      }

      var confirmMsg =
        'Registrado no Blink Bunker.\n' +
        'Cliente: ' +
        clienteNome +
        '\n' +
        'Tipo: ' +
        tipoAtividade +
        '\n' +
        'Etapa: ' +
        etapaFunil +
        '\n' +
        'Valor: R$ ' +
        (typeof parsed.valor_estimado === 'number' ? parsed.valor_estimado : 0) +
        '\n' +
        'Próximo passo: ' +
        (parsed.proximo_passo || '-')
      if (pdfLink) confirmMsg += '\nRelatório: ' + pdfLink

      sendText(from, instance, confirmMsg)

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
        $app.logger().error('processar_fila: erro no item ' + itemId, 'error', String(err))
      } catch (_) {}
    }
  }
})
