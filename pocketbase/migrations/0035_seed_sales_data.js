migrate(
  (app) => {
    var ATUALIZADO_EM = '2026-08-07 00:00:00.000Z'

    try {
      var user = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      user.set('name', 'João Pedro')
      user.set('job_title', 'Coordenador Técnico e Comercial')
      user.set('geographicArea', 'MT')
      user.set('deactivated', false)
      app.save(user)
    } catch (_) {}

    var carteiraData = [
      { marca: 'Special Dog', mes: 'agosto', valor: 60000.03, total_geral: 270000.07 },
      { marca: 'Special Dog', mes: 'setembro', valor: 30000.01, total_geral: 270000.07 },
      { marca: 'Special Dog', mes: 'outubro', valor: 60000.03, total_geral: 270000.07 },
      { marca: 'Special Dog', mes: 'novembro', valor: 60000.0, total_geral: 270000.07 },
      { marca: 'Special Dog', mes: 'dezembro', valor: 60000.0, total_geral: 270000.07 },
      { marca: 'Dogchoni', mes: 'agosto', valor: 3600.0, total_geral: 3600.0 },
      { marca: 'Masterzoo', mes: 'agosto', valor: 199.5, total_geral: 199.5 },
      { marca: 'Pet Food Solution', mes: 'setembro', valor: 3225.8, total_geral: 9674.4 },
      { marca: 'Pet Food Solution', mes: 'outubro', valor: 3224.3, total_geral: 9674.4 },
      { marca: 'Pet Food Solution', mes: 'novembro', valor: 3224.3, total_geral: 9674.4 },
      { marca: 'Gran Premiatta', mes: 'agosto', valor: 480.32, total_geral: 480.32 },
    ]

    var carteiraCol = app.findCollectionByNameOrId('pedidos_carteira')
    for (var i = 0; i < carteiraData.length; i++) {
      var item = carteiraData[i]
      var existing = app.findRecordsByFilter(
        'pedidos_carteira',
        "marca = '" + item.marca + "' && mes = '" + item.mes + "'",
        '-created',
        1,
        0,
      )
      var rec
      if (existing.length > 0) {
        rec = existing[0]
      } else {
        rec = new Record(carteiraCol)
      }
      rec.set('marca', item.marca)
      rec.set('mes', item.mes)
      rec.set('valor', item.valor)
      rec.set('total_geral', item.total_geral)
      rec.set('atualizado_em', ATUALIZADO_EM)
      app.save(rec)
    }

    var histCol = app.findCollectionByNameOrId('historico_pedidos')
    for (var j = 0; j < carteiraData.length; j++) {
      var hItem = carteiraData[j]
      var hExisting = app.findRecordsByFilter(
        'historico_pedidos',
        "marca = '" + hItem.marca + "' && mes = '" + hItem.mes + "'",
        '-created',
        1,
        0,
      )
      var hRec
      if (hExisting.length > 0) {
        hRec = hExisting[0]
      } else {
        hRec = new Record(histCol)
      }
      hRec.set('marca', hItem.marca)
      hRec.set('mes', hItem.mes)
      hRec.set('valor', hItem.valor)
      hRec.set('total_geral', hItem.total_geral)
      hRec.set('atualizado_em', ATUALIZADO_EM)
      app.save(hRec)
    }

    var matrizData = [
      { pais: 'Brasil', carteira: 'AVES', mes: 'janeiro', valor: 3823.08 },
      { pais: 'Brasil', carteira: 'AVES', mes: 'abril', valor: 1516.85 },
      { pais: 'Brasil', carteira: 'AVES', mes: 'julho', valor: 573.37 },
      { pais: 'Brasil', carteira: 'AVES', mes: 'agosto', valor: 31791.28 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'janeiro', valor: 48230.39 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'fevereiro', valor: 42601.95 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'maro', valor: 111868.25 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'abril', valor: 42807.94 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'maio', valor: 42087.19 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'junho', valor: 39600.18 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'julho', valor: 62941.19 },
      { pais: 'Brasil', carteira: 'PETS', mes: 'agosto', valor: 27264.85 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'janeiro', valor: 54563.1 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'fevereiro', valor: 11443.01 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'maro', valor: 59086.62 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'abril', valor: 39013.5 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'maio', valor: 67821.83 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'junho', valor: 112706.48 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'julho', valor: 63867.81 },
      { pais: 'Brasil', carteira: 'RUMINANTES', mes: 'agosto', valor: 463.76 },
      { pais: 'Brasil', carteira: 'SUINOS', mes: 'janeiro', valor: 4458.61 },
      { pais: 'Brasil', carteira: 'SUINOS', mes: 'fevereiro', valor: 2180.77 },
      { pais: 'Brasil', carteira: 'SUINOS', mes: 'maro', valor: 2793.72 },
      { pais: 'Brasil', carteira: 'SUINOS', mes: 'abril', valor: 1092.69 },
      { pais: 'Brasil', carteira: 'SUINOS', mes: 'maio', valor: 27687.69 },
      { pais: 'Brasil', carteira: 'SUINOS', mes: 'junho', valor: 1611.35 },
      { pais: 'Brasil', carteira: 'SUINOS', mes: 'julho', valor: 1310.05 },
      { pais: 'Paraguai', carteira: 'AVES', mes: 'janeiro', valor: 26724.7 },
      { pais: 'Paraguai', carteira: 'AVES', mes: 'fevereiro', valor: 8431.5 },
      { pais: 'Paraguai', carteira: 'AVES', mes: 'maro', valor: 28545.75 },
      { pais: 'Paraguai', carteira: 'AVES', mes: 'abril', valor: 38951.0 },
      { pais: 'Paraguai', carteira: 'AVES', mes: 'maio', valor: 45170.5 },
      { pais: 'Paraguai', carteira: 'AVES', mes: 'junho', valor: 44552.0 },
      { pais: 'Paraguai', carteira: 'AVES', mes: 'agosto', valor: 5132.9 },
      { pais: 'Paraguai', carteira: 'RUMINANTES', mes: 'janeiro', valor: 37950.0 },
      { pais: 'Paraguai', carteira: 'RUMINANTES', mes: 'fevereiro', valor: 49500.0 },
      { pais: 'Paraguai', carteira: 'RUMINANTES', mes: 'abril', valor: 260.0 },
      { pais: 'Paraguai', carteira: 'RUMINANTES', mes: 'junho', valor: 49500.0 },
      { pais: 'Chile', carteira: 'AQUA', mes: 'maio', valor: 30720.0 },
    ]

    var matrizCol = app.findCollectionByNameOrId('matriz_vendas')
    for (var k = 0; k < matrizData.length; k++) {
      var mItem = matrizData[k]
      var mExisting = app.findRecordsByFilter(
        'matriz_vendas',
        "pais = '" +
          mItem.pais +
          "' && carteira = '" +
          mItem.carteira +
          "' && mes = '" +
          mItem.mes +
          "'",
        '-created',
        1,
        0,
      )
      var mRec
      if (mExisting.length > 0) {
        mRec = mExisting[0]
      } else {
        mRec = new Record(matrizCol)
      }
      mRec.set('pais', mItem.pais)
      mRec.set('carteira', mItem.carteira)
      mRec.set('grupo_cliente', '')
      mRec.set('razao_social', '')
      mRec.set('mes', mItem.mes)
      mRec.set('valor', mItem.valor)
      mRec.set('atualizado_em', ATUALIZADO_EM)
      app.save(mRec)
    }
  },
  (app) => {
    try {
      var carteiraRecords = app.findRecordsByFilter('pedidos_carteira', '', '-created', 500, 0)
      for (var i = 0; i < carteiraRecords.length; i++) {
        app.delete(carteiraRecords[i])
      }
    } catch (_) {}
    try {
      var histRecords = app.findRecordsByFilter('historico_pedidos', '', '-created', 500, 0)
      for (var j = 0; j < histRecords.length; j++) {
        app.delete(histRecords[j])
      }
    } catch (_) {}
    try {
      var matrizRecords = app.findRecordsByFilter('matriz_vendas', '', '-created', 500, 0)
      for (var k = 0; k < matrizRecords.length; k++) {
        app.delete(matrizRecords[k])
      }
    } catch (_) {}
  },
)
