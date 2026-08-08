migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('factories')

    if (!col.fields.getByName('ultima_edicao_origem')) {
      col.fields.add(
        new SelectField({
          name: 'ultima_edicao_origem',
          values: ['manual', 'audio', 'excel'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    if (col.fields.getByName('ultima_edicao_origem')) {
      col.fields.removeByName('ultima_edicao_origem')
    }
    app.save(col)
  },
)
