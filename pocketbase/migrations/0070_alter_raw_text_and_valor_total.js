migrate(
  (app) => {
    // 1. Atualizar notas_fiscais: adicionar raw_text (TEXT sem limite max), tornar valor_total_nota NULLABLE
    try {
      const nfCol = app.findCollectionByNameOrId('notas_fiscais')
      
      const rawTextField = nfCol.fields.getByName('raw_text')
      if (!rawTextField) {
        nfCol.fields.add(
          new TextField({
            name: 'raw_text',
            required: false,
          })
        )
      } else {
        // Remover limite se houver
        rawTextField.max = 0
        rawTextField.required = false
      }

      const valorTotalNotaField = nfCol.fields.getByName('valor_total_nota')
      if (valorTotalNotaField) {
        valorTotalNotaField.required = false
      }

      app.save(nfCol)
    } catch (err) {
      console.log('Erro ao atualizar notas_fiscais collection:', err)
    }

    // 2. Atualizar nfe_pedidos: garantir raw_text sem limite max e valor_total NULLABLE
    try {
      const nfeCol = app.findCollectionByNameOrId('nfe_pedidos')

      const nfeRawText = nfeCol.fields.getByName('raw_text')
      if (!nfeRawText) {
        nfeCol.fields.add(
          new TextField({
            name: 'raw_text',
            required: false,
          })
        )
      } else {
        nfeRawText.max = 0
        nfeRawText.required = false
      }

      const nfeValorTotal = nfeCol.fields.getByName('valor_total')
      if (nfeValorTotal) {
        nfeValorTotal.required = false
      }

      app.save(nfeCol)
    } catch (err) {
      console.log('Erro ao atualizar nfe_pedidos collection:', err)
    }
  },
  (app) => {
    // Down migration
    try {
      const nfCol = app.findCollectionByNameOrId('notas_fiscais')
      const valorTotalNotaField = nfCol.fields.getByName('valor_total_nota')
      if (valorTotalNotaField) {
        valorTotalNotaField.required = true
      }
      app.save(nfCol)
    } catch (_) {}

    try {
      const nfeCol = app.findCollectionByNameOrId('nfe_pedidos')
      const nfeValorTotal = nfeCol.fields.getByName('valor_total')
      if (nfeValorTotal) {
        nfeValorTotal.required = true
      }
      app.save(nfeCol)
    } catch (_) {}
  }
)
