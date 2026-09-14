migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('historico_vendas')

    // Campos de valor em Dólar (USD) para suportar bases faturadas em Dólar
    if (!col.fields.getByName('valor_usd')) {
      col.fields.add(new NumberField({ name: 'valor_usd' }))
    }
    if (!col.fields.getByName('valor_unitario_usd')) {
      col.fields.add(new NumberField({ name: 'valor_unitario_usd' }))
    }
    if (!col.fields.getByName('valor_total_nota_usd')) {
      col.fields.add(new NumberField({ name: 'valor_total_nota_usd' }))
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('historico_vendas')
      const f1 = col.fields.getByName('valor_usd')
      if (f1) col.fields.removeById(f1.id)
      const f2 = col.fields.getByName('valor_unitario_usd')
      if (f2) col.fields.removeById(f2.id)
      const f3 = col.fields.getByName('valor_total_nota_usd')
      if (f3) col.fields.removeById(f3.id)
      app.save(col)
    } catch (_) {}
  },
)
