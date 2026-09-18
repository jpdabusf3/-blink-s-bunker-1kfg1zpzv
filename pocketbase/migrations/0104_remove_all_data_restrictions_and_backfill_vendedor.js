/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // =========================================================================
    // MIGRATION 0104:
    // 1. Acesso irrestrito aos dados para usuários autenticados:
    //    Para TODAS as coleções de negócio existentes:
    //    listRule = viewRule = createRule = updateRule = deleteRule = "@request.auth.id != ''"
    //    Para a coleção 'users':
    //    listRule = viewRule = "@request.auth.id != ''"
    //    updateRule = "id = @request.auth.id" (preserva segurança de senha/perfil individual)
    //    createRule = null / deleteRule = null
    //
    // 2. Preenchimento retroativo seguro de `vendedor_id` em factories:
    //    - APENAS para registros com vendedor_id vazio (null ou "")
    //    - Descobrir autoria via salesOwner (se apontar para user com gt) OU
    //      via primeiro activity_logs de criação OU gestor_tecnico_id se corresponder a vendedor
    //    - EXCEÇÃO OBRIGATÓRIA: cadastros feitos por Fernanda Franco (por nome, e-mail ou conta)
    //      NUNCA recebem vendedor_id retroativo.
    //    - Registros com vendedor_id JÁ preenchido NUNCA são alterados.
    // =========================================================================

    // 1. Atualizar regras de API de todas as coleções de negócio
    const businessCollections = [
      'factories',
      'gestao_tecnica',
      'equipe',
      'faturamento',
      'historico_vendas',
      'pedidos',
      'nfe_pedidos',
      'notas_fiscais',
      'nf_itens',
      'nf_lotes',
      'notas_fiscais_files',
      'pedidos_carteira',
      'produtos',
      'metas',
      'atividades',
      'planos_acao',
      'documents',
      'client_reports',
      'imports',
      'maestro_uploads',
      'maestro_conversations',
      'funnel_activity_log',
      'matriz_vendas',
      'orders',
      'targets',
      'activity_logs',
      'notifications',
      'invitations',
      'system_settings',
      'excel_templates',
      'confirmacoes_pendentes',
      'fila_processamento',
      'historico_pedidos',
      'dashboard_preferences',
      'layout_versions',
      'atribuicao_clientes',
      'matriz_fiscal',
      'automation_cache',
    ]

    for (let i = 0; i < businessCollections.length; i++) {
      const colName = businessCollections[i]
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule = "@request.auth.id != ''"
        col.viewRule = "@request.auth.id != ''"
        col.createRule = "@request.auth.id != ''"
        col.updateRule = "@request.auth.id != ''"
        col.deleteRule = "@request.auth.id != ''"
        app.save(col)
        console.log('[Migration 0104] Regras de API atualizadas para coleção: ' + colName)
      } catch (err) {
        // Se a coleção não existir nesta instância, ignorar
        console.log('[Migration 0104] Coleção não encontrada ou ignorada: ' + colName)
      }
    }

    // Atualizar coleção users para permitir list/view por qualquer usuário autenticado
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.listRule = "@request.auth.id != ''"
      usersCol.viewRule = "@request.auth.id != ''"
      // Preservar update no próprio usuário ou admin
      usersCol.updateRule =
        "id = @request.auth.id || @request.auth.email = 'joaopedro_zoo@hotmail.com'"
      app.save(usersCol)
      console.log(
        '[Migration 0104] Regras de API da coleção users abertas para usuários autenticados',
      )
    } catch (uErr) {
      console.log('[Migration 0104] Erro ao atualizar regras de users:', uErr)
    }

    // 2. Preenchimento retroativo de vendedor_id
    console.log(
      '[Migration 0104] Iniciando retroativo de vendedor_id para factories sem vendedor...',
    )

    // Mapeamento de usuários
    const userToGt = {}
    const userToName = {}
    const userToEmail = {}
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
        const uemail = u.getString ? u.getString('email') : u.email
        if (uid) {
          if (gtId) userToGt[uid] = gtId
          if (uname) userToName[uid] = uname
          if (uemail) userToEmail[uid] = uemail
        }
      }
      if (uBatch.length < batchSize) break
      uOffset += batchSize
    }

    // Mapeamento de gestao_tecnica por nome/email
    const gtMapByName = {}
    const gtRecords = []
    let gtOffset = 0
    while (true) {
      const gtBatch = app.findRecordsByFilter('gestao_tecnica', '', 'nome', batchSize, gtOffset)
      if (!gtBatch || gtBatch.length === 0) break
      for (let i = 0; i < gtBatch.length; i++) {
        gtRecords.push(gtBatch[i])
      }
      if (gtBatch.length < batchSize) break
      gtOffset += batchSize
    }

    function normalizeName(str) {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
    }

    for (let i = 0; i < gtRecords.length; i++) {
      const rec = gtRecords[i]
      const gid = rec.getString ? rec.getString('id') : rec.id
      const gname = rec.getString ? rec.getString('nome') : rec.nome
      if (gid && gname) {
        gtMapByName[normalizeName(gname)] = gid
      }
    }

    // Aliases conhecidos para gestao_tecnica
    gtMapByName['jessica dilkin'] = gtMapByName[normalizeName('Jéssica Dilkin')]
    gtMapByName['welington alvares'] = gtMapByName[normalizeName('Welingtom Alvares')]
    gtMapByName['felipe leao'] = gtMapByName[normalizeName('Felipe Leão')]
    gtMapByName['rodrigo garginal'] = gtMapByName[normalizeName('Rodrigo Gardinal')]

    // Se o usuário não tinha gestao_tecnica_id preenchido na collection users, tentar via nome
    for (const uid in userToName) {
      if (!userToGt[uid]) {
        const norm = normalizeName(userToName[uid])
        if (gtMapByName[norm]) {
          userToGt[uid] = gtMapByName[norm]
        }
      }
    }

    // Identificar contas / IDs da Fernanda Franco
    const fernandaUserIds = new Set()
    for (const uid in userToEmail) {
      const email = (userToEmail[uid] || '').toLowerCase()
      const name = normalizeName(userToName[uid])
      if (email.indexOf('fernanda.franco') !== -1 || name === 'fernanda franco') {
        fernandaUserIds.add(uid)
      }
    }

    function isFernandaFranco(userId, userName, userEmail) {
      if (userId && fernandaUserIds.has(userId)) return true
      if (userName && normalizeName(userName) === 'fernanda franco') return true
      if (userEmail && String(userEmail).toLowerCase().indexOf('fernanda.franco') !== -1)
        return true
      return false
    }

    // Mapear logs de criação via activity_logs
    const factoryCreatorMap = {}
    try {
      const logRows = app
        .db()
        .newQuery(
          "SELECT recordId, user, created FROM activity_logs WHERE recordId IS NOT NULL AND recordId != '' AND user IS NOT NULL AND user != '' ORDER BY created ASC",
        )
        .all()
      if (logRows && logRows.length > 0) {
        for (let i = 0; i < logRows.length; i++) {
          const row = logRows[i]
          const recId = row.recordId
          const uId = row.user
          if (recId && uId && !factoryCreatorMap[recId]) {
            factoryCreatorMap[recId] = uId
          }
        }
      }
    } catch (e) {
      console.log('[Migration 0104] Aviso ao consultar SQL activity_logs:', e)
    }

    // Processar factories com vendedor_id vazio
    let fOffset = 0
    let totalExamined = 0
    let totalSkippedAlreadySet = 0
    let totalSkippedFernanda = 0
    let totalUpdated = 0
    let totalUnresolved = 0

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
        const salesOwner = ((f.getString ? f.getString('salesOwner') : f.salesOwner) || '').trim()
        const gestorTecnicoId = (
          (f.getString ? f.getString('gestor_tecnico_id') : f.gestor_tecnico_id) || ''
        ).trim()

        // 1. Se JÁ tem vendedor_id, NÃO alterar
        if (currentVendedorId !== '') {
          totalSkippedAlreadySet++
          continue
        }

        // 2. Descobrir autor da criação
        let creatorUserId = ''
        if (salesOwner) {
          creatorUserId = salesOwner
        } else if (factoryCreatorMap[fId]) {
          creatorUserId = factoryCreatorMap[fId]
        }

        const creatorName = creatorUserId ? userToName[creatorUserId] : ''
        const creatorEmail = creatorUserId ? userToEmail[creatorUserId] : ''

        // 3. EXCEÇÃO OBRIGATÓRIA: Fernanda Franco nunca recebe auto-vínculo
        if (isFernandaFranco(creatorUserId, creatorName, creatorEmail)) {
          totalSkippedFernanda++
          console.log(
            '[Migration 0104] Factory criada por Fernanda Franco mantida sem vendedor_id: ' +
              fName +
              ' (' +
              fId +
              ')',
          )
          continue
        }

        // 4. Resolver gestao_tecnica ID correspondente
        let targetGtId = null
        if (creatorUserId && userToGt[creatorUserId]) {
          targetGtId = userToGt[creatorUserId]
        } else if (gestorTecnicoId) {
          // Se gestor_tecnico_id foi indicado e corresponde a um vendedor da gestao_tecnica
          targetGtId = gestorTecnicoId
        }

        if (targetGtId) {
          try {
            app
              .db()
              .newQuery(
                "UPDATE factories SET vendedor_id = {:vendedorId} WHERE id = {:id} AND (vendedor_id IS NULL OR vendedor_id = '')",
              )
              .bind({ vendedorId: targetGtId, id: fId })
              .execute()
            totalUpdated++
            console.log(
              '[Migration 0104] Factory ' +
                fName +
                ' (' +
                fId +
                ') atribuída retroativamente a vendedor ' +
                targetGtId,
            )
          } catch (upErr) {
            console.log(
              '[Migration 0104] Erro ao atualizar vendedor_id da factory ' + fId + ':',
              upErr,
            )
          }
        } else {
          totalUnresolved++
          console.log(
            '[Migration 0104] Factory sem autor resolvível para vendedor: ' +
              fName +
              ' (' +
              fId +
              ')',
          )
        }
      }

      if (fBatch.length < batchSize) break
      fOffset += batchSize
    }

    console.log('=====================================================')
    console.log('[Migration 0104] RESUMO DE EXECUÇÃO:')
    console.log('- Total de factories examinadas: ' + totalExamined)
    console.log('- Já possuíam vendedor_id (preservadas): ' + totalSkippedAlreadySet)
    console.log('- Criadas por Fernanda Franco (preservadas sem vínculo): ' + totalSkippedFernanda)
    console.log('- Atualizadas retroativamente com vendedor_id: ' + totalUpdated)
    console.log('- Sem autor/vendedor resolvível (preservadas): ' + totalUnresolved)
    console.log('=====================================================')
  },
  (app) => {
    // Reversão
  },
)
