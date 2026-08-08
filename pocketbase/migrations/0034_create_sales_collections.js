migrate(
  (app) => {
    var historicoPedidos = new Collection({
      name: 'historico_pedidos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'marca', type: 'text' },
        { name: 'mes', type: 'text' },
        { name: 'valor', type: 'number' },
        { name: 'total_geral', type: 'number' },
        { name: 'atualizado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_historico_pedidos_marca_mes ON historico_pedidos (marca, mes)'],
    })
    app.save(historicoPedidos)

    var pedidosCarteira = new Collection({
      name: 'pedidos_carteira',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'marca', type: 'text' },
        {
          name: 'mes',
          type: 'select',
          values: ['agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
          maxSelect: 1,
        },
        { name: 'valor', type: 'number' },
        { name: 'total_geral', type: 'number' },
        { name: 'atualizado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pedidos_carteira_marca_mes ON pedidos_carteira (marca, mes)'],
    })
    app.save(pedidosCarteira)

    var matrizVendas = new Collection({
      name: 'matriz_vendas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'pais', type: 'text' },
        {
          name: 'carteira',
          type: 'select',
          values: ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'],
          maxSelect: 1,
        },
        { name: 'grupo_cliente', type: 'text' },
        { name: 'razao_social', type: 'text' },
        { name: 'mes', type: 'text' },
        { name: 'valor', type: 'number' },
        { name: 'atualizado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_matriz_vendas_pais_carteira_mes ON matriz_vendas (pais, carteira, mes)',
      ],
    })
    app.save(matrizVendas)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('historico_pedidos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('pedidos_carteira'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('matriz_vendas'))
    } catch (_) {}
  },
)
