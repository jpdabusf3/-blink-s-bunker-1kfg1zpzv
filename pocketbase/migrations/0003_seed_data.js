migrate(
  (app) => {
    const factories = app.findCollectionByNameOrId('factories')
    const orders = app.findCollectionByNameOrId('orders')

    const fData = [
      { name: 'Agronortena', state: 'MT', region: 'Norte', channel: 'Direct', type: '' },
      {
        name: 'Qualinutri',
        state: 'MT',
        region: 'Oeste',
        channel: 'Indirect',
        type: 'Distribuidores',
      },
      {
        name: 'Rebanho',
        state: 'MS',
        region: 'Sudoeste',
        channel: 'Indirect',
        type: 'Representantes',
      },
      { name: 'Nutribras', state: 'GO', region: 'Centro', channel: 'Direct', type: '' },
      { name: 'Agrovale', state: 'PR', region: 'Sul', channel: 'Indirect', type: 'Cooperativas' },
      {
        name: 'Cooperativa Alpha',
        state: 'SP',
        region: 'Sudeste',
        channel: 'Indirect',
        type: 'Cooperativas',
      },
      {
        name: 'Revenda Master',
        state: 'BA',
        region: 'Nordeste',
        channel: 'Indirect',
        type: 'Revendas',
      },
      {
        name: 'Indústria Global',
        state: 'MG',
        region: 'Sudeste',
        channel: 'Indirect',
        type: 'Indústrias',
      },
      { name: 'Nutri Leste', state: 'MG', region: 'Leste', channel: 'Direct', type: '' },
      { name: 'Fazenda Noroeste', state: 'RO', region: 'Noroeste', channel: 'Direct', type: '' },
    ]

    const fIds = []

    for (const fd of fData) {
      const f = new Record(factories)
      f.set('name', fd.name)
      f.set('state', fd.state)
      f.set('stateRegion', fd.region)
      f.set('salesChannel', fd.channel)
      if (fd.type) f.set('indirectChannelType', fd.type)
      app.save(f)
      fIds.push(f.id)
    }

    const lines = ['Minerais Orgânicos', 'Prebióticos', 'Adsorventes', 'Blends']
    const products = ['Blink Minerais+', 'Blink Prebio', 'Blink Toxin', 'Blink Blend Pro']

    for (let i = 0; i < 60; i++) {
      const o = new Record(orders)
      o.set('factoryId', fIds[i % fIds.length])
      const pIdx = i % products.length
      o.set('product', products[pIdx])
      o.set('line', lines[pIdx])
      o.set('quantity', ((i * 15) % 100) + 10)
      o.set('unitValue', 100 + i)
      o.set('totalValue', (((i * 15) % 100) + 10) * (100 + i))

      // Spread over last year
      const d = new Date()
      d.setDate(d.getDate() - i * 6)
      o.set('orderDate', d.toISOString())
      app.save(o)
    }
  },
  (app) => {
    app.db().newQuery('DELETE FROM orders').execute()
    app.db().newQuery('DELETE FROM factories').execute()
  },
)
