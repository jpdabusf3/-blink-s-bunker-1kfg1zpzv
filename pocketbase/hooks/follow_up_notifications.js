cronAdd('follow_up_notifications', '0 8 * * *', () => {
  var thresholdDays = 7
  var configDays = $secrets.get('FOLLOW_UP_DAYS') || ''
  if (configDays) {
    var parsed = parseInt(configDays, 10)
    if (parsed > 0) thresholdDays = parsed
  }

  var factories = $app.findRecordsByFilter(
    'factories',
    'proximos_passos != ""',
    '-updated',
    1000,
    0,
  )

  var now = new Date()
  var thresholdMs = thresholdDays * 24 * 60 * 60 * 1000
  var alertsCreated = 0

  for (var i = 0; i < factories.length; i++) {
    var factory = factories[i]

    var updatedStr = factory.getString('updated') || ''
    var lastInteractionStr = factory.getString('lastInteraction') || ''
    var ultimoPedidoStr = factory.getString('ultimo_pedido') || ''

    var latestDate = new Date(0)
    if (updatedStr) {
      var d1 = new Date(updatedStr)
      if (d1 > latestDate) latestDate = d1
    }
    if (lastInteractionStr) {
      var d2 = new Date(lastInteractionStr)
      if (d2 > latestDate) latestDate = d2
    }
    if (ultimoPedidoStr) {
      var d3 = new Date(ultimoPedidoStr)
      if (d3 > latestDate) latestDate = d3
    }

    var diff = now.getTime() - latestDate.getTime()
    if (diff < thresholdMs) continue

    var salesOwner = factory.getString('salesOwner') || ''
    if (!salesOwner) continue

    var factoryName = factory.getString('name') || ''
    var proximosPassos = factory.getString('proximos_passos') || ''
    var statusFunil = factory.getString('status_funil') || ''
    var title = 'Follow-up: ' + factoryName

    try {
      $app.findFirstRecordByFilter('notifications', 'userId = {:uid} && title = {:title}', {
        uid: salesOwner,
        title: title,
      })
      continue
    } catch (_) {}

    var message = 'Cliente "' + factoryName + '" sem movimentação há ' + thresholdDays + ' dias.'
    if (statusFunil) message += ' Status: ' + statusFunil + '.'
    message += ' Próximos passos: ' + proximosPassos

    var notifCol = $app.findCollectionByNameOrId('notifications')
    var notif = new Record(notifCol)
    notif.set('userId', salesOwner)
    notif.set('title', title)
    notif.set('message', message)
    notif.set('type', 'warning')
    notif.set('isRead', false)
    notif.set('read', false)
    $app.save(notif)
    alertsCreated++
  }

  $app
    .logger()
    .info('follow_up_notifications', 'alertsCreated', alertsCreated, 'thresholdDays', thresholdDays)
})
