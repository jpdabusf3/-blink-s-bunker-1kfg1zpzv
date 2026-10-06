migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('factories')

    if (!col.fields.getByName('acao_realizada')) {
      col.fields.add(new TextField({ name: 'acao_realizada' }))
    }
    if (!col.fields.getByName('acao_em_pratica')) {
      col.fields.add(new TextField({ name: 'acao_em_pratica' }))
    }
    if (!col.fields.getByName('acao_a_ser_realizada')) {
      col.fields.add(new TextField({ name: 'acao_a_ser_realizada' }))
    }

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    try {
      col.fields.removeByName('acao_realizada')
    } catch (_) {}
    try {
      col.fields.removeByName('acao_em_pratica')
    } catch (_) {}
    try {
      col.fields.removeByName('acao_a_ser_realizada')
    } catch (_) {}
    app.save(col)
  },
)
