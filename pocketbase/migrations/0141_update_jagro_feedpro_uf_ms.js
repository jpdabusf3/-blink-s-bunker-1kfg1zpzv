migrate(
  (app) => {
    // 1. Atualizar registro JAGRO na carteira FeedPro com UF = MS e Município = Campo Grande
    try {
      const rec = app.findRecordById('clientes_distribuidor', '6kq234d0ni9vtc0')
      if (rec) {
        rec.set('uf', 'MS')
        rec.set('municipio', 'Campo Grande')
        rec.set('observacoes', 'UF complementada manualmente: Campo Grande - MS')
        app.save(rec)
      }
    } catch (_) {
      // Idempotente para cópias/templates onde o registro pode ter outro ID ou ser criado via seed
      try {
        const matches = app.findRecordsByFilter(
          'clientes_distribuidor',
          "nome_cliente = 'JAGRO'",
          '',
          1,
          0,
        )
        if (matches && matches.length > 0) {
          const m = matches[0]
          m.set('uf', 'MS')
          m.set('municipio', 'Campo Grande')
          m.set('observacoes', 'UF complementada manualmente: Campo Grande - MS')
          app.save(m)
        }
      } catch (__) {}
    }

    // 2. Garantir que a UF MS esteja em ufs_atuacao do distribuidor FeedPro
    try {
      let feedpro = null
      try {
        feedpro = app.findRecordById('distribuidores', '7yynd4ya500lcjw')
      } catch (_) {
        const dMatches = app.findRecordsByFilter(
          'distribuidores',
          "nome ~ 'FeedPro' || nome ~ 'Feedpro'",
          '',
          1,
          0,
        )
        if (dMatches && dMatches.length > 0) {
          feedpro = dMatches[0]
        }
      }

      if (feedpro) {
        let ufs = feedpro.get('ufs_atuacao') || []
        if (typeof ufs === 'string') {
          try {
            ufs = JSON.parse(ufs)
          } catch (_) {
            ufs = []
          }
        }
        if (Array.isArray(ufs) && !ufs.includes('MS')) {
          ufs.push('MS')
          ufs.sort()
          feedpro.set('ufs_atuacao', ufs)
          app.save(feedpro)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const rec = app.findRecordById('clientes_distribuidor', '6kq234d0ni9vtc0')
      if (rec) {
        rec.set('uf', '')
        rec.set('municipio', '')
        rec.set('observacoes', 'Atenção: UF pendente de complemento (planilha original sem UF)')
        app.save(rec)
      }
    } catch (_) {}
  },
)
