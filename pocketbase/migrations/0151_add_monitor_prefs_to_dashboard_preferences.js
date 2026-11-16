migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('dashboard_preferences')
    if (!col.fields.getByName('monitor_prefs')) {
      col.fields.add(
        new JSONField({
          name: 'monitor_prefs',
          maxSize: 2000000,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('dashboard_preferences')
    if (col.fields.getByName('monitor_prefs')) {
      col.fields.removeByName('monitor_prefs')
    }
    app.save(col)
  },
)
