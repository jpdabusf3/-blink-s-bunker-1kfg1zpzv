migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    if (!col.fields.getByName('telefone')) {
      col.fields.add(new TextField({ name: 'telefone' }))
    }

    if (!col.fields.getByName('observacoes')) {
      col.fields.add(new TextField({ name: 'observacoes' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('factories')
    if (col.fields.getByName('telefone')) {
      col.fields.removeByName('telefone')
    }
    if (col.fields.getByName('observacoes')) {
      col.fields.removeByName('observacoes')
    }
    app.save(col)
  },
)
