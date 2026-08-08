migrate(
  (app) => {
    var factoriesId = app.findCollectionByNameOrId('factories').id

    var collection = new Collection({
      name: 'atividades',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'cliente_id',
          type: 'relation',
          collectionId: factoriesId,
          maxSelect: 1,
        },
        {
          name: 'vendedor_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'tipo_atividade',
          type: 'select',
          values: ['visita', 'ligacao', 'proposta', 'follow_up', 'reuniao'],
          maxSelect: 1,
        },
        { name: 'etapa_funil', type: 'text' },
        { name: 'valor_estimado', type: 'number' },
        { name: 'descricao', type: 'text' },
        { name: 'proximo_passo', type: 'text' },
        { name: 'data_proxima_acao', type: 'date' },
        { name: 'pendencias', type: 'text' },
        {
          name: 'origem',
          type: 'select',
          values: ['audio', 'manual', 'excel'],
          maxSelect: 1,
        },
        { name: 'audio_transcrito', type: 'text' },
        { name: 'confianca', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_atividades_cliente_id ON atividades (cliente_id)',
        'CREATE INDEX idx_atividades_vendedor_id ON atividades (vendedor_id)',
        'CREATE INDEX idx_atividades_created ON atividades (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('atividades'))
    } catch (_) {}
  },
)
