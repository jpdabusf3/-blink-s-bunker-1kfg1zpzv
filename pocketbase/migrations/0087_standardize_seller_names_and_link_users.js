migrate(
  (app) => {
    // =========================================================================
    // MIGRATION 0087:
    // 1. Decisão 1: Jéssica com acento ("Jessica Dilkin" -> "Jéssica Dilkin")
    // 2. Decisão 2: Welingtom com T ("Welington Alvares" -> "Welingtom Alvares")
    // 3. Decisão 3 & Nomes vazios:
    //    - Preencher `name` vazio das 4 contas de usuário ("Wagner Zacatei", "Rafael Bellusci",
    //      "Rodrigo Gardinal", "Welingtom Alvares")
    //    - Adicionar campo relation `gestao_tecnica_id` na coleção `users` se não existir
    //    - Vincular TODAS as contas de usuário aos seus respectivos registros na gestao_tecnica
    //      (incluindo duplicatas: 2 contas de Rodrigo Gardinal -> registro de Rodrigo Gardinal;
    //       2 contas de Welingtom Alvares -> registro de Welingtom Alvares)
    // 4. Propagação e sincronização:
    //    - Atualizar gestao_tecnica (Jessica Dilkin -> Jéssica Dilkin; Welington Alvares -> Welingtom Alvares)
    //    - Atualizar equipe (Jessica Dilkin -> Jéssica Dilkin; Welington Alvares -> Welingtom Alvares; Felipe Leao -> Felipe Leão)
    //    - Vincular registros de equipe ao user correspondente (equipe.user_id) quando existir
    //    - Sincronizar campos de texto em historico_vendas (vendedor e gestor_tecnico)
    // =========================================================================

    // -------------------------------------------------------------------------
    // 1. Atualizações pontuais em gestao_tecnica
    // -------------------------------------------------------------------------
    try {
      app
        .db()
        .newQuery(
          "UPDATE gestao_tecnica SET nome = 'Jéssica Dilkin' WHERE nome = 'Jessica Dilkin' OR id = '7nvy7cdzqdl01kd'",
        )
        .execute()
    } catch (e) {
      console.log('[Migration 0087] Erro ao atualizar Jéssica Dilkin em gestao_tecnica:', e)
    }

    try {
      app
        .db()
        .newQuery(
          "UPDATE gestao_tecnica SET nome = 'Welingtom Alvares' WHERE nome = 'Welington Alvares' OR id = '3jp9e5ifa134q77'",
        )
        .execute()
    } catch (e) {
      console.log('[Migration 0087] Erro ao atualizar Welingtom Alvares em gestao_tecnica:', e)
    }

    // -------------------------------------------------------------------------
    // 2. Atualizações em equipe
    // -------------------------------------------------------------------------
    try {
      app
        .db()
        .newQuery(
          "UPDATE equipe SET nome = 'Jéssica Dilkin' WHERE nome = 'Jessica Dilkin' OR id = '4h7iwjjlc7wkryd'",
        )
        .execute()
    } catch (e) {
      console.log('[Migration 0087] Erro ao atualizar Jéssica Dilkin em equipe:', e)
    }

    try {
      app
        .db()
        .newQuery(
          "UPDATE equipe SET nome = 'Welingtom Alvares' WHERE nome = 'Welington Alvares' OR id = 'oaz1v2vvva8joti'",
        )
        .execute()
    } catch (e) {
      console.log('[Migration 0087] Erro ao atualizar Welingtom Alvares em equipe:', e)
    }

    try {
      app
        .db()
        .newQuery("UPDATE equipe SET nome = 'Felipe Leão' WHERE nome = 'Felipe Leao'")
        .execute()
    } catch (e) {
      console.log('[Migration 0087] Erro ao atualizar Felipe Leão em equipe:', e)
    }

    // -------------------------------------------------------------------------
    // 3. Garantir campo relation `gestao_tecnica_id` na coleção `users`
    // -------------------------------------------------------------------------
    const gestaoTecnicaCol = app.findCollectionByNameOrId('gestao_tecnica')
    const gestaoTecnicaColId = gestaoTecnicaCol.id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!usersCol.fields.getByName('gestao_tecnica_id')) {
      usersCol.fields.add(
        new RelationField({
          name: 'gestao_tecnica_id',
          collectionId: gestaoTecnicaColId,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        }),
      )
      usersCol.addIndex('idx_users_gestao_tecnica_id', false, 'gestao_tecnica_id', '')
      app.save(usersCol)
      console.log('[Migration 0087] Campo gestao_tecnica_id adicionado na coleção users')
    }

    // -------------------------------------------------------------------------
    // 4. Mapear registros de gestao_tecnica por nome oficial
    // -------------------------------------------------------------------------
    const gtRecords = []
    const batchSize = 200
    let gtOffset = 0
    while (true) {
      const batch = app.findRecordsByFilter('gestao_tecnica', '', 'nome', batchSize, gtOffset)
      if (!batch || batch.length === 0) break
      for (let i = 0; i < batch.length; i++) {
        gtRecords.push(batch[i])
      }
      if (batch.length < batchSize) break
      gtOffset += batchSize
    }

    const gtMapByName = {}
    const gtMapById = {}
    const gtOfficialNames = []

    function normalizeKey(str) {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
    }

    for (let i = 0; i < gtRecords.length; i++) {
      const rec = gtRecords[i]
      const id = rec.getString ? rec.getString('id') : rec.id
      const nome = (rec.getString ? rec.getString('nome') : rec.nome || '').trim()
      if (id && nome) {
        gtMapById[id] = nome
        gtMapByName[normalizeKey(nome)] = id
        if (gtOfficialNames.indexOf(nome) === -1) {
          gtOfficialNames.push(nome)
        }
      }
    }

    // Aliases conhecidos para mapeamento com tolerância
    gtMapByName['jessica dilkin'] = gtMapByName[normalizeKey('Jéssica Dilkin')]
    gtMapByName['welington alvares'] = gtMapByName[normalizeKey('Welingtom Alvares')]
    gtMapByName['felipe leao'] = gtMapByName[normalizeKey('Felipe Leão')]
    gtMapByName['rodrigo garginal'] = gtMapByName[normalizeKey('Rodrigo Gardinal')]

    // -------------------------------------------------------------------------
    // 5. Atualizar Contas de Usuários (`users`):
    //    - Preencher `name` vazio
    //    - Preencher relação `gestao_tecnica_id`
    //    - Vincular duplicatas ao mesmo id de gestao_tecnica
    // -------------------------------------------------------------------------
    // Lista de mapeamento direto por email/id conhecido:
    // f336a4ny0qtw4hs: welingtom.alvares@blinkbiotech.com -> Welingtom Alvares
    // 2rultonla07j7xb: welington.alvares@blinkbiotech.com -> Welingtom Alvares (name vazio -> preencher)
    // i3jvhfdwufuwfe1: rodrigo.Gardinal@blinkbiotech.com  -> Rodrigo Gardinal
    // gee3174a0a6c6qx: rodrigo.gardinal@blinkbiotech.com  -> Rodrigo Gardinal (name vazio -> preencher)
    // jdb6pmr6lxbq224: rafael.bellusci@blinkbiotech.com   -> Rafael Bellusci (name vazio -> preencher)
    // f50x39y2xgcyms5: wagner.zacatei@blinkbiotech.com   -> Wagner Zacatei (name vazio -> preencher)
    // szwef3igi5ics33: felipe.leao@blinkbiotech.com      -> Felipe Leão
    // jazsbqulkj3swff: fernanda.franco@blinkbiotech.com  -> Fernanda Franco
    // zil2gj2xwu1ti6e: jessica.ramos@blinkbiotech.com    -> Jéssica Ramos
    // xhl48ye8ayb8fbu: joaopedro_zoo@hotmail.com         -> João Pedro
    // 7ch2q28y8fpcypk: tais.fauro@blinkbiotech.com       -> Tais Fauro

    const userAccounts = [
      {
        id: '2rultonla07j7xb',
        email: 'welington.alvares@blinkbiotech.com',
        officialName: 'Welingtom Alvares',
      },
      {
        id: 'f336a4ny0qtw4hs',
        email: 'welingtom.alvares@blinkbiotech.com',
        officialName: 'Welingtom Alvares',
      },
      {
        id: 'gee3174a0a6c6qx',
        email: 'rodrigo.gardinal@blinkbiotech.com',
        officialName: 'Rodrigo Gardinal',
      },
      {
        id: 'i3jvhfdwufuwfe1',
        email: 'rodrigo.Gardinal@blinkbiotech.com',
        officialName: 'Rodrigo Gardinal',
      },
      {
        id: 'jdb6pmr6lxbq224',
        email: 'rafael.bellusci@blinkbiotech.com',
        officialName: 'Rafael Bellusci',
      },
      {
        id: 'f50x39y2xgcyms5',
        email: 'wagner.zacatei@blinkbiotech.com',
        officialName: 'Wagner Zacatei',
      },
      {
        id: 'szwef3igi5ics33',
        email: 'felipe.leao@blinkbiotech.com',
        officialName: 'Felipe Leão',
      },
      {
        id: 'jazsbqulkj3swff',
        email: 'fernanda.franco@blinkbiotech.com',
        officialName: 'Fernanda Franco',
      },
      {
        id: 'zil2gj2xwu1ti6e',
        email: 'jessica.ramos@blinkbiotech.com',
        officialName: 'Jéssica Ramos',
      },
      {
        id: 'xhl48ye8ayb8fbu',
        email: 'joaopedro_zoo@hotmail.com',
        officialName: 'João Pedro',
      },
      {
        id: '7ch2q28y8fpcypk',
        email: 'tais.fauro@blinkbiotech.com',
        officialName: 'Tais Fauro',
      },
    ]

    for (let i = 0; i < userAccounts.length; i++) {
      const u = userAccounts[i]
      const gtId = gtMapByName[normalizeKey(u.officialName)] || ''

      try {
        const userRec = app.findFirstRecordByData('users', 'id', u.id)
        let changed = false

        const currentName = userRec.getString('name')
        if (!currentName || currentName.trim() === '' || currentName !== u.officialName) {
          userRec.set('name', u.officialName)
          changed = true
        }

        if (gtId && userRec.getString('gestao_tecnica_id') !== gtId) {
          userRec.set('gestao_tecnica_id', gtId)
          changed = true
        }

        if (changed) {
          app.save(userRec)
          console.log(
            '[Migration 0087] Usuário ' +
              u.email +
              ' atualizado com nome: ' +
              u.officialName +
              ', gestao_tecnica_id: ' +
              gtId,
          )
        }
      } catch (err) {
        // Fallback via SQL
        try {
          app
            .db()
            .newQuery(
              'UPDATE users SET name = {:name}, gestao_tecnica_id = {:gtId} WHERE id = {:id}',
            )
            .bind({
              name: u.officialName,
              gtId: gtId,
              id: u.id,
            })
            .execute()
        } catch (sqlErr) {
          console.log('[Migration 0087] Erro ao atualizar usuário via SQL ' + u.email + ':', sqlErr)
        }
      }
    }

    // -------------------------------------------------------------------------
    // 6. Atualizar campo user_id em `equipe` para vincular ao usuário se aplicável
    // -------------------------------------------------------------------------
    // Mapeamento equipe -> user_id principal (para as contas que têm correspondência)
    const equipeUserMapping = {
      '52flgijdjosvu7m': 'i3jvhfdwufuwfe1', // Rodrigo Gardinal
      kwii4r7mab7si6g: '7ch2q28y8fpcypk', // Tais Fauro
      '7eaodjw7xc8dg53': 'f50x39y2xgcyms5', // Wagner Zacatei
      ow3bc3bqy3xwgey: 'szwef3igi5ics33', // Felipe Leão
      aipsdmwsa7owuo2: 'jdb6pmr6lxbq224', // Rafael Bellusci
      oaz1v2vvva8joti: 'f336a4ny0qtw4hs', // Welingtom Alvares
      rxo1gz5ovha70lu: 'xhl48ye8ayb8fbu', // João Pedro
    }

    for (const eqId in equipeUserMapping) {
      try {
        const eqRec = app.findFirstRecordByData('equipe', 'id', eqId)
        if (eqRec && !eqRec.getString('user_id')) {
          eqRec.set('user_id', equipeUserMapping[eqId])
          app.save(eqRec)
        }
      } catch (_) {
        try {
          app
            .db()
            .newQuery(
              'UPDATE equipe SET user_id = {:userId} WHERE id = {:id} AND (user_id IS NULL OR user_id = "")',
            )
            .bind({ userId: equipeUserMapping[eqId], id: eqId })
            .execute()
        } catch (_) {}
      }
    }

    // -------------------------------------------------------------------------
    // 7. Normalização e sincronização da collection historico_vendas
    // -------------------------------------------------------------------------
    function matchOfficialName(rawText) {
      if (!rawText || !String(rawText).trim()) return ''
      const cleanRaw = String(rawText).trim()
      const normRaw = normalizeKey(cleanRaw)

      // Regras de negócio estritas
      if (normRaw === 'rodrigo garginal') {
        return 'Rodrigo Gardinal'
      }
      if (normRaw === 'jessica dilkin' || normRaw === 'jessica') {
        return 'Jéssica Dilkin'
      }
      if (normRaw === 'jessica ramos') {
        return 'Jéssica Ramos'
      }
      if (normRaw === 'welington alvares' || normRaw === 'wellington alvares') {
        return 'Welingtom Alvares'
      }
      if (normRaw === 'felipe leao') {
        return 'Felipe Leão'
      }

      // Match exato com lista oficial
      for (let i = 0; i < gtOfficialNames.length; i++) {
        if (gtOfficialNames[i] === cleanRaw) return gtOfficialNames[i]
      }

      // Match tolerante sem acento
      for (let i = 0; i < gtOfficialNames.length; i++) {
        if (normalizeKey(gtOfficialNames[i]) === normRaw) {
          return gtOfficialNames[i]
        }
      }

      return cleanRaw
    }

    let hvOffset = 0
    let totalUpdatedHv = 0
    while (true) {
      const batch = app.findRecordsByFilter('historico_vendas', '', '', batchSize, hvOffset)
      if (!batch || batch.length === 0) break

      for (let i = 0; i < batch.length; i++) {
        const record = batch[i]
        const recId = record.getString ? record.getString('id') : record.id
        const vendedorId = record.getString ? record.getString('vendedor_id') : record.vendedor_id
        const gestorId = record.getString
          ? record.getString('gestor_tecnico_id')
          : record.gestor_tecnico_id
        const currentVendedor = (
          record.getString ? record.getString('vendedor') : record.vendedor || ''
        ).trim()
        const currentGestor = (
          record.getString ? record.getString('gestor_tecnico') : record.gestor_tecnico || ''
        ).trim()

        let targetVendedor = currentVendedor
        let targetGestor = currentGestor

        if (vendedorId && gtMapById[vendedorId]) {
          targetVendedor = gtMapById[vendedorId]
        } else if (currentVendedor) {
          targetVendedor = matchOfficialName(currentVendedor)
        }

        if (gestorId && gtMapById[gestorId]) {
          targetGestor = gtMapById[gestorId]
        } else if (currentGestor) {
          targetGestor = matchOfficialName(currentGestor)
        }

        if (targetVendedor !== currentVendedor || targetGestor !== currentGestor) {
          app
            .db()
            .newQuery(
              'UPDATE historico_vendas SET vendedor = {:vendedor}, gestor_tecnico = {:gestor} WHERE id = {:id}',
            )
            .bind({
              vendedor: targetVendedor,
              gestor: targetGestor,
              id: recId,
            })
            .execute()
          totalUpdatedHv++
        }
      }

      if (batch.length < batchSize) break
      hvOffset += batchSize
    }

    console.log(
      '[Migration 0087] Finalizada com sucesso. historico_vendas atualizados: ' + totalUpdatedHv,
    )
  },
  (app) => {
    // Reversão segura se necessário
  },
)
