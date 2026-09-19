migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')

    if (!col.fields.getByName('numeroPedido')) {
      col.fields.add(
        new TextField({
          name: 'numeroPedido',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('envio')) {
      col.fields.add(
        new TextField({
          name: 'envio',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('dataSolicitada')) {
      col.fields.add(
        new DateField({
          name: 'dataSolicitada',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('entregaConfirmada')) {
      col.fields.add(
        new DateField({
          name: 'entregaConfirmada',
          required: false,
        }),
      )
    }

    // Index para consultas e deduplicação
    col.addIndex('idx_pedidos_numeroPedido', false, 'numeroPedido', '')

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pedidos')
      col.removeIndex('idx_pedidos_numeroPedido')
      app.save(col)
    } catch (_) {}
  },
)
