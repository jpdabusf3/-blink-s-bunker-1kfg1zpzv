migrate(
  (app) => {
    // 1. Verificar e atualizar notas_fiscais
    try {
      const nfCol = app.findCollectionByNameOrId('notas_fiscais')

      // raw_text: garantir TEXT sem limite de comprimento (max = 0)
      const rawTextField = nfCol.fields.getByName('raw_text')
      if (!rawTextField) {
        nfCol.fields.add(
          new TextField({
            name: 'raw_text',
            required: false,
          }),
        )
      } else {
        rawTextField.max = 0
        rawTextField.required = false
      }

      // valor_total_nota: nullable, min = 0 (permite 0 e valores >= 0)
      const valorTotalNotaField = nfCol.fields.getByName('valor_total_nota')
      if (valorTotalNotaField) {
        valorTotalNotaField.required = false
        valorTotalNotaField.min = 0
      }

      // valor_total_produtos: nullable, min = 0 se existir
      const valorTotalProdutosField = nfCol.fields.getByName('valor_total_produtos')
      if (valorTotalProdutosField) {
        valorTotalProdutosField.required = false
        valorTotalProdutosField.min = 0
      }

      app.save(nfCol)
      console.log(
        'Migration 0073: notas_fiscais atualizado com sucesso (raw_text sem limite, valor_total_nota >= 0 e nullable)',
      )
    } catch (err) {
      console.log('Migration 0073: erro ao atualizar notas_fiscais:', err)
    }

    // 2. Verificar e atualizar nfe_pedidos
    try {
      const nfeCol = app.findCollectionByNameOrId('nfe_pedidos')

      // raw_text: garantir TEXT sem limite de comprimento (max = 0)
      const nfeRawText = nfeCol.fields.getByName('raw_text')
      if (!nfeRawText) {
        nfeCol.fields.add(
          new TextField({
            name: 'raw_text',
            required: false,
          }),
        )
      } else {
        nfeRawText.max = 0
        nfeRawText.required = false
      }

      // valor_total: nullable, min = 0 (permite 0 e valores >= 0)
      const nfeValorTotal = nfeCol.fields.getByName('valor_total')
      if (nfeValorTotal) {
        nfeValorTotal.required = false
        nfeValorTotal.min = 0
      }

      // valor_produtos: nullable, min = 0 se existir
      const nfeValorProdutos = nfeCol.fields.getByName('valor_produtos')
      if (nfeValorProdutos) {
        nfeValorProdutos.required = false
        nfeValorProdutos.min = 0
      }

      app.save(nfeCol)
      console.log(
        'Migration 0073: nfe_pedidos atualizado com sucesso (raw_text sem limite, valor_total >= 0 e nullable)',
      )
    } catch (err) {
      console.log('Migration 0073: erro ao atualizar nfe_pedidos:', err)
    }

    // 3. Verificar e atualizar historico_vendas (campo valor_total_nota / produto_valor_total)
    try {
      const hvCol = app.findCollectionByNameOrId('historico_vendas')

      const hvValorTotalNota = hvCol.fields.getByName('valor_total_nota')
      if (hvValorTotalNota) {
        hvValorTotalNota.required = false
        hvValorTotalNota.min = 0
      }

      const hvProdutoValorTotal = hvCol.fields.getByName('produto_valor_total')
      if (hvProdutoValorTotal) {
        hvProdutoValorTotal.required = false
        hvProdutoValorTotal.min = 0
      }

      const hvValor = hvCol.fields.getByName('valor')
      if (hvValor) {
        hvValor.required = false
        hvValor.min = 0
      }

      app.save(hvCol)
      console.log('Migration 0073: historico_vendas atualizado com sucesso')
    } catch (err) {
      console.log('Migration 0073: erro ao atualizar historico_vendas:', err)
    }
  },
  (app) => {
    // Down migration
    try {
      const nfCol = app.findCollectionByNameOrId('notas_fiscais')
      app.save(nfCol)
    } catch (_) {}

    try {
      const nfeCol = app.findCollectionByNameOrId('nfe_pedidos')
      app.save(nfeCol)
    } catch (_) {}
  },
)
