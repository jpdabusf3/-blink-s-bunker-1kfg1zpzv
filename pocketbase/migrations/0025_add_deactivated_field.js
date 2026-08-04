migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    if (!col.fields.getByName('deactivated')) {
      col.fields.add(new BoolField({ name: 'deactivated' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    const field = col.fields.getByName('deactivated')
    if (field) {
      col.fields.remove(field)
    }
    app.save(col)
  },
)
