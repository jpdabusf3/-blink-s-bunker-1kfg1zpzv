migrate(
  (app) => {
    var collection = new Collection({
      name: 'metas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'vendedor_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'periodo', type: 'text' },
        { name: 'meta_valor', type: 'number' },
        { name: 'valor_realizado', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_metas_vendedor_id ON metas (vendedor_id)'],
    })

    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('metas'))
    } catch (_) {}
  },
)
