migrate(
  (app) => {
    try {
      const metasCol = app.findCollectionByNameOrId('metas')

      // Garantir campos vendedor, segmento, mes, ano, valor_meta
      if (!metasCol.fields.getByName('vendedor')) {
        metasCol.fields.add(
          new TextField({
            name: 'vendedor',
            required: false,
          }),
        )
      }

      if (!metasCol.fields.getByName('segmento')) {
        metasCol.fields.add(
          new TextField({
            name: 'segmento',
            required: false,
          }),
        )
      }

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

      if (!metasCol.fields.getByName('ano')) {
        metasCol.fields.add(
          new NumberField({
            name: 'ano',
            onlyInt: true,
            required: false,
          }),
        )
      }

      if (!metasCol.fields.getByName('valor_meta')) {
        metasCol.fields.add(
          new NumberField({
            name: 'valor_meta',
            required: false,
          }),
        )
      }

      // Regras de acesso: qualquer usuário autenticado pode listar, visualizar, criar, atualizar e excluir
      metasCol.listRule = "@request.auth.id != ''"
      metasCol.viewRule = "@request.auth.id != ''"
      metasCol.createRule = "@request.auth.id != ''"
      metasCol.updateRule = "@request.auth.id != ''"
      metasCol.deleteRule = "@request.auth.id != ''"

      app.save(metasCol)

      // Garantir índices mes+ano e unique (vendedor, segmento, mes, ano)
      const reloadedCol = app.findCollectionByNameOrId('metas')
      try {
        reloadedCol.addIndex('idx_metas_mes_ano', false, 'mes, ano', '')
      } catch (_) {}
      try {
        reloadedCol.addIndex(
          'idx_metas_vendedor_segmento_mes_ano',
          true,
          'vendedor, segmento, mes, ano',
          '',
        )
      } catch (_) {}

      app.save(reloadedCol)
    } catch (err) {
      console.log('Erro na migracao 0136_ensure_metas_collection_rules_and_indexes:', err)
      throw err
    }
  },
  (app) => {
    // No-op rollback
  },
)
