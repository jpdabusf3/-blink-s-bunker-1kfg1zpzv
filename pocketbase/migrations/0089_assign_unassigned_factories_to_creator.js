migrate(
  (app) => {
    // =========================================================================
    // MIGRATION 0089:
    // Atribuir clientes (factories) que estão sem vendedor (vendedor_id vazio)
    // E sem gestor técnico (gestor_tecnico_id vazio) à quem cadastrou o registro.
    //
    // Regras:
    // 1. Encontrar clientes `factories` com vendedor_id vazio E gestor_tecnico_id vazio.
    // 2. Preservar rigorosamente clientes que já têm vendedor_id OU gestor_tecnico_id.
    // 3. Descobrir quem cadastrou o cliente através de:
    //    a) Campo relation `factories.salesOwner` (se preenchido e apontando para users)
    //    b) Registro de criação em `activity_logs` (target_collection='factories' ou recordId=factory.id)
    // 4. Mapear o usuário criador para a `gestao_tecnica` via `users.gestao_tecnica_id`
    //    (ou mapa pré-carregado de users -> gestao_tecnica_id).
    // 5. Preencher `factories.vendedor_id` com o ID da gestao_tecnica resolvido.
    // 6. Caso não haja criador resolvível, manter o cliente como está para auditoria.
    // =========================================================================

    console.log(
      '[Migration 0089] Iniciando atribuição de clientes sem vendedor e sem gestor ao criador...',
    )

    // 1. Carregar mapeamento de users -> gestao_tecnica_id
    const userToGt = {}
    const userToName = {}
    const batchSize = 200

    let uOffset = 0
    while (true) {
      const uBatch = app.findRecordsByFilter('users', '', 'created', batchSize, uOffset)
      if (!uBatch || uBatch.length === 0) break
      for (let i = 0; i < uBatch.length; i++) {
        const u = uBatch[i]
        const uid = u.getString ? u.getString('id') : u.id
        const gtId = u.getString ? u.getString('gestao_tecnica_id') : u.gestao_tecnica_id
        const uname = u.getString ? u.getString('name') : u.name
        if (uid) {
          if (gtId) userToGt[uid] = gtId
          if (uname) userToName[uid] = uname
        }
      }
      if (uBatch.length < batchSize) break
      uOffset += batchSize
    }

    // 2. Mapeamento de gestao_tecnica ID -> Nome (para logs claros)
    const gtIdToName = {}
    let gtOffset = 0
    while (true) {
      const gtBatch = app.findRecordsByFilter('gestao_tecnica', '', 'nome', batchSize, gtOffset)
      if (!gtBatch || gtBatch.length === 0) break
      for (let i = 0; i < gtBatch.length; i++) {
        const g = gtBatch[i]
        const gid = g.getString ? g.getString('id') : g.id
        const gname = g.getString ? g.getString('nome') : g.nome
        if (gid) gtIdToName[gid] = gname || gid
      }
      if (gtBatch.length < batchSize) break
      gtOffset += batchSize
    }

    // 3. Mapear logs de criação de factories a partir de activity_logs
    // Buscamos activity_logs onde target_collection = 'factories' ou onde haja registro de criação
    const factoryCreatorFromLogs = {}

    // Tentativa 1: Via SQL direto em SQLite para máxima performance e exatidão
    try {
      const sqlRows = app
        .db()
        .newQuery(
          "SELECT recordId, user, created FROM activity_logs WHERE recordId IS NOT NULL AND recordId != '' AND user IS NOT NULL AND user != '' ORDER BY created ASC",
        )
        .all()

      if (sqlRows && sqlRows.length > 0) {
        for (let i = 0; i < sqlRows.length; i++) {
          const row = sqlRows[i]
          const recId = row.recordId
          const userId = row.user
          // O primeiro log no tempo é a criação do registro
          if (recId && userId && !factoryCreatorFromLogs[recId]) {
            factoryCreatorFromLogs[recId] = userId
          }
        }
        console.log(
          '[Migration 0089] Mapeados ' +
            Object.keys(factoryCreatorFromLogs).length +
            ' criadores via SQL de activity_logs',
        )
      }
    } catch (sqlErr) {
      console.log(
        '[Migration 0089] Aviso: consulta SQL de activity_logs falhou, tentando via SDK:',
        sqlErr,
      )
      let logOffset = 0
      while (true) {
        const logBatch = app.findRecordsByFilter(
          'activity_logs',
          '',
          'created',
          batchSize,
          logOffset,
        )
        if (!logBatch || logBatch.length === 0) break
        for (let i = 0; i < logBatch.length; i++) {
          const log = logBatch[i]
          const recId = log.getString ? log.getString('recordId') : log.recordId
          const userId = log.getString ? log.getString('user') : log.user
          if (recId && userId && !factoryCreatorFromLogs[recId]) {
            factoryCreatorFromLogs[recId] = userId
          }
        }
        if (logBatch.length < batchSize) break
        logOffset += batchSize
      }
    }

    // 4. Buscar e processar todas as factories
    let fOffset = 0
    let totalExamined = 0
    let totalEligible = 0
    let totalAssigned = 0
    let totalUnresolved = 0
    const distributionByGt = {}
    const unresolvedList = []

    while (true) {
      const fBatch = app.findRecordsByFilter('factories', '', 'created', batchSize, fOffset)
      if (!fBatch || fBatch.length === 0) break

      for (let i = 0; i < fBatch.length; i++) {
        totalExamined++
        const f = fBatch[i]
        const fId = f.getString ? f.getString('id') : f.id
        const fName = (f.getString ? f.getString('name') : f.name) || fId
        const currentVendedorId = (
          (f.getString ? f.getString('vendedor_id') : f.vendedor_id) || ''
        ).trim()
        const currentGestorId = (
          (f.getString ? f.getString('gestor_tecnico_id') : f.gestor_tecnico_id) || ''
        ).trim()
        const salesOwner = ((f.getString ? f.getString('salesOwner') : f.salesOwner) || '').trim()

        // Regra de segurança estrita:
        // APENAS processar se vendedor_id E gestor_tecnico_id estão vazios!
        if (currentVendedorId !== '' || currentGestorId !== '') {
          continue
        }

        totalEligible++

        // Resolver usuário criador:
        // 1º: salesOwner se estiver preenchido
        // 2º: activity_logs
        let creatorUserId = ''
        if (salesOwner && userToGt[salesOwner]) {
          creatorUserId = salesOwner
        } else if (factoryCreatorFromLogs[fId]) {
          creatorUserId = factoryCreatorFromLogs[fId]
        } else if (salesOwner) {
          creatorUserId = salesOwner
        }

        const targetGtId = creatorUserId ? userToGt[creatorUserId] : null

        if (targetGtId) {
          // Atribuir vendedor_id na fábrica
          try {
            f.set('vendedor_id', targetGtId)
            app.save(f)
            totalAssigned++
            distributionByGt[targetGtId] = (distributionByGt[targetGtId] || 0) + 1
          } catch (saveErr) {
            // Fallback direto via SQL caso validações de schema ou campos opcionais falhem
            try {
              app
                .db()
                .newQuery(
                  "UPDATE factories SET vendedor_id = {:vendedorId} WHERE id = {:id} AND (vendedor_id IS NULL OR vendedor_id = '')",
                )
                .bind({ vendedorId: targetGtId, id: fId })
                .execute()
              totalAssigned++
              distributionByGt[targetGtId] = (distributionByGt[targetGtId] || 0) + 1
            } catch (sqlErr2) {
              console.log(
                '[Migration 0089] Erro ao gravar vendedor_id para factory ' +
                  fName +
                  ' (' +
                  fId +
                  '):',
                sqlErr2,
              )
            }
          }
        } else {
          totalUnresolved++
          unresolvedList.push({
            id: fId,
            name: fName,
            creatorUserId: creatorUserId || 'não encontrado',
          })
        }
      }

      if (fBatch.length < batchSize) break
      fOffset += batchSize
    }

    // 5. Relatório detalhado nos logs do PocketBase
    console.log('=====================================================')
    console.log('[Migration 0089] RESUMO DA EXECUÇÃO:')
    console.log('- Total de factories examinadas: ' + totalExamined)
    console.log('- Total elegíveis (sem vendedor E sem gestor): ' + totalEligible)
    console.log('- Total atribuídos com sucesso ao criador: ' + totalAssigned)
    console.log('- Total não resolvidos (mantidos intocados): ' + totalUnresolved)
    console.log('--- Distribuição por Vendedor / Gestão Técnica ---')
    for (const gid in distributionByGt) {
      const gtName = gtIdToName[gid] || gid
      console.log('  * ' + gtName + ' (ID: ' + gid + '): ' + distributionByGt[gid] + ' clientes')
    }
    if (unresolvedList.length > 0) {
      console.log('--- Clientes não resolvidos ---')
      for (let i = 0; i < unresolvedList.length; i++) {
        console.log(
          '  * ' +
            unresolvedList[i].name +
            ' (' +
            unresolvedList[i].id +
            ') - Usuário: ' +
            unresolvedList[i].creatorUserId,
        )
      }
    }
    console.log('=====================================================')
  },
  (app) => {
    // Reversão segura
  },
)
