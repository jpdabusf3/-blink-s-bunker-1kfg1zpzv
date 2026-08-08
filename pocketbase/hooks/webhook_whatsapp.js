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

  var evolutionApiKey = $secrets.get('EVOLUTION_API_KEY') || ''
  var openaiApiKey = $secrets.get('OPENAI_API_KEY') || ''

  if (!openaiApiKey) {
    $app.logger().error('webhook-whatsapp: OPENAI_API_KEY secret not configured')
    return e.json(500, { status: 'erro', error: 'transcription service not configured' })
  }

  var audioBytes = null
  try {
    var dlHeaders = {}
    if (evolutionApiKey) {
      dlHeaders['apikey'] = evolutionApiKey
    }
    var dlRes = $http.send({
      url: mediaUrl,
      method: 'GET',
      headers: dlHeaders,
      timeout: 30,
    })
    if (dlRes.statusCode !== 200) {
      $app
        .logger()
        .error(
          'webhook-whatsapp: audio download failed',
          'statusCode',
          dlRes.statusCode,
          'url',
          mediaUrl,
        )
      return e.json(502, { status: 'erro', error: 'failed to download audio', from: from })
    }
    audioBytes = dlRes.body
    $app
      .logger()
      .info('webhook-whatsapp: audio downloaded', 'size', audioBytes ? audioBytes.length : 0)
  } catch (err) {
    $app.logger().error('webhook-whatsapp: audio download error', 'error', String(err))
    return e.json(502, { status: 'erro', error: 'failed to download audio', from: from })
  }

  try {
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

    if (transcribeRes.statusCode !== 200) {
      var errBody = ''
      try {
        errBody = transcribeRes.json
          ? JSON.stringify(transcribeRes.json)
          : String(transcribeRes.body)
      } catch (_) {
        errBody = ''
      }
      $app
        .logger()
        .error(
          'webhook-whatsapp: transcription failed',
          'statusCode',
          transcribeRes.statusCode,
          'response',
          errBody,
        )
      return e.json(502, { status: 'erro', error: 'transcription failed', from: from })
    }

    var transcribeJson = transcribeRes.json || {}
    var transcription = transcribeJson.text || ''

    $app
      .logger()
      .info('webhook-whatsapp: transcription successful', 'textLength', transcription.length)

    return e.json(200, {
      status: 'recebido',
      from: from,
      transcricao: transcription,
    })
  } catch (err) {
    $app.logger().error('webhook-whatsapp: transcription error', 'error', String(err))
    return e.json(502, { status: 'erro', error: 'transcription failed', from: from })
  }
})
