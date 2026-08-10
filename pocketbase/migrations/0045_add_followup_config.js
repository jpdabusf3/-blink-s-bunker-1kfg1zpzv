migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('system_settings')
    if (!col.fields.getByName('followup_inactivity_days')) {
      col.fields.add(new NumberField({ name: 'followup_inactivity_days', min: 1, max: 90 }))
    }
    app.save(col)

    try {
      var existing = app.findRecordsByFilter('system_settings', '1=1', '', 1, 0)
      if (existing.length === 0) {
        var rec = new Record(col)
        rec.set('followup_inactivity_days', 7)
        app.save(rec)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('system_settings')
      var field = col.fields.getByName('followup_inactivity_days')
      if (field) col.fields.remove(field)
      app.save(col)
    } catch (_) {}
  },
)
