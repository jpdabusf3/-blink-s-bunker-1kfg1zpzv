onRecordCreateRequest(
  (e) => {
    const auth = e.requestInfo().auth
    const colName = e.record.collectionName
    const recordName =
      e.record.getString('name') || e.record.getString('product') || e.record.id || ''

    e.next()

    if (!auth) return

    try {
      let action = 'Created Record'
      if (colName === 'factories') action = 'Created Factory'
      else if (colName === 'orders') action = 'Created Order'
      else if (colName === 'targets') action = 'Created Target'

      const logCol = $app.findCollectionByNameOrId('activity_logs')
      const log = new Record(logCol)
      log.set('user', auth.id)
      log.set('action', action)
      log.set('details', recordName)
      log.set('recordId', e.record.id)
      log.set('collectionName', colName)
      $app.save(log)
    } catch (err) {
      console.log('activity log create failed', err.message)
    }
  },
  'factories',
  'orders',
  'targets',
)
