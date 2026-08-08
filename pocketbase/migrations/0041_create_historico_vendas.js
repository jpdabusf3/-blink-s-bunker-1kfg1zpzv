migrate(
  (app) => {
    var gestaoTecnicaId = app.findCollectionByNameOrId('gestao_tecnica').id

    var collection = new Collection({
      name: 'historico_vendas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'data', type: 'date' },
        { name: 'cliente', type: 'text' },
        {
          name: 'especie',
          type: 'select',
          values: ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA', 'OUTRO'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'gestor_tecnico_id',
          type: 'relation',
          collectionId: gestaoTecnicaId,
          maxSelect: 1,
        },
        {
          name: 'vendedor_id',
          type: 'relation',
          collectionId: gestaoTecnicaId,
          maxSelect: 1,
        },
        {
          name: 'canal_vendas',
          type: 'select',
          values: ['Direto', 'Distribuidor', 'Indústria', 'Premixera', 'Cooperativa', 'Online'],
          maxSelect: 1,
        },
        { name: 'valor', type: 'number' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'origem',
          type: 'select',
          values: ['manual', 'upload'],
          maxSelect: 1,
        },
        { name: 'atualizado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_historico_vendas_data ON historico_vendas (data)',
        'CREATE INDEX idx_historico_vendas_especie ON historico_vendas (especie)',
        'CREATE INDEX idx_historico_vendas_gestor_tecnico_id ON historico_vendas (gestor_tecnico_id)',
        'CREATE INDEX idx_historico_vendas_vendedor_id ON historico_vendas (vendedor_id)',
        'CREATE INDEX idx_historico_vendas_canal_vendas ON historico_vendas (canal_vendas)',
        'CREATE UNIQUE INDEX idx_historico_vendas_data_cliente_valor ON historico_vendas (data, cliente, valor)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('historico_vendas'))
    } catch (_) {}
  },
)
