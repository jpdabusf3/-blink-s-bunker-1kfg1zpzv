migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('notifications')
    if (!col.fields.getByName('region')) {
      col.fields.add(new TextField({ name: 'region' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('notifications')
    if (col.fields.getByName('region')) {
      col.fields.removeByName('region')
    }
    app.save(col)
  },
)
