routerAdd(
  'POST',
  '/backend/v1/targets/evaluate',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    const targets = $app.findRecordsByFilter('targets', '1=1', '', 1000, 0)
    const orders = $app.findRecordsByFilter('orders', '1=1', '', 10000, 0)
    const factories = $app.findRecordsByFilter('factories', '1=1', '', 10000, 0)

    const factoriesById = {}
    for (const f of factories) {
      factoriesById[f.id] = f
    }

    for (const target of targets) {
      let totalSales = 0
      const startDate = new Date(target.getString('startDate'))
      const endDate = new Date(target.getString('endDate'))
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      for (const order of orders) {
        const orderDateStr = order.getString('orderDate') || order.getString('created')
        const orderDate = new Date(orderDateStr)

        if (orderDate >= startDate && orderDate <= endDate) {
          let match = false
          const catType = target.getString('categoryType')
          const catVal = target.getString('categoryValue')

          if (catType === 'General') {
            match = true
          } else if (catType === 'ProductLine') {
            if (order.getString('line') === catVal || order.getString('product') === catVal) {
              match = true
            }
          } else {
            const factory = factoriesById[order.getString('factoryId')]
            if (factory) {
              if (catType === 'Region' && factory.getString('region') === catVal) match = true
              if (catType === 'Channel' && factory.getString('salesChannel') === catVal)
                match = true
            }
          }

          if (match) {
            totalSales += order.getFloat('totalValue')
          }
        }
      }

      const targetValue = target.getFloat('targetValue')
      const now = new Date()

      const totalDuration = endDate.getTime() - startDate.getTime()
      let elapsed = now.getTime() - startDate.getTime()
      if (elapsed < 0) elapsed = 0
      if (elapsed > totalDuration) elapsed = totalDuration

      const percentTime = totalDuration > 0 ? elapsed / totalDuration : 0
      const percentSales = targetValue > 0 ? totalSales / targetValue : 0

      let milestone = ''
      let title = ''
      let message = ''
      let type = ''

      if (totalSales >= targetValue) {
        milestone = 'reached'
        title = 'Meta Atingida!'
        message = `A meta "${target.getString('name')}" foi atingida com ${(percentSales * 100).toFixed(1)}%.`
        type = 'success'
      } else if (percentTime >= 0.5 && percentSales < 0.5 && now <= endDate) {
        milestone = 'critical'
        title = 'Atenção: Desempenho Crítico'
        message = `A meta "${target.getString('name')}" está em risco. Metade do tempo passou e apenas ${(percentSales * 100).toFixed(1)}% foi atingido.`
        type = 'warning'
      }

      if (milestone) {
        try {
          $app.findFirstRecordByFilter(
            'notifications',
            'userId={:user} && targetId={:target} && milestone={:milestone}',
            { user: userId, target: target.id, milestone: milestone },
          )
        } catch (_) {
          const notifCol = $app.findCollectionByNameOrId('notifications')
          const record = new Record(notifCol)
          record.set('userId', userId)
          record.set('targetId', target.id)
          record.set('milestone', milestone)
          record.set('title', title)
          record.set('message', message)
          record.set('type', type)
          record.set('isRead', false)
          $app.save(record)
        }
      }
    }
    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
