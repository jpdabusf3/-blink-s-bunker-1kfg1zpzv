migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    if (!col.fields.getByName('codigo_cliente')) {
      col.fields.add(new TextField({ name: 'codigo_cliente' }))
    }

    // Adiciona índice se ainda não existir
    try {
      col.addIndex('idx_factories_codigo_cliente', false, 'codigo_cliente', '')
    } catch (_) {}

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('factories')
      if (col.fields.getByName('codigo_cliente')) {
        col.fields.removeByName('codigo_cliente')
      }
      try {
        col.removeIndex('idx_factories_codigo_cliente')
      } catch (_) {}
      app.save(col)
    } catch (_) {}
  },
)
