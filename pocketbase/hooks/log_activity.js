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
      // Structured fields used by the per-client history dialog
      if (body.tipo) record.set('tipo', body.tipo)
      if (body.proximo_passo) record.set('proximo_passo', body.proximo_passo)
      if (body.status_anterior) record.set('status_anterior', body.status_anterior)
      if (body.status_novo) record.set('status_novo', body.status_novo)
      if (body.origem) record.set('origem', body.origem)
      $app.save(record)
    } catch (err) {
      return e.json(500, { error: 'failed to log activity' })
    }

    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/log-assignment-batch',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    const body = e.requestInfo().body || {}
    const entries = Array.isArray(body.entries) ? body.entries : []
    if (!entries.length) return e.badRequestError('entries array is required')

    try {
      const logCol = $app.findCollectionByNameOrId('activity_logs')
      let saved = 0
      for (let i = 0; i < entries.length; i++) {
        const item = entries[i]
        if (!item || !item.action) continue
        const record = new Record(logCol)
        record.set('user', userId)
        record.set('action', item.action)
        record.set('details', item.details || '')
        if (item.recordId) record.set('recordId', item.recordId)
        record.set(
          'target_collection',
          item.target_collection || item.collectionName || 'factories',
        )
        if (item.tipo) record.set('tipo', item.tipo)
        if (item.proximo_passo) record.set('proximo_passo', item.proximo_passo)
        if (item.status_anterior) record.set('status_anterior', item.status_anterior)
        if (item.status_novo) record.set('status_novo', item.status_novo)
        if (item.origem) record.set('origem', item.origem)
        $app.save(record)
        saved++
      }
      return e.json(200, { success: true, count: saved })
    } catch (err) {
      return e.json(500, { error: 'failed to log batch assignment', details: err?.message || '' })
    }
  },
  $apis.requireAuth(),
)
