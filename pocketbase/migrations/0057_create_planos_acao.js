migrate(
  (app) => {
    const factoriesId = app.findCollectionByNameOrId('factories').id
    const usersId = '_pb_users_auth_'
    const atividadesId = app.findCollectionByNameOrId('atividades').id

    const collection = new Collection({
      name: 'planos_acao',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'descricao', type: 'text', required: true },
        { name: 'data_prevista', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'em_andamento', 'concluido', 'cancelado'],
          maxSelect: 1,
        },
        {
          name: 'cliente',
          type: 'relation',
          collectionId: factoriesId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'vendedor',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'atividade_origem',
          type: 'relation',
          collectionId: atividadesId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'origem',
          type: 'text',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_planos_acao_cliente ON planos_acao (cliente)',
        'CREATE INDEX idx_planos_acao_vendedor ON planos_acao (vendedor)',
        'CREATE INDEX idx_planos_acao_status ON planos_acao (status)',
        'CREATE INDEX idx_planos_acao_atividade_origem ON planos_acao (atividade_origem)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('planos_acao')
    app.delete(collection)
  },
)
