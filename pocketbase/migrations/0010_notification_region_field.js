migrate(
  (app) => {
    let col
    try {
      col = app.findCollectionByNameOrId('notifications')
    } catch (_) {
      col = new Collection({
        name: 'notifications',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'title', type: 'text' },
          { name: 'message', type: 'text' },
          { name: 'region', type: 'text' },
          { name: 'read', type: 'bool' },
          { name: 'type', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(col)
      return
    }
    if (!col.fields.getByName('region')) {
      col.fields.add(new TextField({ name: 'region' }))
    }
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('notifications')
      if (col.fields.getByName('region')) {
        col.fields.removeByName('region')
      }
      app.save(col)
    } catch (_) {}
  },
)
