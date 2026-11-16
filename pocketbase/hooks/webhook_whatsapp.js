/// <reference path="../pb_data/types.d.ts" />

/**
 * Webhook de entrada do WhatsApp (Evolution API) — versão MULTIUSUÁRIO.
 *
 * O que mudou:
 * - Identifica QUAL vendedor está falando pelo telefone: compara os dígitos do remetente
 *   com o campo `whatsapp` dos usuários ativos (compara apenas os 11 dígitos finais, com ou
 *   sem o 9º dígito, para não depender do formato de gravação).
 * - Aceita ÁUDIO e TEXTO. Antes, texto caía direto no fluxo de confirmação (que só sabe
 *   tratar correções de uma pendência) e uma mensagem nova era simplesmente perdida.
 *   Agora texto entra na mesma fila do áudio, com o campo `texto`.
 * - Grava `vendedor_id` no payload da fila, para a atividade ser registrada no nome de quem
 *   realmente mandou a mensagem.
 * - Telefone não cadastrado: responde pedindo para o usuário pedir o cadastro ao
 *   administrador, e NÃO grava nada (evita atividade no nome errado).
 *
 * URL a configurar na Evolution: <backend URL>/backend/v1/webhook-whatsapp
 * (o domínio *.goskip.app NÃO serve — é host estático do frontend)
 */

routerAdd('POST', '/backend/v1/webhook-whatsapp', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var evolutionUrl = $secrets.get('EVOLUTION_API_URL') || ''
  if (evolutionUrl && evolutionUrl.charAt(evolutionUrl.length - 1) === '/') {
    evolutionUrl = evolutionUrl.slice(0, evolutionUrl.length - 1)
  }
  var evolutionKey = $secrets.get('EVOLUTION_API_KEY') || ''

  // ---- Normalização de telefone: só dígitos, com DDI 55, sem o 9º dígito quando houver ----
  function phoneDigits(v) {
    var s = String(v || '')
    var out = ''
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i)
      if (c >= '0' && c <= '9') out += c
    }
    return out
  }

  function phoneKey(raw) {
    var d = phoneDigits(raw)
    if (!d) return ''
    // remove DDI 55 quando presente
    if (d.length >= 12 && d.substring(0, 2) === '55') d = d.substring(2)
    // remove o 9 inicial de celular (11 dígitos -> 10)
    if (d.length === 11 && d.charAt(2) === '9') d = d.substring(0, 2) + d.substring(3)
    return d
  }

  function resolveSeller(from) {
    var key = phoneKey(from)
    if (!key) return null
    var users = []
    try {
      users = $app.findRecordsByFilter('users', 'deactivated != true', '', 500, 0)
    } catch (_) {
      users = []
    }
    for (var i = 0; i < users.length; i++) {
      var u = users[i]
      var w = phoneKey(u.getString('whatsapp'))
      if (w && w === key) {
        return { id: u.id, name: u.getString('name') || u.getString('email') || u.id }
      }
    }
    return null
  }

  function sendText(number, text) {
    if (!evolutionUrl) return
    try {
      $http.send({
        url: evolutionUrl + '/message/sendText/' + (body.instance || data.instance || ''),
        method: 'POST',
        headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: number, text: text }),
        timeout: 30,
      })
    } catch (err) {
      $app.logger().warn('webhook-whatsapp: falha ao responder', 'error', String(err))
    }
  }

  var data = body.data || body
  var msg = data.message || body.message || {}
  var key = data.key || body.key || {}
  var instance = body.instance || data.instance || ''
  var from = key.remoteJid || key.from || data.from || body.from || null
  if (from) from = String(from).replace(/@.*$/, '')

  // Ignora mensagens enviadas pelo próprio bot / grupos
  var fromMe = key.fromMe === true || data.fromMe === true
  if (fromMe) {
    return e.json(200, { status: 'ignorado', motivo: 'fromMe' })
  }
  var remoteJid = String(key.remoteJid || '')
  if (remoteJid.indexOf('@g.us') !== -1) {
    return e.json(200, { status: 'ignorado', motivo: 'grupo' })
  }

  // ---- Extrai conteúdo: áudio ou texto ----
  var mediaUrl = null
  var mimeType = 'audio/ogg'
  var texto = ''

  if (msg.audioMessage) {
    mediaUrl = msg.audioMessage.url || msg.audioMessage.mediaUrl || null
    mimeType = msg.audioMessage.mimetype || msg.audioMessage.mimeType || 'audio/ogg'
  } else if (msg.audio) {
    mediaUrl = msg.audio.url || msg.audio.mediaUrl || null
    mimeType = msg.audio.mimetype || msg.audio.mimeType || 'audio/ogg'
  } else if (msg.conversation) {
    texto = msg.conversation
  } else if (msg.extendedTextMessage && msg.extendedTextMessage.text) {
    texto = msg.extendedTextMessage.text
  } else if (msg.ephemeralMessage && msg.ephemeralMessage.message) {
    var em = msg.ephemeralMessage.message
    if (em.conversation) texto = em.conversation
    else if (em.extendedTextMessage && em.extendedTextMessage.text)
      texto = em.extendedTextMessage.text
    else if (em.audioMessage) {
      mediaUrl = em.audioMessage.url || null
      mimeType = em.audioMessage.mimetype || 'audio/ogg'
    }
  }

  if (!mediaUrl && !texto) {
    $app.logger().info('webhook-whatsapp: evento sem áudio nem texto — ignorado')
    return e.json(200, { status: 'ignorado', motivo: 'sem audio nem texto' })
  }

  if (!from) {
    return e.json(400, { status: 'erro', motivo: 'remetente ausente' })
  }

  // ---- Identifica o vendedor ----
  var seller = resolveSeller(from)
  if (!seller) {
    $app.logger().warn('webhook-whatsapp: telefone nao cadastrado', 'from', from)
    sendText(
      from,
      'Olá! Este número ainda não está cadastrado no Blink Bunker.\n' +
        'Peça ao administrador para incluir seu WhatsApp no seu perfil de usuário ' +
        'e tente novamente.',
    )
    return e.json(200, { status: 'nao_cadastrado', from: from })
  }

  // ---- Áudio: resolve URL absoluta ----
  if (mediaUrl && mediaUrl.indexOf('http') !== 0) {
    var baseUrl = evolutionUrl
    if (baseUrl) {
      mediaUrl = baseUrl + (mediaUrl.charAt(0) === '/' ? '' : '/') + mediaUrl
    }
  }

  // ---- Enfileira (áudio ou texto) ----
  var filaCol = $app.findCollectionByNameOrId('fila_processamento')
  var filaRec = new Record(filaCol)
  filaRec.set(
    'payload',
    JSON.stringify({
      mediaUrl: mediaUrl || '',
      texto: texto || '',
      from: from,
      mimeType: mimeType,
      instance: instance,
      vendedor_id: seller.id,
      vendedor_nome: seller.name,
    }),
  )
  filaRec.set('status', 'aguardando')
  filaRec.set('tentativas', 0)
  filaRec.set('ultimo_erro', '')
  $app.save(filaRec)

  $app
    .logger()
    .info(
      'webhook-whatsapp: enfileirado',
      'fila_id',
      filaRec.id,
      'tipo',
      mediaUrl ? 'audio' : 'texto',
      'vendedor',
      seller.name,
    )

  return e.json(200, {
    status: 'recebido',
    tipo: mediaUrl ? 'audio' : 'texto',
    vendedor: seller.name,
    fila_id: filaRec.id,
  })
})
