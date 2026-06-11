migrate(
  (app) => {
    const factories = new Collection({
      name: 'factories',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        {
          name: 'stateRegion',
          type: 'select',
          values: [
            'Sul',
            'Norte',
            'Oeste',
            'Leste',
            'Nordeste',
            'Noroeste',
            'Sudeste',
            'Sudoeste',
            'Centro',
          ],
        },
        { name: 'region', type: 'text' },
        { name: 'sector', type: 'text' },
        { name: 'productLineAffinity', type: 'text' },
        { name: 'capacity', type: 'number' },
        { name: 'potentialValue', type: 'number' },
        { name: 'status', type: 'text' },
        { name: 'priority', type: 'text' },
        { name: 'focusLevel', type: 'text' },
        { name: 'lastInteraction', type: 'date' },
        { name: 'contactName', type: 'text' },
        { name: 'contactPhone', type: 'text' },
        { name: 'operationTypes', type: 'text' },
        { name: 'productInterests', type: 'text' },
        { name: 'funnelStage', type: 'text' },
        { name: 'winProbability', type: 'number' },
        { name: 'salesChannel', type: 'select', values: ['Direct', 'Indirect'] },
        {
          name: 'indirectChannelType',
          type: 'select',
          values: ['Representantes', 'Distribuidores', 'Revendas', 'Cooperativas', 'Indústrias'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(factories)

    const orders = new Collection({
      name: 'orders',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'factoryId', type: 'relation', collectionId: factories.id, maxSelect: 1 },
        { name: 'product', type: 'text', required: true },
        { name: 'line', type: 'text' },
        { name: 'quantity', type: 'number' },
        { name: 'unitValue', type: 'number' },
        { name: 'totalValue', type: 'number' },
        { name: 'orderDate', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(orders)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('orders'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('factories'))
    } catch (_) {}
  },
)
