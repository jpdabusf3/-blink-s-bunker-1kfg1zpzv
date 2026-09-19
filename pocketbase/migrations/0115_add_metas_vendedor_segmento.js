migrate(
  (app) => {
    try {
      const metasCol = app.findCollectionByNameOrId('metas')

      // 1. Adicionar campo vendedor (text) se não existir
      if (!metasCol.fields.getByName('vendedor')) {
        metasCol.fields.add(
          new TextField({
            name: 'vendedor',
            required: false,
          }),
        )
      }

      // 2. Adicionar campo segmento (text) se não existir
      if (!metasCol.fields.getByName('segmento')) {
        metasCol.fields.add(
          new TextField({
            name: 'segmento',
            required: false,
          }),
        )
      }

      // 3. Adicionar campo mes (number) se não existir
      if (!metasCol.fields.getByName('mes')) {
        metasCol.fields.add(
          new NumberField({
            name: 'mes',
            onlyInt: true,
            min: 1,
            max: 12,
            required: false,
          }),
        )
      }

      // 4. Adicionar campo ano (number) se não existir
      if (!metasCol.fields.getByName('ano')) {
        metasCol.fields.add(
          new NumberField({
            name: 'ano',
            onlyInt: true,
            required: false,
          }),
        )
      }

      // 5. Adicionar campo valor_meta (number) se não existir
      if (!metasCol.fields.getByName('valor_meta')) {
        metasCol.fields.add(
          new NumberField({
            name: 'valor_meta',
            required: false,
          }),
        )
      }

      // Salvar os novos campos na collection primeiro
      app.save(metasCol)

      // 6. Preencher dados retrocompatíveis nos registros existentes:
      // se periodo for '2026-09', extrair ano=2026, mes=9
      // se vendedor_nome existir, preencher vendedor
      // sincronizar valor_meta com meta_valor
      try {
        app
          .db()
          .newQuery(
            `
          UPDATE metas
          SET
            vendedor = COALESCE(NULLIF(vendedor, ''), NULLIF(vendedor_nome, ''), 'Rodrigo Gardinal'),
            segmento = COALESCE(NULLIF(segmento, ''), 'RUMINANTES'),
            ano = CASE
              WHEN ano IS NOT NULL AND ano > 0 THEN ano
              WHEN periodo LIKE '____-__' THEN CAST(SUBSTR(periodo, 1, 4) AS INTEGER)
              ELSE 2026
            END,
            mes = CASE
              WHEN mes IS NOT NULL AND mes > 0 THEN mes
              WHEN periodo LIKE '____-__' THEN CAST(SUBSTR(periodo, 6, 2) AS INTEGER)
              ELSE 9
            END,
            valor_meta = CASE
              WHEN valor_meta IS NOT NULL AND valor_meta > 0 THEN valor_meta
              WHEN meta_valor IS NOT NULL AND meta_valor > 0 THEN meta_valor
              ELSE 0
            END,
            meta_valor = CASE
              WHEN meta_valor IS NOT NULL AND meta_valor > 0 THEN meta_valor
              WHEN valor_meta IS NOT NULL AND valor_meta > 0 THEN valor_meta
              ELSE 0
            END
        `,
          )
          .execute()
      } catch (errBackfill) {
        console.log('Aviso ao sincronizar campos retrocompatíveis:', errBackfill)
      }

      // 7. Deduplicar caso haja múltiplos registros idênticos para vendedor, segmento, mes, ano
      try {
        app
          .db()
          .newQuery(
            `
          DELETE FROM metas
          WHERE id NOT IN (
            SELECT MIN(id) FROM metas GROUP BY vendedor, segmento, mes, ano
          )
          AND vendedor IS NOT NULL AND vendedor != ''
          AND segmento IS NOT NULL AND segmento != ''
          AND mes IS NOT NULL AND ano IS NOT NULL
        `,
          )
          .execute()
      } catch (errDedupe) {
        console.log('Aviso ao deduplicar metas:', errDedupe)
      }

      // 8. Adicionar índices:
      // Índice composto (mes, ano)
      // Constraint única em (vendedor, segmento, mes, ano)
      const reloadedCol = app.findCollectionByNameOrId('metas')
      reloadedCol.addIndex('idx_metas_mes_ano', false, 'mes, ano', '')
      reloadedCol.addIndex(
        'idx_metas_vendedor_segmento_mes_ano',
        true,
        'vendedor, segmento, mes, ano',
        '',
      )

      app.save(reloadedCol)
    } catch (err) {
      console.log('Erro na migracao 0115_add_metas_vendedor_segmento:', err)
      throw err
    }
  },
  (app) => {
    try {
      const metasCol = app.findCollectionByNameOrId('metas')
      metasCol.removeIndex('idx_metas_mes_ano')
      metasCol.removeIndex('idx_metas_vendedor_segmento_mes_ano')
      app.save(metasCol)
    } catch (_) {}
  },
)
