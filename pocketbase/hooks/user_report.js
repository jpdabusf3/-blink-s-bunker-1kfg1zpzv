routerAdd(
  'GET',
  '/backend/v1/users/{userId}/report',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    if (auth.email !== 'joaopedro_zoo@hotmail.com') return e.forbiddenError('super admin only')

    var userId = e.request.pathValue('userId')

    var logs = $app.findRecordsByFilter(
      'activity_logs',
      "user = '" + userId + "'",
      '-created',
      0,
      0,
    )

    var actionCounts = {}
    var createdFactoryNames = []

    for (var i = 0; i < logs.length; i++) {
      var log = logs[i]
      var action = log.getString('action')
      actionCounts[action] = (actionCounts[action] || 0) + 1
      if (action === 'Created Factory') {
        createdFactoryNames.push(log.getString('details'))
      }
    }

    var prospectCount = 0
    var homologatedCount = 0

    for (var j = 0; j < createdFactoryNames.length; j++) {
      try {
        var factory = $app.findFirstRecordByData('factories', 'name', createdFactoryNames[j])
        var status = factory.getString('status')
        if (status === 'Prospeção' || status === 'Não atendido') prospectCount++
        if (status === 'Atendido') homologatedCount++
      } catch (_) {}
    }

    var orders = $app.findRecordsByFilter('orders', "id != ''", '', 0, 0)
    var totalOrdersValue = 0
    for (var k = 0; k < orders.length; k++) {
      totalOrdersValue += orders[k].get('totalValue') || 0
    }

    var targets = $app.findRecordsByFilter('targets', "id != ''", '', 0, 0)
    var totalTargetsValue = 0
    for (var m = 0; m < targets.length; m++) {
      totalTargetsValue += targets[m].get('targetValue') || 0
    }

    var logResults = []
    for (var n = 0; n < logs.length; n++) {
      var l = logs[n]
      logResults.push({
        id: l.id,
        action: l.getString('action'),
        details: l.getString('details'),
        created: l.getString('created'),
      })
    }

    return e.json(200, {
      logs: logResults,
      actionCounts: actionCounts,
      kpis: {
        prospects: prospectCount,
        homologated: homologatedCount,
        totalOrdersValue: totalOrdersValue,
        totalTargetsValue: totalTargetsValue,
        goalsAchieved: totalTargetsValue > 0 ? (totalOrdersValue / totalTargetsValue) * 100 : 0,
      },
    })
  },
  $apis.requireAuth(),
)
