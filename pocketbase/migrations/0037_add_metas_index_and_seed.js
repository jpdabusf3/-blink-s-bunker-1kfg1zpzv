migrate(
  (app) => {
    var metasCol = app.findCollectionByNameOrId('metas')
    metasCol.addIndex('idx_metas_vendedor_id_periodo', false, 'vendedor_id, periodo', '')
    app.save(metasCol)

    var userId = null
    try {
      var user = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      userId = user.id
    } catch (_) {}

    if (!userId) return

    var PERIODO = 'Agosto 2026'
    var existing = []
    try {
      existing = app.findRecordsByFilter(
        'metas',
        'vendedor_id = "' + userId + '" && periodo = "' + PERIODO + '"',
        '-created',
        1,
        0,
      )
    } catch (_) {}

    var rec
    if (existing.length > 0) {
      rec = existing[0]
    } else {
      rec = new Record(metasCol)
    }
    rec.set('vendedor_id', userId)
    rec.set('periodo', PERIODO)
    rec.set('meta_valor', 181519.41)
    rec.set('valor_realizado', 283954.29)
    app.save(rec)
  },
  (app) => {
    var metasCol = app.findCollectionByNameOrId('metas')
    metasCol.removeIndex('idx_metas_vendedor_id_periodo')
    app.save(metasCol)

    try {
      var user = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      var existing = app.findRecordsByFilter(
        'metas',
        'vendedor_id = "' + user.id + '" && periodo = "Agosto 2026"',
        '-created',
        1,
        0,
      )
      if (existing.length > 0) app.delete(existing[0])
    } catch (_) {}
  },
)
