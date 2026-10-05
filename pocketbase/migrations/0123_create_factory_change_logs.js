migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const factoriesCol = app.findCollectionByNameOrId('factories')

    const collection = new Collection({
      name: 'factory_change_logs',
      type: 'base',
      // Leitura para autenticados; criação/edição/deleção restritas ou autenticadas
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'factory_id',
          type: 'relation',
          required: true,
          collectionId: factoriesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
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
        'CREATE INDEX idx_factory_change_logs_factory_id ON factory_change_logs (factory_id)',
        'CREATE INDEX idx_factory_change_logs_created ON factory_change_logs (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('factory_change_logs')
      app.delete(collection)
    } catch (_) {}
  },
)
