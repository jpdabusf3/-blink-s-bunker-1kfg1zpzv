migrate(
  (app) => {
    try {
      const metasCol = app.findCollectionByNameOrId('metas')

      // 1. Adicionar campo user_id (relation para _pb_users_auth_) se não existir
      if (!metasCol.fields.getByName('user_id')) {
        metasCol.fields.add(
          new RelationField({
            name: 'user_id',
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
            required: false,
          }),
        )
      }

      // 2. Garantir campos vendedor, segmento, mes, ano, valor_meta
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

      // 3. Atualizar regras de acesso para permitir qualquer usuário autenticado
      // (shared team dataset com visão global liberada)
      metasCol.listRule = "@request.auth.id != ''"
      metasCol.viewRule = "@request.auth.id != ''"
      metasCol.createRule = "@request.auth.id != ''"
      metasCol.updateRule = "@request.auth.id != ''"
      metasCol.deleteRule = "@request.auth.id != ''"

      // 4. Salvar coleção
      app.save(metasCol)

      // 5. Garantir índices
      const reloadedCol = app.findCollectionByNameOrId('metas')
      try {
        reloadedCol.addIndex('idx_metas_user_id', false, 'user_id', '')
      } catch (_) {}
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
      console.log('Erro na migracao 0135_add_user_id_and_rules_to_metas:', err)
      throw err
    }
  },
  (app) => {
    try {
      const metasCol = app.findCollectionByNameOrId('metas')
      try {
        metasCol.removeIndex('idx_metas_user_id')
      } catch (_) {}
      try {
        metasCol.fields.removeByName('user_id')
      } catch (_) {}
      metasCol.listRule = "@request.auth.id != ''"
      metasCol.viewRule = "@request.auth.id != ''"
      metasCol.createRule = "@request.auth.id != ''"
      metasCol.updateRule = "@request.auth.id != ''"
      metasCol.deleteRule = "@request.auth.id != ''"
      app.save(metasCol)
    } catch (_) {}
  },
)
