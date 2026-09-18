migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('faturamento')
    if (!col.fields.getByName('vendedor')) {
      col.fields.add(
        new TextField({
          name: 'vendedor',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('faturamento')
    const field = col.fields.getByName('vendedor')
    if (field) {
      col.fields.removeByName('vendedor')
      app.save(col)
    }
  },
)
