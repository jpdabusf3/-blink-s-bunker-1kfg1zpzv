migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('atividades')
    if (!col.fields.getByName('relatorio_pdf')) {
      col.fields.add(
        new FileField({
          name: 'relatorio_pdf',
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ['application/pdf'],
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('atividades')
    const f = col.fields.getByName('relatorio_pdf')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
