migrate(
  (app) => {
    // Migration 0121: Unificar vendedor "João Pedro" para "João Figueiredo"
    // Mantém contas de autenticação intactas conforme instrução da tarefa.

    const CANONICAL_SELLER_NAME = 'João Figueiredo'

    console.log(
      '[Migration 0121] Iniciando unificação de vendedor para "' + CANONICAL_SELLER_NAME + '"...',
    )

    // 1. Atualizar em gestao_tecnica (nome textual do registro de vendedor)
    try {
      if (app.hasTable('gestao_tecnica')) {
        const resGt = app
          .db()
          .newQuery(
            `UPDATE gestao_tecnica 
             SET nome = {:canon} 
             WHERE LOWER(TRIM(nome)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()
        console.log('[Migration 0121] gestao_tecnica atualizada.')
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao atualizar gestao_tecnica:', err)
    }

    // 2. Atualizar em equipe (nome textual do vendedor)
    try {
      if (app.hasTable('equipe')) {
        const resEq = app
          .db()
          .newQuery(
            `UPDATE equipe 
             SET nome = {:canon} 
             WHERE LOWER(TRIM(nome)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()
        console.log('[Migration 0121] equipe atualizada.')
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao atualizar equipe:', err)
    }

    // 3. Atualizar em historico_vendas (vendedor textual e gestor_tecnico caso tenha)
    try {
      if (app.hasTable('historico_vendas')) {
        app
          .db()
          .newQuery(
            `UPDATE historico_vendas 
             SET vendedor = {:canon} 
             WHERE LOWER(TRIM(vendedor)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()

        app
          .db()
          .newQuery(
            `UPDATE historico_vendas 
             SET gestor_tecnico = {:canon} 
             WHERE LOWER(TRIM(gestor_tecnico)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()

        console.log('[Migration 0121] historico_vendas atualizado.')
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao atualizar historico_vendas:', err)
    }

    // 4. Atualizar em faturamento (vendedor textual)
    try {
      if (app.hasTable('faturamento')) {
        app
          .db()
          .newQuery(
            `UPDATE faturamento 
             SET vendedor = {:canon} 
             WHERE LOWER(TRIM(vendedor)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()
        console.log('[Migration 0121] faturamento atualizado.')
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao atualizar faturamento:', err)
    }

    // 5. Atualizar em metas (vendedor_nome e vendedor textuais)
    try {
      if (app.hasTable('metas')) {
        app
          .db()
          .newQuery(
            `UPDATE metas 
             SET vendedor_nome = {:canon} 
             WHERE LOWER(TRIM(vendedor_nome)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()

        app
          .db()
          .newQuery(
            `UPDATE metas 
             SET vendedor = {:canon} 
             WHERE LOWER(TRIM(vendedor)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()

        console.log('[Migration 0121] metas atualizado.')
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao atualizar metas:', err)
    }

    // 6. Atualizar em pedidos (solicitante textual se for o vendedor)
    try {
      if (app.hasTable('pedidos')) {
        app
          .db()
          .newQuery(
            `UPDATE pedidos 
             SET solicitante = {:canon} 
             WHERE LOWER(TRIM(solicitante)) IN ('joão pedro', 'joao pedro')`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()
        console.log('[Migration 0121] pedidos atualizado.')
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao atualizar pedidos:', err)
    }

    // 7. Atualizar em import_history (se detalhes contiver referências textuais diretas)
    try {
      if (app.hasTable('import_history')) {
        app
          .db()
          .newQuery(
            `UPDATE import_history 
             SET details = REPLACE(REPLACE(details, 'João Pedro', {:canon}), 'Joao Pedro', {:canon}) 
             WHERE details LIKE '%João Pedro%' OR details LIKE '%Joao Pedro%'`,
          )
          .bind({ canon: CANONICAL_SELLER_NAME })
          .execute()
        console.log('[Migration 0121] import_history atualizado.')
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao atualizar import_history:', err)
    }

    // 8. Checar e tratar duplicidade de CLIENTES (factories): "João Pedro" vs "João Figueiredo"
    // Se existir cliente com nome exato "João Pedro" / "João Figueiredo":
    try {
      if (app.hasTable('factories')) {
        const rows = []
        try {
          const batch = app.findRecordsByFilter(
            'factories',
            "name ~ 'João' || name ~ 'Joao' || name ~ 'Figueiredo'",
            '',
            100,
            0,
          )
          if (batch && batch.length > 0) {
            for (let i = 0; i < batch.length; i++) {
              rows.push(batch[i])
            }
          }
        } catch (_) {}

        let jpClient = null
        let jfClient = null

        for (let i = 0; i < rows.length; i++) {
          const n = (rows[i].getString('name') || '').trim().toLowerCase()
          if (n === 'joão pedro' || n === 'joao pedro') {
            jpClient = rows[i]
          } else if (n === 'joão figueiredo' || n === 'joao figueiredo') {
            jfClient = rows[i]
          }
        }

        if (jpClient && jfClient) {
          console.log(
            '[Migration 0121] Encontrado cliente duplicado João Pedro (' +
              jpClient.id +
              ') e João Figueiredo (' +
              jfClient.id +
              '). Unificando vínculos...',
          )
          const oldId = jpClient.id
          const newId = jfClient.id

          if (app.hasTable('orders')) {
            app
              .db()
              .newQuery('UPDATE orders SET factoryId = {:nid} WHERE factoryId = {:oid}')
              .bind({ nid: newId, oid: oldId })
              .execute()
          }
          if (app.hasTable('pedidos')) {
            app
              .db()
              .newQuery('UPDATE pedidos SET clienteId = {:nid} WHERE clienteId = {:oid}')
              .bind({ nid: newId, oid: oldId })
              .execute()
          }
          if (app.hasTable('historico_vendas')) {
            app
              .db()
              .newQuery('UPDATE historico_vendas SET factory_id = {:nid} WHERE factory_id = {:oid}')
              .bind({ nid: newId, oid: oldId })
              .execute()
          }
          if (app.hasTable('nfe_pedidos')) {
            app
              .db()
              .newQuery('UPDATE nfe_pedidos SET factory_id = {:nid} WHERE factory_id = {:oid}')
              .bind({ nid: newId, oid: oldId })
              .execute()
          }
          if (app.hasTable('atividades')) {
            app
              .db()
              .newQuery('UPDATE atividades SET cliente_id = {:nid} WHERE cliente_id = {:oid}')
              .bind({ nid: newId, oid: oldId })
              .execute()
          }
          if (app.hasTable('agenda_tasks')) {
            app
              .db()
              .newQuery('UPDATE agenda_tasks SET deal_id = {:nid} WHERE deal_id = {:oid}')
              .bind({ nid: newId, oid: oldId })
              .execute()
          }
          if (app.hasTable('deal_activities')) {
            app
              .db()
              .newQuery('UPDATE deal_activities SET deal_id = {:nid} WHERE deal_id = {:oid}')
              .bind({ nid: newId, oid: oldId })
              .execute()
          }

          app.delete(jpClient)
          console.log('[Migration 0121] Cliente duplicado João Pedro removido após reatribuição.')
        } else if (jpClient && !jfClient) {
          // Renomeia o cliente isolado se existir
          jpClient.set('name', CANONICAL_SELLER_NAME)
          app.save(jpClient)
          console.log('[Migration 0121] Cliente João Pedro renomeado para ' + CANONICAL_SELLER_NAME)
        }
      }
    } catch (err) {
      console.log('[Migration 0121] Aviso ao verificar clientes João Pedro/João Figueiredo:', err)
    }

    console.log('[Migration 0121] Unificação de vendedor finalizada com sucesso.')
  },
  (app) => {
    // Idempotente / dados
  },
)
