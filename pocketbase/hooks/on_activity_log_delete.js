onRecordDeleteRequest(
  (e) => {
    const auth = e.requestInfo().auth
    const colName = e.record.collectionName
    const recordName =
      e.record.getString('name') || e.record.getString('product') || e.record.id || ''

    e.next()

    if (!auth) return

    try {
      let action = 'Deleted Record'
      if (colName === 'factories') action = 'Deleted Factory'
      else if (colName === 'orders') action = 'Deleted Order'
      else if (colName === 'targets') action = 'Deleted Target'

      const logCol = $app.findCollectionByNameOrId('activity_logs')
      const log = new Record(logCol)
      log.set('user', auth.id)
      log.set('action', action)
      log.set('details', recordName)
      $app.save(log)
    } catch (err) {
      console.log('activity log delete failed', err.message)
    }
  },
  'factories',
  'orders',
  'targets',
)
