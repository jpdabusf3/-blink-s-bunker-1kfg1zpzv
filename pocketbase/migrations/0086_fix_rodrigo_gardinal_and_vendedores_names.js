migrate(
  (app) => {
    // 1. Atualizar gestao_tecnica id 'vscx4eb1s06fuiy' (Rodrigo Garginal -> Rodrigo Gardinal)
    try {
      const gtRecord = app.findFirstRecordByData('gestao_tecnica', 'id', 'vscx4eb1s06fuiy')
      if (gtRecord && gtRecord.getString('nome') !== 'Rodrigo Gardinal') {
        gtRecord.set('nome', 'Rodrigo Gardinal')
        app.save(gtRecord)
        console.log(
          '[Migration 0086] gestao_tecnica vscx4eb1s06fuiy atualizado para Rodrigo Gardinal',
        )
      }
    } catch (e) {
      // Fallback via SQL se findFirstRecordByData lançar
      try {
        app
          .db()
          .newQuery(
            "UPDATE gestao_tecnica SET nome = 'Rodrigo Gardinal' WHERE id = 'vscx4eb1s06fuiy'",
          )
          .execute()
      } catch (err) {
        console.log('[Migration 0086] Aviso ao atualizar gestao_tecnica vscx4eb1s06fuiy:', err)
      }
    }

    // Também corrigir qualquer outro registro em gestao_tecnica com nome 'Rodrigo Garginal'
    try {
      app
        .db()
        .newQuery(
          "UPDATE gestao_tecnica SET nome = 'Rodrigo Gardinal' WHERE nome = 'Rodrigo Garginal'",
        )
        .execute()
    } catch (_) {}

    // 2. Atualizar equipe id '52flgijdjosvu7m' (Rodrigo Garginal -> Rodrigo Gardinal)
    try {
      const eqRecord = app.findFirstRecordByData('equipe', 'id', '52flgijdjosvu7m')
      if (eqRecord && eqRecord.getString('nome') !== 'Rodrigo Gardinal') {
        eqRecord.set('nome', 'Rodrigo Gardinal')
        app.save(eqRecord)
        console.log('[Migration 0086] equipe 52flgijdjosvu7m atualizado para Rodrigo Gardinal')
      }
    } catch (e) {
      try {
        app
          .db()
          .newQuery("UPDATE equipe SET nome = 'Rodrigo Gardinal' WHERE id = '52flgijdjosvu7m'")
          .execute()
      } catch (err) {
        console.log('[Migration 0086] Aviso ao atualizar equipe 52flgijdjosvu7m:', err)
      }
    }

    // Também corrigir qualquer outro registro em equipe com nome 'Rodrigo Garginal'
    try {
      app
        .db()
        .newQuery("UPDATE equipe SET nome = 'Rodrigo Gardinal' WHERE nome = 'Rodrigo Garginal'")
        .execute()
    } catch (_) {}

    // 3. Normalização e sincronização da collection historico_vendas
    // Obter todos os membros oficiais da gestao_tecnica
    const gtMembers = []
    const batchSize = 200
    let gtOffset = 0
    while (true) {
      const batch = app.findRecordsByFilter('gestao_tecnica', '', 'nome', batchSize, gtOffset)
      if (!batch || batch.length === 0) break
      for (let i = 0; i < batch.length; i++) {
        gtMembers.push(batch[i])
      }
      if (batch.length < batchSize) break
      gtOffset += batchSize
    }

    const gtMapById = {}
    const gtOfficialNames = []

    for (let i = 0; i < gtMembers.length; i++) {
      const m = gtMembers[i]
      const id = m.getString ? m.getString('id') : m.id
      const nome = (m.getString ? m.getString('nome') : m.nome || '').trim()
      if (id && nome) {
        gtMapById[id] = nome
        if (gtOfficialNames.indexOf(nome) === -1) {
          gtOfficialNames.push(nome)
        }
      }
    }

    function removeAccents(str) {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
    }

    function matchOfficialName(rawText) {
      if (!rawText || !String(rawText).trim()) return ''
      const cleanRaw = String(rawText).trim()
      const normRaw = removeAccents(cleanRaw)

      // Especial: caso venha Garginal, mapeia para Rodrigo Gardinal
      if (normRaw === 'rodrigo garginal') {
        return 'Rodrigo Gardinal'
      }

      // Match exato
      for (let i = 0; i < gtOfficialNames.length; i++) {
        if (gtOfficialNames[i] === cleanRaw) return gtOfficialNames[i]
      }

      // Match sem acento e case insensitive
      for (let i = 0; i < gtOfficialNames.length; i++) {
        if (removeAccents(gtOfficialNames[i]) === normRaw) {
          return gtOfficialNames[i]
        }
      }

      // Se não houver correspondência exata ou tolerante, mantém o valor original
      return cleanRaw
    }

    // Carregar todos os registros de historico_vendas
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

        // Se vendedor_id estiver preenchido, sincronizar com o nome do registro na gestao_tecnica
        if (vendedorId && gtMapById[vendedorId]) {
          targetVendedor = gtMapById[vendedorId]
        } else if (currentVendedor) {
          // Matching tolerante (e.g. "Felipe Leao" -> "Felipe Leão", "Rodrigo Garginal" -> "Rodrigo Gardinal")
          targetVendedor = matchOfficialName(currentVendedor)
        }

        // Se gestor_tecnico_id estiver preenchido, sincronizar com o nome do registro na gestao_tecnica
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
      '[Migration 0086] Concluída com sucesso. Registros de historico_vendas atualizados: ' +
        totalUpdatedHv,
    )
  },
  (app) => {
    // Migração de correção de dados; down idempotente / no-op
  },
)
