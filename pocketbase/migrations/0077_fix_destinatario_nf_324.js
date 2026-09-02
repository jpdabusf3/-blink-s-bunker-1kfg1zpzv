migrate(
  (app) => {
    // Corrigir registro da NF 324 na coleção notas_fiscais
    try {
      const nfRecords = app.findRecordsByFilter(
        'notas_fiscais',
        "numero_nf = '324' || numero_nf = '000000324' || numero_nf = '000324'",
        '',
        10,
        0,
      )
      for (let i = 0; i < nfRecords.length; i++) {
        const rec = nfRecords[i]
        rec.set('destinatario_nome', 'Pecuaria Nutricao Animal Ltda')
        app.save(rec)
      }
    } catch (err) {
      console.log('Migration 0077 notas_fiscais update:', err)
    }

    // Corrigir registros correspondentes na coleção historico_vendas
    try {
      const hvRecords = app.findRecordsByFilter(
        'historico_vendas',
        "numero_documento = '324' || cliente ~ 'FATURA DUPLICATAS' || destinatario_nome ~ 'FATURA DUPLICATAS'",
        '',
        50,
        0,
      )
      for (let j = 0; j < hvRecords.length; j++) {
        const rec = hvRecords[j]
        rec.set('destinatario_nome', 'Pecuaria Nutricao Animal Ltda')
        rec.set('cliente', 'Pecuaria Nutricao Animal Ltda')
        app.save(rec)
      }
    } catch (err) {
      console.log('Migration 0077 historico_vendas update:', err)
    }

    // Corrigir registros correspondentes na coleção nfe_pedidos se existirem
    try {
      const nfeRecords = app.findRecordsByFilter(
        'nfe_pedidos',
        "numero_nf = '324' || cliente_nome ~ 'FATURA DUPLICATAS'",
        '',
        10,
        0,
      )
      for (let k = 0; k < nfeRecords.length; k++) {
        const rec = nfeRecords[k]
        rec.set('cliente_nome', 'Pecuaria Nutricao Animal Ltda')
        app.save(rec)
      }
    } catch (err) {
      console.log('Migration 0077 nfe_pedidos update:', err)
    }
  },
  (app) => {
    // Rollback não necessário para correção de dados saneados
  },
)
