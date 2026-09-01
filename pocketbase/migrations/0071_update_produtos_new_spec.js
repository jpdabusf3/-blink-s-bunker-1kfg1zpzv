migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('produtos')

    // 1. Atualizar regras de acesso para garantir RLS restrito ao dono autenticado (user_id)
    col.listRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.viewRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.deleteRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"

    // 2. Campo 'categoria': TEXT / SELECT com valores permitidos:
    // "Mycotoxin Binders", "Yeast Derivatives", "Organic Minerals", "Yeast Cell Wall", "Blends"
    if (!col.fields.getByName('categoria')) {
      col.fields.add(
        new SelectField({
          name: 'categoria',
          values: [
            'Mycotoxin Binders',
            'Yeast Derivatives',
            'Organic Minerals',
            'Yeast Cell Wall',
            'Blends',
          ],
          maxSelect: 1,
          required: false,
        }),
      )
    } else {
      var catField = col.fields.getByName('categoria')
      if (catField && catField.values) {
        catField.values = [
          'Mycotoxin Binders',
          'Yeast Derivatives',
          'Organic Minerals',
          'Yeast Cell Wall',
          'Blends',
        ]
      }
    }

    // 3. Campo 'linha': TEXT / SELECT com valores permitidos:
    // "MOS", "Mycotoxin", "Minerals", "Yeast", "Blend"
    var linhaField = col.fields.getByName('linha')
    if (linhaField && linhaField.values) {
      linhaField.values = ['MOS', 'Mycotoxin', 'Minerals', 'Yeast', 'Blend']
    }

    // 4. Garantir campo 'user_id'
    if (!col.fields.getByName('user_id')) {
      col.fields.add(
        new RelationField({
          name: 'user_id',
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 5. Garantir campo 'ativo'
    if (!col.fields.getByName('ativo')) {
      col.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
    }

    // 6. Índices requeridos:
    // idx_produtos_codigo (UNIQUE)
    // idx_produtos_categoria
    // idx_produtos_linha
    // idx_produtos_ativo
    // idx_produtos_user_id
    try {
      col.addIndex('idx_produtos_codigo', true, 'codigo', '')
    } catch (_) {}
    try {
      col.addIndex('idx_produtos_categoria', false, 'categoria', '')
    } catch (_) {}
    try {
      col.addIndex('idx_produtos_linha', false, 'linha', '')
    } catch (_) {}
    try {
      col.addIndex('idx_produtos_ativo', false, 'ativo', '')
    } catch (_) {}
    try {
      col.addIndex('idx_produtos_user_id', false, 'user_id', '')
    } catch (_) {}

    app.save(col)

    // 7. Obter ID do usuário padrão para vincular aos produtos semeados
    var defaultUserId = ''
    try {
      var adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      if (adminUser) defaultUserId = adminUser.id
    } catch (_) {
      try {
        var users = app.findRecordsByFilter('users', '', '-created', 1, 0)
        if (users && users.length > 0) defaultUserId = users[0].id
      } catch (_) {}
    }

    // 8. Lista exata dos 40 produtos da nova especificação
    var seedData = [
      {
        codigo: 'BBMO.BE001',
        nome: 'Blink Mos - SC',
        linha: 'MOS',
        categoria: 'Mycotoxin Binders',
      },
      {
        codigo: 'BBMO.BE003',
        nome: 'Blink BetaLink - SC',
        linha: 'MOS',
        categoria: 'Mycotoxin Binders',
      },
      {
        codigo: 'BBMY.CO001',
        nome: 'Blink Mycolink - SC',
        linha: 'Mycotoxin',
        categoria: 'Yeast Derivatives',
      },
      {
        codigo: 'BBMY.CO003',
        nome: 'Blink Mycolink P - SC',
        linha: 'Mycotoxin',
        categoria: 'Yeast Derivatives',
      },
      {
        codigo: 'BBMY.CO005',
        nome: 'Blink Mycolink S - SC',
        linha: 'Mycotoxin',
        categoria: 'Yeast Derivatives',
      },
      {
        codigo: 'BPMI.OR001',
        nome: 'Blink Calcium 17 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR003',
        nome: 'Blink Calcium 22 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR005',
        nome: 'Blink Chromium 10 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR007',
        nome: 'Blink Chromium 20 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR009',
        nome: 'Blink Cobalt 10 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR013',
        nome: 'Blink Copper 17 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR015',
        nome: 'Blink Copper 22 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR017',
        nome: 'Blink Iron 17 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR019',
        nome: 'Blink Iron 22 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR021',
        nome: 'Blink Magnesium 10 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR025',
        nome: 'Blink Manganese 17 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR027',
        nome: 'Blink Manganese 22 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR029',
        nome: 'Blink Selenium 2.0 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR031',
        nome: 'Blink Selenium 6.0 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR033',
        nome: 'Blink Zinc 17 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMI.OR035',
        nome: 'Blink Zinc 22 - SC',
        linha: 'Minerals',
        categoria: 'Organic Minerals',
      },
      {
        codigo: 'BPMY.ST001',
        nome: 'Blink Ycw - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BPMY.ST003',
        nome: 'Blink Lev 32 - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BPMY.ST005',
        nome: 'Blink Lev 35 - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BPMY.ST007',
        nome: 'Blink Lev 37 - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BPMY.ST009',
        nome: 'Blink Lev 40 - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BPMY.ST013',
        nome: 'Blink Hydro 35 - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BPMY.ST015',
        nome: 'Blink Hydro 37 - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BPMY.ST017',
        nome: 'Blink Hydro 40 - SC',
        linha: 'Yeast',
        categoria: 'Yeast Cell Wall',
      },
      {
        codigo: 'BBMI.XS001',
        nome: 'Blink Blend Beef - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS003',
        nome: 'Blink Blend Breeder - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS005',
        nome: 'Blink Blend Cattle - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS007',
        nome: 'Blink Blend Dairy - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS009',
        nome: 'Blink Blend Poultry - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS011',
        nome: 'Blink Blend Swine - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS015',
        nome: 'BlinkBlend Poultry GA - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS017',
        nome: 'Blink Blend PET - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS019',
        nome: 'BlinkBlend PET SpecialD - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS021',
        nome: 'BlinkBlend Pet CF - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
      {
        codigo: 'BBMI.XS022',
        nome: 'BlinkBlend Pet ADX - SC',
        linha: 'Blend',
        categoria: 'Blends',
      },
    ]

    var freshCol = app.findCollectionByNameOrId('produtos')
    for (var i = 0; i < seedData.length; i++) {
      var item = seedData[i]
      var record = null
      try {
        record = app.findFirstRecordByData('produtos', 'codigo', item.codigo)
      } catch (_) {
        record = null
      }

      if (record) {
        record.set('nome', item.nome)
        record.set('linha', item.linha)
        record.set('categoria', item.categoria)
        record.set('ativo', true)
        if (!record.get('user_id') && defaultUserId) {
          record.set('user_id', defaultUserId)
        }
        app.save(record)
      } else {
        var newRecord = new Record(freshCol)
        newRecord.set('codigo', item.codigo)
        newRecord.set('nome', item.nome)
        newRecord.set('linha', item.linha)
        newRecord.set('categoria', item.categoria)
        newRecord.set('ativo', true)
        if (defaultUserId) {
          newRecord.set('user_id', defaultUserId)
        }
        app.save(newRecord)
      }
    }
  },
  (app) => {
    // Revert logic
  },
)
