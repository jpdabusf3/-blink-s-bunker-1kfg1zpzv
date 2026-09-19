migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('produtos')

    // 1. Garantir que o campo 'familia' aceita os valores da especificação:
    // "Mos/BetaLink", "Mycolink", "Minerais Orgânicos", "Leveduras", "Blends"
    // e também preserva os valores pré-existentes ('Adsorventes', 'Aditivos', 'Minerais Organicos', 'Suplementos')
    // para total compatibilidade retroativa e sem risco de rejeição.
    const allowedFamilias = [
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

    // 2. Obter defaultUserId caso seja necessário associar ao user_id
    let defaultUserId = ''
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      if (adminUser) defaultUserId = adminUser.id
    } catch (_) {
      try {
        const users = app.findRecordsByFilter('users', '', '-created', 1, 0)
        if (users && users.length > 0) defaultUserId = users[0].id
      } catch (_) {}
    }

    // 3. Catálogo exato dos 40 produtos especificados com derivação de família pelo prefixo
    const catalog = [
      { codigo: 'BBMO.BE001', nome: 'Blink Mos - SC', familia: 'Mos/BetaLink' },
      { codigo: 'BBMO.BE003', nome: 'Blink BetaLink - SC', familia: 'Mos/BetaLink' },
      { codigo: 'BBMY.CO001', nome: 'Blink Mycolink - SC', familia: 'Mycolink' },
      { codigo: 'BBMY.CO003', nome: 'Blink Mycolink P - SC', familia: 'Mycolink' },
      { codigo: 'BBMY.CO005', nome: 'Blink Mycolink S - SC', familia: 'Mycolink' },
      { codigo: 'BPMI.OR001', nome: 'Blink Calcium 17 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR003', nome: 'Blink Calcium 22 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR005', nome: 'Blink Chromium 10 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR007', nome: 'Blink Chromium 20 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR009', nome: 'Blink Cobalt 10 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR013', nome: 'Blink Copper 17 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR015', nome: 'Blink Copper 22 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR017', nome: 'Blink Iron 17 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR019', nome: 'Blink Iron 22 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR021', nome: 'Blink Magnesium 10 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR025', nome: 'Blink Manganese 17 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR027', nome: 'Blink Manganese 22 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR029', nome: 'Blink Selenium 2.0 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR031', nome: 'Blink Selenium 6.0 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR033', nome: 'Blink Zinc 17 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMI.OR035', nome: 'Blink Zinc 22 - SC', familia: 'Minerais Orgânicos' },
      { codigo: 'BPMY.ST001', nome: 'Blink Ycw - SC', familia: 'Leveduras' },
      { codigo: 'BPMY.ST003', nome: 'Blink Lev 32 - SC', familia: 'Leveduras' },
      { codigo: 'BPMY.ST005', nome: 'Blink Lev 35 - SC', familia: 'Leveduras' },
      { codigo: 'BPMY.ST007', nome: 'Blink Lev 37 - SC', familia: 'Leveduras' },
      { codigo: 'BPMY.ST009', nome: 'Blink Lev 40 - SC', familia: 'Leveduras' },
      { codigo: 'BPMY.ST013', nome: 'Blink Hydro 35 - SC', familia: 'Leveduras' },
      { codigo: 'BPMY.ST015', nome: 'Blink Hydro 37 - SC', familia: 'Leveduras' },
      { codigo: 'BPMY.ST017', nome: 'Blink Hydro 40 - SC', familia: 'Leveduras' },
      { codigo: 'BBMI.XS001', nome: 'Blink Blend Beef - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS003', nome: 'Blink Blend Breeder - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS005', nome: 'Blink Blend Cattle - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS007', nome: 'Blink Blend Dairy - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS009', nome: 'Blink Blend Poultry - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS011', nome: 'Blink Blend Swine - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS015', nome: 'BlinkBlend Poultry GA - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS017', nome: 'Blink Blend PET - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS019', nome: 'BlinkBlend PET SpecialD - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS021', nome: 'BlinkBlend Pet CF - SC', familia: 'Blends' },
      { codigo: 'BBMI.XS022', nome: 'BlinkBlend Pet ADX - SC', familia: 'Blends' },
    ]

    // 4. Inserção ADITIVA: Se já existir registro pelo código, NÃO apaga nem sobrescreve.
    // Insere apenas os que faltarem.
    const freshCol = app.findCollectionByNameOrId('produtos')
    for (let i = 0; i < catalog.length; i++) {
      const item = catalog[i]
      let existing = null
      try {
        existing = app.findFirstRecordByData('produtos', 'codigo', item.codigo)
      } catch (_) {
        existing = null
      }

      if (!existing) {
        // Criar somente se não existir
        const rec = new Record(freshCol)
        rec.set('codigo', item.codigo)
        rec.set('nome', item.nome)
        rec.set('familia', item.familia)
        rec.set('ativo', true)
        if (defaultUserId) {
          rec.set('user_id', defaultUserId)
        }
        app.save(rec)
      }
    }
  },
  (app) => {
    // Migration reversível aditiva — não remove produtos para não quebrar integridade
  },
)
