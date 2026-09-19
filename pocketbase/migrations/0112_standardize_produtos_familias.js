migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    // 1. Atualizar valores permitidos do SelectField 'familia'
    // Novos códigos canônicos: MI-XS, MO-BE, MY-CO, MI-OR, MY-ST
    // Mantém compatibilidade com valores legados no schema caso necessário
    const allowedFamilias = [
      'MI-XS',
      'MO-BE',
      'MY-CO',
      'MI-OR',
      'MY-ST',
      'Mos/BetaLink',
      'Mycolink',
      'Minerais Orgânicos',
      'Leveduras',
      'Blends',
      'Adsorventes',
      'Aditivos',
      'Minerais Organicos',
      'Suplementos',
    ]

    const familiaField = col.fields.getByName('familia')
    if (!familiaField) {
      col.fields.add(
        new SelectField({
          name: 'familia',
          values: allowedFamilias,
          maxSelect: 1,
          required: false,
        }),
      )
    } else {
      familiaField.values = allowedFamilias
    }
    app.save(col)

    // 2. Atualizar campo 'familia' de todos os produtos do catálogo conforme prefixo do código:
    // - MI-XS: prefixo BBMI.XS...
    // - MO-BE: prefixo BBMO.BE...
    // - MY-CO: prefixo BBMY.CO...
    // - MI-OR: prefixo BPMI.OR...
    // - MY-ST: prefixo BPMY.ST...
    // Utilizando UPDATE SQL com WHERE específico para garantir atomicidade e precisão
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'MI-XS' WHERE codigo LIKE 'BBMI.XS%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'MO-BE' WHERE codigo LIKE 'BBMO.BE%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'MY-CO' WHERE codigo LIKE 'BBMY.CO%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'MI-OR' WHERE codigo LIKE 'BPMI.OR%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'MY-ST' WHERE codigo LIKE 'BPMY.ST%'")
      .execute()
  },
  (app) => {
    // Reverter para valores anteriores
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'Blends' WHERE codigo LIKE 'BBMI.XS%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'Aditivos' WHERE codigo LIKE 'BBMO.BE%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'Adsorventes' WHERE codigo LIKE 'BBMY.CO%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'Minerais Organicos' WHERE codigo LIKE 'BPMI.OR%'")
      .execute()
    app
      .db()
      .newQuery("UPDATE produtos SET familia = 'Suplementos' WHERE codigo LIKE 'BPMY.ST%'")
      .execute()
  },
)
