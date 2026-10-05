migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!app.hasTable('relatorios_gerados')) {
      const collection = new Collection({
        name: 'relatorios_gerados',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'periodo',
            type: 'text',
            required: false,
          },
          {
            name: 'filtros',
            type: 'text',
            required: false,
          },
          {
            name: 'conteudo',
            type: 'text',
            required: false,
          },
          {
            name: 'formato',
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
          'CREATE INDEX idx_relatorios_gerados_user_created ON relatorios_gerados (user_id, created DESC)',
        ],
      })
      app.save(collection)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('relatorios_gerados')
      app.delete(col)
    } catch (_) {}
  },
)
