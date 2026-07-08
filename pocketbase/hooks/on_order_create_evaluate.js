onRecordAfterCreateSuccess((e) => {
  const targets = $app.findRecordsByFilter('targets', '1=1', '', 1000, 0)
  const orders = $app.findRecordsByFilter('orders', '1=1', '', 10000, 0)
  const factories = $app.findRecordsByFilter('factories', '1=1', '', 10000, 0)
  const users = $app.findRecordsByFilter('users', '1=1', '', 1000, 0)

  const factoriesById = {}
  for (const f of factories) {
    factoriesById[f.id] = f
  }

  const leadershipTitles = ['CEO', 'Diretor', 'Gestor', 'Gerente', 'Manager']
  const leadershipUsers = users.filter(function (u) {
    return leadershipTitles.indexOf(u.getString('job_title')) !== -1
  })

  for (const target of targets) {
    let totalSales = 0
    const startDate = new Date(target.getString('startDate'))
    const endDate = new Date(target.getString('endDate'))
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    const catType = target.getString('categoryType')
    const catVal = target.getString('categoryValue')
    const targetName = target.getString('name')

    for (const order of orders) {
      const orderDate = new Date(order.getString('orderDate') || order.getString('created'))
      if (orderDate < startDate || orderDate > endDate) continue

      let match = false
      if (catType === 'General') {
        match = true
      } else if (catType === 'ProductLine') {
        match = order.getString('line') === catVal || order.getString('product') === catVal
      } else {
        const factory = factoriesById[order.getString('factoryId')]
        if (factory) {
          if (catType === 'Region') match = factory.getString('region') === catVal
          if (catType === 'Channel') match = factory.getString('salesChannel') === catVal
        }
      }
      if (match) totalSales += order.getFloat('totalValue')
    }

    const targetValue = target.getFloat('targetValue')
    const now = new Date()
    const totalDuration = endDate.getTime() - startDate.getTime()
    let elapsed = now.getTime() - startDate.getTime()
    if (elapsed < 0) elapsed = 0
    if (elapsed > totalDuration) elapsed = totalDuration

    const percentTime = totalDuration > 0 ? elapsed / totalDuration : 0
    const percentSales = targetValue > 0 ? totalSales / targetValue : 0

    let milestone = '',
      title = '',
      message = '',
      type = ''

    if (totalSales >= targetValue && targetValue > 0) {
      milestone = 'reached'
      title = 'Meta Atingida'
      if (catType === 'Region') {
        message =
          'Região ' + catVal + ' atingiu ' + (percentSales * 100).toFixed(1) + '% da meta de vendas'
      } else if (catType === 'General') {
        message = 'Meta geral da empresa atingida com ' + (percentSales * 100).toFixed(1) + '%'
      } else {
        message =
          'A meta "' + targetName + '" foi atingida com ' + (percentSales * 100).toFixed(1) + '%'
      }
      type = 'success'
    } else if (percentTime >= 0.5 && percentSales < 0.5 && now <= endDate) {
      milestone = 'critical'
      title = 'Alerta Crítico'
      if (catType === 'Region') {
        message =
          'Desempenho da Região ' + catVal + ' está em ' + (percentSales * 100).toFixed(1) + '%'
      } else if (catType === 'General') {
        message = 'Desempenho geral da empresa está em ' + (percentSales * 100).toFixed(1) + '%'
      } else {
        message =
          'A meta "' + targetName + '" está em risco com ' + (percentSales * 100).toFixed(1) + '%'
      }
      type = 'warning'
    }

    if (!milestone) continue

    let targetUsers = leadershipUsers.slice()
    if (catType === 'Region' && catVal) {
      const existingIds = {}
      for (const lu of targetUsers) {
        existingIds[lu.id] = true
      }
      for (const u of users) {
        if (u.getString('geographicArea') === catVal && !existingIds[u.id]) {
          targetUsers.push(u)
        }
      }
    }

    for (const u of targetUsers) {
      try {
        $app.findFirstRecordByFilter(
          'notifications',
          'userId={:user} && targetId={:target} && milestone={:milestone}',
          { user: u.id, target: target.id, milestone: milestone },
        )
      } catch (_) {
        const notifCol = $app.findCollectionByNameOrId('notifications')
        const record = new Record(notifCol)
        record.set('userId', u.id)
        record.set('targetId', target.id)
        record.set('milestone', milestone)
        record.set('title', title)
        record.set('message', message)
        record.set('type', type)
        record.set('isRead', false)
        try {
          record.set('region', catType === 'Region' ? catVal : '')
        } catch (_) {}
        $app.save(record)
      }
    }
  }
  e.next()
}, 'orders')
