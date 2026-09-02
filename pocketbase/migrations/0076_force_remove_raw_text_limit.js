migrate(
  (app) => {
    // 1. Atualizar notas_fiscais
    const nfCol = app.findCollectionByNameOrId('notas_fiscais')
    const existingNfRaw = nfCol.fields.getByName('raw_text')
    if (existingNfRaw) {
      existingNfRaw.max = 0
      existingNfRaw.min = 0
      existingNfRaw.required = false
    } else {
      nfCol.fields.add(
        new TextField({
          name: 'raw_text',
          required: false,
          max: 0,
        }),
      )
    }
    app.save(nfCol)

    // 2. Atualizar nfe_pedidos
    const nfeCol = app.findCollectionByNameOrId('nfe_pedidos')
    const existingNfeRaw = nfeCol.fields.getByName('raw_text')
    if (existingNfeRaw) {
      existingNfeRaw.max = 0
      existingNfeRaw.min = 0
      existingNfeRaw.required = false
    } else {
      nfeCol.fields.add(
        new TextField({
          name: 'raw_text',
          required: false,
          max: 0,
        }),
      )
    }
    app.save(nfeCol)

    // 3. Validação pós-salvamento: ler de volta
    const checkNf = app.findCollectionByNameOrId('notas_fiscais')
    const checkNfField = checkNf.fields.getByName('raw_text')
    console.log(
      'Migration 0076: notas_fiscais.raw_text max = ' +
        (checkNfField ? checkNfField.max : 'NOT_FOUND'),
    )

    const checkNfe = app.findCollectionByNameOrId('nfe_pedidos')
    const checkNfeField = checkNfe.fields.getByName('raw_text')
    console.log(
      'Migration 0076: nfe_pedidos.raw_text max = ' +
        (checkNfeField ? checkNfeField.max : 'NOT_FOUND'),
    )

    if (checkNfField && checkNfField.max > 0 && checkNfField.max <= 5000) {
      throw new Error(
        'Migration 0076: notas_fiscais.raw_text ainda tem limite max = ' + checkNfField.max,
      )
    }

    if (checkNfeField && checkNfeField.max > 0 && checkNfeField.max <= 5000) {
      throw new Error(
        'Migration 0076: nfe_pedidos.raw_text ainda tem limite max = ' + checkNfeField.max,
      )
    }
  },
  (app) => {
    // Down migration
  },
)
