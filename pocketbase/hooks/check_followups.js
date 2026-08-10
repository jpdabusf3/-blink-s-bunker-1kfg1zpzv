cronAdd('check_followups', '0 8 * * *', () => {
  var inactivityDays = 7

  try {
    var settings = $app.findRecordsByFilter('system_settings', '1=1', '', 1, 0)
    if (settings.length > 0) {
      var configDays = settings[0].get('followup_inactivity_days')
      if (configDays && configDays > 0) inactivityDays = configDays
    }
  } catch (_) {}

  var now = new Date()
  var thresholdMs = now.getTime() - inactivityDays * 24 * 60 * 60 * 1000

  var factories = []
  try {
    factories = $app.findRecordsByFilter('factories', 'proximos_passos != ""', '', 1000, 0)
  } catch (_) {
    return
  }

  var alertsCreated = 0

  for (var i = 0; i < factories.length; i++) {
    var f = factories[i]
    var lastDateStr = f.getString('lastInteraction') || f.getString('updated') || ''
    if (!lastDateStr) continue

    var lastDate = new Date(lastDateStr)
    if (lastDate.getTime() > thresholdMs) continue

    var salesOwner = f.getString('salesOwner') || ''
    if (!salesOwner) continue

    var factoryName = f.getString('name') || 'Cliente'
    var proximosPassos = f.getString('proximos_passos') || ''
    var milestone = 'followup_' + f.id

    try {
      $app.findFirstRecordByFilter('notifications', 'userId={:uid} && milestone={:m}', {
        uid: salesOwner,
        m: milestone,
      })
      continue
    } catch (_) {}

    var notifCol = $app.findCollectionByNameOrId('notifications')
    var record = new Record(notifCol)
    record.set('userId', salesOwner)
    record.set('title', 'Follow-up: ' + factoryName)
    record.set(
      'message',
      'Cliente sem interacao ha mais de ' +
        inactivityDays +
        ' dias. Proximos passos: ' +
        proximosPassos,
    )
    record.set('type', 'warning')
    record.set('isRead', false)
    record.set('read', false)
    record.set('milestone', milestone)

    try {
      $app.save(record)
      alertsCreated++
    } catch (_) {}
  }

  $app
    .logger()
    .info(
      'followup check completed',
      'alertsCreated',
      alertsCreated,
      'thresholdDays',
      inactivityDays,
    )
})
