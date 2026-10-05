migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Criar coleção entity_change_logs para auditoria de produtos, vendedores, faturamento, etc.
    if (!app.hasTable('entity_change_logs')) {
      const collection = new Collection({
        name: 'entity_change_logs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'entity_type',
            type: 'text',
            required: true,
          },
          {
            name: 'entity_id',
            type: 'text',
            required: true,
          },
          {
            name: 'entity_name',
            type: 'text',
            required: false,
          },
          {
            name: 'user_id',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'user_name',
            type: 'text',
            required: false,
          },
          {
            name: 'field',
            type: 'text',
            required: false,
          },
          {
            name: 'old_value',
            type: 'text',
            required: false,
          },
          {
            name: 'new_value',
            type: 'text',
            required: false,
          },
          {
            name: 'change_summary',
            type: 'text',
            required: false,
          },
          {
            name: 'action',
            type: 'select',
            required: false,
            values: ['create', 'update', 'delete', 'deactivate', 'restore'],
            maxSelect: 1,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_entity_change_logs_entity ON entity_change_logs (entity_type, entity_id)',
          'CREATE INDEX idx_entity_change_logs_created ON entity_change_logs (created DESC)',
        ],
      })
      app.save(collection)
    }

    // 2. Adicionar batch_id e campos de soft-delete/origem em faturamento
    const fatCol = app.findCollectionByNameOrId('faturamento')
    if (!fatCol.fields.getByName('batch_id')) {
      fatCol.fields.add(new TextField({ name: 'batch_id' }))
    }
    if (!fatCol.fields.getByName('origem')) {
      fatCol.fields.add(new TextField({ name: 'origem' }))
    }
    if (!fatCol.fields.getByName('is_deleted')) {
      fatCol.fields.add(new BoolField({ name: 'is_deleted' }))
    }
    if (!fatCol.fields.getByName('deleted_at')) {
      fatCol.fields.add(new DateField({ name: 'deleted_at' }))
    }
    app.save(fatCol)

    // 3. Adicionar batch_id e campos de soft-delete em historico_vendas
    const hvCol = app.findCollectionByNameOrId('historico_vendas')
    if (!hvCol.fields.getByName('batch_id')) {
      hvCol.fields.add(new TextField({ name: 'batch_id' }))
    }
    if (!hvCol.fields.getByName('is_deleted')) {
      hvCol.fields.add(new BoolField({ name: 'is_deleted' }))
    }
    if (!hvCol.fields.getByName('deleted_at')) {
      hvCol.fields.add(new DateField({ name: 'deleted_at' }))
    }
    app.save(hvCol)

    // 4. Adicionar is_deleted e deleted_at em factories, produtos, gestao_tecnica
    const factoriesCol = app.findCollectionByNameOrId('factories')
    if (!factoriesCol.fields.getByName('is_deleted')) {
      factoriesCol.fields.add(new BoolField({ name: 'is_deleted' }))
    }
    if (!factoriesCol.fields.getByName('deleted_at')) {
      factoriesCol.fields.add(new DateField({ name: 'deleted_at' }))
    }
    app.save(factoriesCol)

    const produtosCol = app.findCollectionByNameOrId('produtos')
    if (!produtosCol.fields.getByName('is_deleted')) {
      produtosCol.fields.add(new BoolField({ name: 'is_deleted' }))
    }
    if (!produtosCol.fields.getByName('deleted_at')) {
      produtosCol.fields.add(new DateField({ name: 'deleted_at' }))
    }
    app.save(produtosCol)

    const gestaoCol = app.findCollectionByNameOrId('gestao_tecnica')
    if (!gestaoCol.fields.getByName('is_deleted')) {
      gestaoCol.fields.add(new BoolField({ name: 'is_deleted' }))
    }
    if (!gestaoCol.fields.getByName('deleted_at')) {
      gestaoCol.fields.add(new DateField({ name: 'deleted_at' }))
    }
    app.save(gestaoCol)

    // 5. Adicionar batch_id em import_history caso não exista
    const ihCol = app.findCollectionByNameOrId('import_history')
    if (!ihCol.fields.getByName('batch_id')) {
      ihCol.fields.add(new TextField({ name: 'batch_id' }))
    }
    if (!ihCol.fields.getByName('can_rollback')) {
      ihCol.fields.add(new BoolField({ name: 'can_rollback' }))
    }
    if (!ihCol.fields.getByName('rolled_back_at')) {
      ihCol.fields.add(new DateField({ name: 'rolled_back_at' }))
    }
    if (!ihCol.fields.getByName('error_report_json')) {
      ihCol.fields.add(new JSONField({ name: 'error_report_json' }))
    }
    app.save(ihCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('entity_change_logs')
      app.delete(col)
    } catch (_) {}
  },
)
