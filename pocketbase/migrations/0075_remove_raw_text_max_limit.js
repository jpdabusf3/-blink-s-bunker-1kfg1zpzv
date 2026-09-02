migrate(
  (app) => {
    // 1. Atualizar notas_fiscais
    const nfCol = app.findCollectionByNameOrId('notas_fiscais')
    let nfRawText = nfCol.fields.getByName('raw_text')
    if (nfRawText) {
      nfCol.fields.removeByName('raw_text')
    }
    nfCol.fields.add(
      new TextField({
        name: 'raw_text',
        required: false,
        max: 0,
      }),
    )
    app.save(nfCol)

    const savedNfCol = app.findCollectionByNameOrId('notas_fiscais')
    const savedNfRawText = savedNfCol.fields.getByName('raw_text')
    console.log(
      'Migration 0075 [notas_fiscais.raw_text]: max =',
      savedNfRawText ? savedNfRawText.max : 'NOT_FOUND',
    )

    // 2. Atualizar nfe_pedidos
    const nfeCol = app.findCollectionByNameOrId('nfe_pedidos')
    let nfeRawText = nfeCol.fields.getByName('raw_text')
    if (nfeRawText) {
      nfeCol.fields.removeByName('raw_text')
    }
    nfeCol.fields.add(
      new TextField({
        name: 'raw_text',
        required: false,
        max: 0,
      }),
    )
    app.save(nfeCol)

    const savedNfeCol = app.findCollectionByNameOrId('nfe_pedidos')
    const savedNfeRawText = savedNfeCol.fields.getByName('raw_text')
    console.log(
      'Migration 0075 [nfe_pedidos.raw_text]: max =',
      savedNfeRawText ? savedNfeRawText.max : 'NOT_FOUND',
    )
  },
  (app) => {
    // Down migration
    try {
      const nfCol = app.findCollectionByNameOrId('notas_fiscais')
      app.save(nfCol)
    } catch (_) {}

    try {
      const nfeCol = app.findCollectionByNameOrId('nfe_pedidos')
      app.save(nfeCol)
    } catch (_) {}
  },
)
