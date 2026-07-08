onRecordUpdateRequest(
  (e) => {
    const auth = e.requestInfo().auth
    const colName = e.record.collectionName
    const recordName =
      e.record.getString('name') || e.record.getString('product') || e.record.id || ''

    e.next()

    if (!auth) return

    try {
      let action = 'Updated Record'
      if (colName === 'factories') action = 'Updated Factory'
      else if (colName === 'orders') action = 'Updated Order'
      else if (colName === 'targets') action = 'Updated Target'

      const logCol = $app.findCollectionByNameOrId('activity_logs')
      const log = new Record(logCol)
      log.set('user', auth.id)
      log.set('action', action)
      log.set('details', recordName)
      $app.save(log)
    } catch (err) {
      console.log('activity log update failed', err.message)
    }
  },
  'factories',
  'orders',
  'targets',
)
