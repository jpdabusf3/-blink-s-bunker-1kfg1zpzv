migrate(
  (app) => {
    var collection = new Collection({
      name: 'fila_processamento',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'payload', type: 'json' },
        {
          name: 'status',
          type: 'select',
          values: ['aguardando', 'processando', 'sucesso', 'erro'],
          maxSelect: 1,
        },
        { name: 'tentativas', type: 'number' },
        { name: 'ultimo_erro', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_fila_processamento_status ON fila_processamento (status)'],
    })

    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('fila_processamento'))
    } catch (_) {}
  },
)
