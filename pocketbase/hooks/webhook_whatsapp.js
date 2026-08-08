routerAdd('POST', '/backend/v1/webhook-whatsapp', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  $app
    .logger()
    .info(
      'webhook-whatsapp received',
      'event',
      body.event || 'unknown',
      'instance',
      body.instance || '',
    )

  var mediaUrl = null
  var from = null
  var mimeType = 'audio/ogg'

  var data = body.data || body
  var msg = data.message || body.message || {}
  var key = data.key || body.key || {}

  if (msg.audioMessage) {
    mediaUrl = msg.audioMessage.url || msg.audioMessage.mediaUrl || null
    mimeType = msg.audioMessage.mimetype || msg.audioMessage.mimeType || 'audio/ogg'
    from = key.remoteJid || key.from || data.from || body.from || null
  } else if (msg.audio) {
    mediaUrl = msg.audio.url || msg.audio.mediaUrl || null
    mimeType = msg.audio.mimetype || msg.audio.mimeType || 'audio/ogg'
    from = key.remoteJid || key.from || data.from || body.from || null
  }

  if (!mediaUrl) mediaUrl = data.mediaUrl || body.mediaUrl || body.media_url || null
  if (!from) from = data.from || body.from || body.sender || null
  if (from) from = String(from).replace(/@.*$/, '')

  if (!mediaUrl) {
    var textMsg = ''
    var textMessage = data.message || body.message || {}
    if (textMessage.conversation) {
      textMsg = textMessage.conversation
    } else if (textMessage.extendedTextMessage && textMessage.extendedTextMessage.text) {
      textMsg = textMessage.extendedTextMessage.text
    }
    if (textMsg) {
      var textFrom = key.remoteJid || key.from || data.from || body.from || ''
      if (textFrom) textFrom = String(textFrom).replace(/@.*$/, '')
      var textInstance = body.instance || data.instance || ''
      var pbUrlFwd = $secrets.get('PB_INSTANCE_URL') || ''
      var superuserTokenFwd = $secrets.get('PB_SUPERUSER_TOKEN') || ''
      if (pbUrlFwd && superuserTokenFwd) {
        try {
          $http.send({
            url: pbUrlFwd + '/backend/v1/confirmar-whatsapp',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: superuserTokenFwd },
            body: JSON.stringify({ from: textFrom, instance: textInstance, mensagem: textMsg }),
            timeout: 30,
          })
        } catch (_) {}
      }
      return e.json(200, { status: 'encaminhado', message: 'forwarded to confirmar-whatsapp' })
    }
    $app.logger().info('webhook-whatsapp: no audio message detected, ignoring event')
    return e.json(200, { status: 'ignorado', message: 'not an audio message' })
  }

  if (mediaUrl.indexOf('http') !== 0) {
    var baseUrl = $secrets.get('EVOLUTION_API_URL') || ''
    if (baseUrl) {
      if (baseUrl.charAt(baseUrl.length - 1) === '/') baseUrl = baseUrl.slice(0, -1)
      mediaUrl = baseUrl + (mediaUrl.charAt(0) === '/' ? '' : '/') + mediaUrl
    }
  }

  var instance = body.instance || data.instance || ''

  var filaCol = $app.findCollectionByNameOrId('fila_processamento')
  var filaRec = new Record(filaCol)
  filaRec.set(
    'payload',
    JSON.stringify({ mediaUrl: mediaUrl, from: from, mimeType: mimeType, instance: instance }),
  )
  filaRec.set('status', 'aguardando')
  filaRec.set('tentativas', 0)
  filaRec.set('ultimo_erro', '')
  $app.save(filaRec)

  var adminUserId = ''
  try {
    adminUserId = $app.findAuthRecordByEmail('users', 'joaopedro_zoo@hotmail.com').id
  } catch (_) {}

  if (adminUserId) {
    try {
      var logCol = $app.findCollectionByNameOrId('activity_logs')
      var logRec = new Record(logCol)
      logRec.set('user', adminUserId)
      logRec.set('action', 'audio_recebido')
      logRec.set('details', 'Audio recebido de ' + from)
      logRec.set('recordId', filaRec.id)
      logRec.set('target_collection', 'fila_processamento')
      $app.save(logRec)
    } catch (_) {}
  }

  $app.logger().info('webhook-whatsapp: enqueued', 'fila_id', filaRec.id, 'from', from)

  return e.json(200, { status: 'enfileirado', fila_id: filaRec.id })
})
