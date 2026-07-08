onRecordAfterUpdateSuccess((e) => {
  var targets = $app.findRecordsByFilter('targets', '1=1', '', 1000, 0)
  var orders = $app.findRecordsByFilter('orders', '1=1', '', 10000, 0)
  var factories = $app.findRecordsByFilter('factories', '1=1', '', 10000, 0)
  var users = $app.findRecordsByFilter('users', '1=1', '', 1000, 0)

  var factoriesById = {}
  for (var i = 0; i < factories.length; i++) {
    factoriesById[factories[i].id] = factories[i]
  }

  var leadershipTitles = ['CEO', 'Diretor', 'Gestor', 'Gerente', 'Manager']
  var leadershipUsers = users.filter(function (u) {
    return leadershipTitles.indexOf(u.getString('job_title')) !== -1
  })

  for (var t = 0; t < targets.length; t++) {
    var target = targets[t]
    var totalSales = 0
    var startDate = new Date(target.getString('startDate'))
    var endDate = new Date(target.getString('endDate'))
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    var catType = target.getString('categoryType')
    var catVal = target.getString('categoryValue')
    var targetName = target.getString('name')

    for (var o = 0; o < orders.length; o++) {
      var order = orders[o]
      var orderDate = new Date(order.getString('orderDate') || order.getString('created'))
      if (orderDate < startDate || orderDate > endDate) continue

      var match = false
      if (catType === 'General') {
        match = true
      } else if (catType === 'ProductLine') {
        match = order.getString('line') === catVal || order.getString('product') === catVal
      } else {
        var factory = factoriesById[order.getString('factoryId')]
        if (factory) {
          if (catType === 'Region') match = factory.getString('region') === catVal
          if (catType === 'Channel') match = factory.getString('salesChannel') === catVal
        }
      }
      if (match) totalSales += order.getFloat('totalValue')
    }

    var targetValue = target.getFloat('targetValue')
    var now = new Date()
    var totalDuration = endDate.getTime() - startDate.getTime()
    var elapsed = now.getTime() - startDate.getTime()
    if (elapsed < 0) elapsed = 0
    if (elapsed > totalDuration) elapsed = totalDuration

    var percentTime = totalDuration > 0 ? elapsed / totalDuration : 0
    var percentSales = targetValue > 0 ? totalSales / targetValue : 0

    var milestone = '',
      title = '',
      message = '',
      type = ''

    if (totalSales >= targetValue && targetValue > 0) {
      milestone = 'reached'
      title = 'Metas Atingidas'
      type = 'success'
    } else if (percentSales >= 0.9 && targetValue > 0) {
      milestone = 'nearly_reached'
      title = 'Metas Quase Batidas'
      type = 'info'
    } else if (percentTime >= 0.5 && percentSales < 0.5 && now <= endDate) {
      milestone = 'low_performance'
      title = 'Baixa Performance'
      type = 'warning'
    }

    if (!milestone) continue

    if (catType === 'Region') {
      message = 'Região ' + catVal + ' está em ' + (percentSales * 100).toFixed(1) + '% da meta'
    } else if (catType === 'General') {
      message = 'Meta geral está em ' + (percentSales * 100).toFixed(1) + '%'
    } else {
      message = 'A meta "' + targetName + '" está em ' + (percentSales * 100).toFixed(1) + '%'
    }

    var targetUsers = leadershipUsers.slice()
    if (catType === 'Region' && catVal) {
      var existingIds = {}
      for (var lu = 0; lu < targetUsers.length; lu++) existingIds[targetUsers[lu].id] = true
      for (var u = 0; u < users.length; u++) {
        if (users[u].getString('geographicArea') === catVal && !existingIds[users[u].id]) {
          targetUsers.push(users[u])
        }
      }
    }

    var region = catType === 'Region' ? catVal : ''

    for (var tu = 0; tu < targetUsers.length; tu++) {
      var usr = targetUsers[tu]
      try {
        $app.findFirstRecordByFilter(
          'notifications',
          'userId={:user} && targetId={:target} && milestone={:milestone}',
          { user: usr.id, target: target.id, milestone: milestone },
        )
      } catch (_) {
        var notifCol = $app.findCollectionByNameOrId('notifications')
        var record = new Record(notifCol)
        record.set('userId', usr.id)
        record.set('targetId', target.id)
        record.set('milestone', milestone)
        record.set('title', title)
        record.set('message', message)
        record.set('type', type)
        record.set('isRead', false)
        record.set('read', false)
        try {
          record.set('region', region)
        } catch (_) {}
        $app.save(record)
      }
    }
  }
  e.next()
}, 'orders')
