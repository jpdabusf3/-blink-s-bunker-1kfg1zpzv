migrate(
  (app) => {
    // Ajustar pedidos_carteira para aceitar qualquer mês (ou todos os 12 meses)
    try {
      const col = app.findCollectionByNameOrId('pedidos_carteira')
      // Atualizar o campo 'mes' para text ou ampliar select para todos os meses
      const mesField = col.fields.getByName('mes')
      if (mesField) {
        col.fields.removeByName('mes')
        col.fields.add(
          new TextField({
            name: 'mes',
            required: false,
          }),
        )
      }

      // Adicionar ano e segmento se não existirem
      if (!col.fields.getByName('ano')) {
        col.fields.add(
          new NumberField({
            name: 'ano',
            onlyInt: true,
          }),
        )
      }
      if (!col.fields.getByName('segmento')) {
        col.fields.add(
          new TextField({
            name: 'segmento',
          }),
        )
      }
      if (!col.fields.getByName('cliente')) {
        col.fields.add(
          new TextField({
            name: 'cliente',
          }),
        )
      }

      app.save(col)
    } catch (err) {
      console.log('Erro ao atualizar pedidos_carteira:', err)
    }

    // Verificar metas: garantir campo canal ou canal_vendas
    try {
      const colMetas = app.findCollectionByNameOrId('metas')
      if (!colMetas.fields.getByName('canal')) {
        colMetas.fields.add(
          new TextField({
            name: 'canal',
          }),
        )
      }
      if (!colMetas.fields.getByName('vendedor_nome')) {
        colMetas.fields.add(
          new TextField({
            name: 'vendedor_nome',
          }),
        )
      }
      if (!colMetas.fields.getByName('tipo_resultado')) {
        colMetas.fields.add(
          new TextField({
            name: 'tipo_resultado',
          }),
        )
      }
      app.save(colMetas)
    } catch (errMetas) {
      console.log('Erro ao atualizar metas:', errMetas)
    }
  },
  (app) => {
    // Revert opcional
  },
)
