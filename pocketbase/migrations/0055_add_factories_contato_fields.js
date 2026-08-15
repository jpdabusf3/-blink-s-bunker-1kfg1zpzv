migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    if (!col.fields.getByName('contato')) {
      col.fields.add(new TextField({ name: 'contato' }))
    }

    if (!col.fields.getByName('status_contato')) {
      col.fields.add(
        new SelectField({
          name: 'status_contato',
          values: ['Champion', 'Stakeholder', 'Decisor', 'Influenciador', 'Gatekeepers'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    try {
      col.fields.removeByName('contato')
    } catch (_) {}
    try {
      col.fields.removeByName('status_contato')
    } catch (_) {}

    app.save(col)
  },
)
