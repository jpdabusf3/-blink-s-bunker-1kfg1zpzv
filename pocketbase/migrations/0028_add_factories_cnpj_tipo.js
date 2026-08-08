migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('factories')

    if (!col.fields.getByName('cnpj')) {
      col.fields.add(new TextField({ name: 'cnpj' }))
    }

    if (!col.fields.getByName('tipo')) {
      col.fields.add(
        new SelectField({
          name: 'tipo',
          values: ['Cliente', 'Prospecto'],
          maxSelect: 1,
        }),
      )
    }

    col.addIndex('idx_factories_cnpj', false, 'cnpj', '')
    col.addIndex('idx_factories_tipo', false, 'tipo', '')

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    if (col.fields.getByName('cnpj')) {
      col.fields.removeByName('cnpj')
    }
    if (col.fields.getByName('tipo')) {
      col.fields.removeByName('tipo')
    }
    col.removeIndex('idx_factories_cnpj')
    col.removeIndex('idx_factories_tipo')
    app.save(col)
  },
)
