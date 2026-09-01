migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('produtos')

    // 1. Atualizar regras de acesso para garantir RLS baseado no user_id do usuário autenticado
    col.listRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.viewRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.deleteRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"

    // 2. Adicionar / ajustar campos
    if (!col.fields.getByName('nome_curto')) {
      col.fields.add(new TextField({ name: 'nome_curto' }))
    }

    if (!col.fields.getByName('familia')) {
      col.fields.add(
        new SelectField({
          name: 'familia',
          values: ['Adsorventes', 'Aditivos', 'Minerais Organicos', 'Suplementos', 'Blends'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('especie_destino')) {
      col.fields.add(
        new SelectField({
          name: 'especie_destino',
          values: ['Ruminantes', 'PET', 'Aves', 'Suinos', 'Aqua', 'Multi'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

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

    // 3. Adicionar índices: idx_produtos_familia, idx_produtos_user_id (idx_produtos_codigo já existe e é unique)
    try {
      col.addIndex('idx_produtos_codigo', true, 'codigo', '')
    } catch (_) {}
    try {
      col.addIndex('idx_produtos_familia', false, 'familia', '')
    } catch (_) {}
    try {
      col.addIndex('idx_produtos_user_id', false, 'user_id', '')
    } catch (_) {}

    app.save(col)

    // 4. Buscar usuário padrão para associar aos registros semeados (se houver)
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

    // 5. Lista dos 44 produtos para UPSERT (codigo, nome, familia, linha, especie_destino)
    var produtosData = [
      // Adsorventes (3)
      {
        codigo: 'BBMY.CO001',
        nome: 'Blink Mycolink',
        familia: 'Adsorventes',
        linha: 'Adsorventes',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BBMY.CO003',
        nome: 'Blink Mycolink P',
        familia: 'Adsorventes',
        linha: 'Adsorventes',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BBMY.CO005',
        nome: 'Blink Mycolink S',
        familia: 'Adsorventes',
        linha: 'Adsorventes',
        especie_destino: 'Multi',
      },

      // Aditivos (2)
      {
        codigo: 'BBMO.BE001',
        nome: 'Blink Mos',
        familia: 'Aditivos',
        linha: 'Aditivos',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BBMO.BE003',
        nome: 'Blink BetaLink',
        familia: 'Aditivos',
        linha: 'Aditivos',
        especie_destino: 'Multi',
      },

      // Minerais Organicos (16)
      {
        codigo: 'BPMI.OR001',
        nome: 'Blink Calcium 17',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMI.OR003',
        nome: 'Blink Calcium 22',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMI.OR005',
        nome: 'Blink Chromium 10',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR007',
        nome: 'Blink Chromium 20',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR009',
        nome: 'Blink Cobalt 10',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMI.OR013',
        nome: 'Blink Copper 17',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR015',
        nome: 'Blink Copper 22',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR017',
        nome: 'Blink Iron 17',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR019',
        nome: 'Blink Iron 22',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR021',
        nome: 'Blink Magnesium 10',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMI.OR025',
        nome: 'Blink Manganese 17',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR027',
        nome: 'Blink Manganese 22',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR029',
        nome: 'Blink Selenium 2.0',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR031',
        nome: 'Blink Selenium 6.0',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR033',
        nome: 'Blink Zinc 17',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMI.OR035',
        nome: 'Blink Zinc 22',
        familia: 'Minerais Organicos',
        linha: 'Minerais',
        especie_destino: 'Multi',
      },

      // Suplementos (9)
      {
        codigo: 'BPMY.ST001',
        nome: 'Blink Ycw',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Multi',
      },
      {
        codigo: 'BPMY.ST003',
        nome: 'Blink Lev 32',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMY.ST005',
        nome: 'Blink Lev 35',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMY.ST007',
        nome: 'Blink Lev 37',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMY.ST009',
        nome: 'Blink Lev 40',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMY.ST013',
        nome: 'Blink Hydro 35',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMY.ST015',
        nome: 'Blink Hydro 37',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BPMY.ST017',
        nome: 'Blink Hydro 40',
        familia: 'Suplementos',
        linha: 'Suplementos',
        especie_destino: 'Ruminantes',
      },

      // Blends (10)
      {
        codigo: 'BBMI.XS001',
        nome: 'Blink Blend Beef',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BBMI.XS003',
        nome: 'Blink Blend Breeder',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BBMI.XS005',
        nome: 'Blink Blend Cattle',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BBMI.XS007',
        nome: 'Blink Blend Dairy',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'Ruminantes',
      },
      {
        codigo: 'BBMI.XS009',
        nome: 'Blink Blend Poultry',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'Aves',
      },
      {
        codigo: 'BBMI.XS011',
        nome: 'Blink Blend Swine',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'Suinos',
      },
      {
        codigo: 'BBMI.XS015',
        nome: 'BlinkBlend Poultry GA',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'Aves',
      },
      {
        codigo: 'BBMI.XS017',
        nome: 'Blink Blend PET',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'PET',
      },
      {
        codigo: 'BBMI.XS019',
        nome: 'BlinkBlend PET SpecialD',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'PET',
      },
      {
        codigo: 'BBMI.XS021',
        nome: 'BlinkBlend Pet CF',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'PET',
      },
      {
        codigo: 'BBMI.XS022',
        nome: 'BlinkBlend Pet ADX',
        familia: 'Blends',
        linha: 'Blends',
        especie_destino: 'PET',
      },
    ]

    var freshCol = app.findCollectionByNameOrId('produtos')
    for (var i = 0; i < produtosData.length; i++) {
      var item = produtosData[i]
      var record = null
      try {
        record = app.findFirstRecordByData('produtos', 'codigo', item.codigo)
      } catch (_) {
        record = null
      }

      if (record) {
        // UPSERT: Atualizar registro existente sem duplicar e sem apagar dados prévios
        record.set('nome', item.nome)
        record.set('familia', item.familia)
        record.set('linha', item.linha)
        record.set('especie_destino', item.especie_destino)
        record.set('ativo', true)
        if (!record.get('user_id') && defaultUserId) {
          record.set('user_id', defaultUserId)
        }
        app.save(record)
      } else {
        // INSERT: Criar novo registro
        var newRecord = new Record(freshCol)
        newRecord.set('codigo', item.codigo)
        newRecord.set('nome', item.nome)
        newRecord.set('familia', item.familia)
        newRecord.set('linha', item.linha)
        newRecord.set('especie_destino', item.especie_destino)
        newRecord.set('ativo', true)
        if (defaultUserId) {
          newRecord.set('user_id', defaultUserId)
        }
        app.save(newRecord)
      }
    }

    // Atualizar registros pré-existentes na base para garantir user_id e campos válidos se vazios
    try {
      var allRecords = app.findRecordsByFilter('produtos', '', '', 200, 0)
      for (var j = 0; j < allRecords.length; j++) {
        var r = allRecords[j]
        var changed = false
        if (!r.get('user_id') && defaultUserId) {
          r.set('user_id', defaultUserId)
          changed = true
        }
        if (changed) {
          app.save(r)
        }
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter não apaga dados já existentes, apenas ajusta se necessário
  },
)
