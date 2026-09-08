migrate(
  (app) => {
    // =========================================================================
    // MIGRATION 0088:
    // Vincular clientes cadastrados (factories) ao vendedor Rodrigo Gardinal
    // (id 'vscx4eb1s06fuiy') de forma idempotente e preservando dados existentes.
    //
    // Regras:
    // 1. Para cada factory onde:
    //    - salesOwner aponta para uma das contas do Rodrigo ('i3jvhfdwufuwfe1' ou 'gee3174a0a6c6qx')
    //    - OU gestor_tecnico_id = 'vscx4eb1s06fuiy'
    //    - OU algum campo de texto de vendedor contenha "Rodrigo Gardinal" (case/acento-insensitive)
    // 2. SE vendedor_id estiver VAZIO (null ou ''), preencher com 'vscx4eb1s06fuiy'.
    // 3. SE vendedor_id já estiver preenchido com OUTRO vendedor (ex: 4urt19q2phjs7fn João Pedro,
    //    70blgokot9e8m8y Jéssica Dilkin, etc.), NÃO sobrescrever!
    // 4. Não alterar coleções de usuários, gestao_tecnica nem historico_vendas.
    // =========================================================================

    const RODRIGO_GT_ID = 'vscx4eb1s06fuiy'
    const RODRIGO_USER_IDS = ['i3jvhfdwufuwfe1', 'gee3174a0a6c6qx']

    // Buscar factories em batches
    const batchSize = 100
    let offset = 0
    let updatedCount = 0

    while (true) {
      const records = app.findRecordsByFilter('factories', '', 'created', batchSize, offset)
      if (!records || records.length === 0) break

      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        const recId = record.getString ? record.getString('id') : record.id
        const currentVendedorId = (
          record.getString ? record.getString('vendedor_id') : record.vendedor_id || ''
        ).trim()
        const currentGestorId = (
          record.getString ? record.getString('gestor_tecnico_id') : record.gestor_tecnico_id || ''
        ).trim()
        const currentSalesOwner = (
          record.getString ? record.getString('salesOwner') : record.salesOwner || ''
        ).trim()
        const currentVendedorName = (
          record.getString ? record.getString('vendedor_name') : record.vendedor_name || ''
        ).trim()

        // Se vendedor_id já está preenchido, respeitar (não sobrescrever)
        if (currentVendedorId !== '') {
          continue
        }

        // Verificar se este cliente está vinculado ao Rodrigo por algum dos critérios:
        const isSalesOwnerRodrigo = RODRIGO_USER_IDS.indexOf(currentSalesOwner) !== -1
        const isGestorRodrigo = currentGestorId === RODRIGO_GT_ID
        const isNameRodrigo =
          currentVendedorName.toLowerCase().indexOf('rodrigo gardinal') !== -1 ||
          currentVendedorName.toLowerCase().indexOf('rodrigo garginal') !== -1

        if (isSalesOwnerRodrigo || isGestorRodrigo || isNameRodrigo) {
          // Preencher vendedor_id com o id do Rodrigo Gardinal na gestao_tecnica
          try {
            record.set('vendedor_id', RODRIGO_GT_ID)
            app.save(record)
            updatedCount++
          } catch (err) {
            // Fallback via SQL direto caso validação de schema falhe por campo opcional antigo
            try {
              app
                .db()
                .newQuery(
                  "UPDATE factories SET vendedor_id = {:vendedorId} WHERE id = {:id} AND (vendedor_id IS NULL OR vendedor_id = '')",
                )
                .bind({ vendedorId: RODRIGO_GT_ID, id: recId })
                .execute()
              updatedCount++
            } catch (sqlErr) {
              console.log('[Migration 0088] Erro ao atualizar factory ' + recId + ':', sqlErr)
            }
          }
        }
      }

      if (records.length < batchSize) break
      offset += batchSize
    }

    console.log(
      '[Migration 0088] Vinculação concluída. Total de factories atualizadas para Rodrigo Gardinal: ' +
        updatedCount,
    )
  },
  (app) => {
    // Reversão segura se necessário (não reverter para evitar desvincular alterações manuais posteriores)
  },
)
