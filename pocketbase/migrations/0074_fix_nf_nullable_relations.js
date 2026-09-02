migrate(
  (app) => {
    try {
      const nfCol = app.findCollectionByNameOrId('notas_fiscais')

      // Ensure all fields that might receive null/string are properly nullable or valid
      const gestorField = nfCol.fields.getByName('gestor_tecnico_id')
      if (gestorField) {
        gestorField.required = false
      }

      const vendedorField = nfCol.fields.getByName('vendedor_id')
      if (vendedorField) {
        vendedorField.required = false
      }

      const faturaVencField = nfCol.fields.getByName('fatura_vencimento')
      if (faturaVencField) {
        faturaVencField.required = false
      }

      const rawTextField = nfCol.fields.getByName('raw_text')
      if (rawTextField) {
        rawTextField.max = 0
        rawTextField.required = false
      }

      app.save(nfCol)
      console.log('Migration 0074: notas_fiscais collection ensured')
    } catch (err) {
      console.log('Migration 0074: erro ao verificar notas_fiscais:', err)
    }
  },
  (app) => {},
)
