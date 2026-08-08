migrate(
  (app) => {
    var collection = new Collection({
      name: 'confirmacoes_pendentes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'from', type: 'text' },
        { name: 'json_interpretacao', type: 'json' },
        { name: 'audio_transcrito', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'confirmed', 'corrected'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_confirmacoes_pendentes_from ON confirmacoes_pendentes (from)'],
    })

    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('confirmacoes_pendentes'))
    } catch (_) {}
  },
)
