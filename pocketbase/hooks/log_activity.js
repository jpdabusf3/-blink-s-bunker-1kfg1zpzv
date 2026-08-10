routerAdd(
  'POST',
  '/backend/v1/log-activity',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    const body = e.requestInfo().body || {}
    if (!body.action) return e.badRequestError('action is required')

    try {
      const logCol = $app.findCollectionByNameOrId('activity_logs')
      const record = new Record(logCol)
      record.set('user', userId)
      record.set('action', body.action)
      record.set('details', body.details || '')
      if (body.recordId) record.set('recordId', body.recordId)
      if (body.target_collection) record.set('target_collection', body.target_collection)
      else if (body.collectionName) record.set('target_collection', body.collectionName)
      $app.save(record)
    } catch (err) {
      return e.json(500, { error: 'failed to log activity' })
    }

    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
