// pocketbase/hooks/funil_vendas.js
// Automação 3: Funil de vendas (pipeline dinâmico)
// Rotas expostas sob o padrão de rota do projeto:
// - /backend/v1/funil_vendas
// Atualização a cada hora (cronAdd hourly) que recalcula e alimenta o cache em automation_cache
// Cache do resultado (responde em <= 5s lendo do cache)

cronAdd('maestro_funil_vendas_hourly', '0 * * * *', () => {
  function pad(n, len) {
    var s = '' + n
    while (s.length < (len || 2)) s = '0' + s
    return s
  }

  var now = new Date()
  var curYear = now.getUTCFullYear()
  var curMonth = now.getUTCMonth() + 1
  var cacheKey = 'funil_vendas_' + curYear + '_' + pad(curMonth, 2)

  var stagesMap = {
    Leads: { nome: 'Leads', quantidade: 0, valor_brl: 0 },
    Propostas: { nome: 'Propostas', quantidade: 0, valor_brl: 0 },
    Pedidos: { nome: 'Pedidos', quantidade: 0, valor_brl: 0 },
    Faturado: { nome: 'Faturado', quantidade: 0, valor_brl: 0 },
  }

  // 1. Contabilizar factories (estágios de Leads e Propostas)
  try {
    var factRows = $app.findRecordsByFilter('factories', '1=1', '', 5000, 0)
    for (var fi = 0; fi < factRows.length; fi++) {
      var f = factRows[fi]
      var stage = (f.getString ? f.getString('funnelStage') : f.funnelStage) || 'Lead'
      var potVal = (f.getInt ? f.getInt('potentialValue') : f.potentialValue) || 0
      var valMedio = (f.getInt ? f.getInt('valor_medio') : f.valor_medio) || 0
      var valAtual = (f.getInt ? f.getInt('valor_atual') : f.valor_atual) || 0
      var effectiveVal = potVal || valAtual || valMedio || 0

      if (
        stage === 'Lead' ||
        stage === 'Primeiro Contato' ||
        stage === 'Diagnóstico Técnico' ||
        stage === 'Apresentação' ||
        stage === 'Teste/Trial'
      ) {
        stagesMap['Leads'].quantidade++
        stagesMap['Leads'].valor_brl += effectiveVal
      } else if (stage === 'Proposta' || stage === 'Negociação') {
        stagesMap['Propostas'].quantidade++
        stagesMap['Propostas'].valor_brl += effectiveVal
      }
    }
  } catch (errFact) {
    $app.logger().warn('maestro_funil: erro ao ler factories', 'error', String(errFact))
  }

  // 2. Contabilizar orders e pedidos_carteira (estágio Pedidos)
  try {
    var MESES_NOMES = [
      '',
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ]
    var mesNome = MESES_NOMES[curMonth]
    var sumCart = 0
    var qtdCart = 0
    if (mesNome) {
      var cartRows = $app.findRecordsByFilter(
        'pedidos_carteira',
        "mes = '" + mesNome + "'",
        '',
        1000,
        0,
      )
      for (var ci = 0; ci < cartRows.length; ci++) {
        var cItem = cartRows[ci]
        sumCart += (cItem.getInt ? cItem.getInt('valor') : cItem.valor) || 0
        qtdCart++
      }
    }

    var orderRows = $app.findRecordsByFilter('orders', '1=1', '', 1000, 0)
    for (var oi = 0; oi < orderRows.length; oi++) {
      var oItem = orderRows[oi]
      sumCart += (oItem.getInt ? oItem.getInt('totalValue') : oItem.totalValue) || 0
      qtdCart++
    }

    stagesMap['Pedidos'].quantidade = qtdCart
    stagesMap['Pedidos'].valor_brl = Math.round(sumCart * 100) / 100
  } catch (errOrders) {
    $app.logger().warn('maestro_funil: erro ao ler orders', 'error', String(errOrders))
  }

  // 3. Contabilizar faturamento (estágio Faturado)
  try {
    var fatRows = $app.findRecordsByFilter(
      'faturamento',
      'ano = ' + curYear + ' && mes = ' + curMonth,
      '',
      5000,
      0,
    )
    var sumFat = 0
    for (var fti = 0; fti < fatRows.length; fti++) {
      var ftItem = fatRows[fti]
      sumFat += (ftItem.getInt ? ftItem.getInt('valor_brl') : ftItem.valor_brl) || 0
    }
    stagesMap['Faturado'].quantidade = fatRows.length
    stagesMap['Faturado'].valor_brl = Math.round(sumFat * 100) / 100
  } catch (errFat) {
    $app.logger().warn('maestro_funil: erro ao ler faturamento', 'error', String(errFat))
  }

  // 4. Meta do mês
  var metaMensal = 0
  try {
    var metaRows = $app.findRecordsByFilter('metas', '1=1', '', 500, 0)
    for (var mi = 0; mi < metaRows.length; mi++) {
      metaMensal +=
        (metaRows[mi].getInt ? metaRows[mi].getInt('meta_valor') : metaRows[mi].meta_valor) || 0
    }
  } catch (_) {}

  var etapas = [
    stagesMap['Leads'],
    stagesMap['Propostas'],
    stagesMap['Pedidos'],
    stagesMap['Faturado'],
  ]

  var conversao = []
  for (var k = 0; k < etapas.length - 1; k++) {
    var de = etapas[k]
    var para = etapas[k + 1]
    var taxa = 0
    if (de.valor_brl > 0) {
      taxa = Math.round((para.valor_brl / de.valor_brl) * 10000) / 100
    } else if (de.quantidade > 0) {
      taxa = Math.round((para.quantidade / de.quantidade) * 10000) / 100
    }
    conversao.push({
      de_etapa: de.nome,
      para_etapa: para.nome,
      taxa: taxa,
    })
  }

  var realizado = stagesMap['Faturado'].valor_brl
  var cobertura = metaMensal > 0 ? Math.round((realizado / metaMensal) * 10000) / 100 : 0

  var result = {
    etapas: etapas,
    conversao: conversao,
    fechado_versus_meta: {
      meta: Math.round(metaMensal * 100) / 100,
      realizado: Math.round(realizado * 100) / 100,
      cobertura: cobertura,
    },
    updated_at: new Date().toISOString(),
  }

  try {
    var acCol = $app.findCollectionByNameOrId('automation_cache')
    var acRecord = null
    try {
      acRecord = $app.findFirstRecordByFilter('automation_cache', 'cache_key = {:ck}', {
        ck: cacheKey,
      })
    } catch (_) {}

    var rec = acRecord || new Record(acCol)
    rec.set('cache_key', cacheKey)
    rec.set('data', result)
    rec.set('periodo', curYear + '-' + pad(curMonth, 2))
    rec.set('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
    $app.save(rec)
    $app.logger().info('maestro_funil: hourly cache refresh complete')
  } catch (errSave) {
    $app.logger().warn('maestro_funil: failed to save cache', 'error', String(errSave))
  }
})

routerAdd(
  'POST',
  '/backend/v1/funil_vendas_recalc',
  (e) => {
    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    function pad(n, len) {
      var s = '' + n
      while (s.length < (len || 2)) s = '0' + s
      return s
    }

    var now = new Date()
    var curYear = now.getUTCFullYear()
    var curMonth = now.getUTCMonth() + 1
    var cacheKey = 'funil_vendas_' + curYear + '_' + pad(curMonth, 2)

    var stagesMap = {
      Leads: { nome: 'Leads', quantidade: 0, valor_brl: 0 },
      Propostas: { nome: 'Propostas', quantidade: 0, valor_brl: 0 },
      Pedidos: { nome: 'Pedidos', quantidade: 0, valor_brl: 0 },
      Faturado: { nome: 'Faturado', quantidade: 0, valor_brl: 0 },
    }

    try {
      var factRows = $app.findRecordsByFilter('factories', '1=1', '', 5000, 0)
      for (var fi = 0; fi < factRows.length; fi++) {
        var f = factRows[fi]
        var stage = (f.getString ? f.getString('funnelStage') : f.funnelStage) || 'Lead'
        var potVal = (f.getInt ? f.getInt('potentialValue') : f.potentialValue) || 0
        var valMedio = (f.getInt ? f.getInt('valor_medio') : f.valor_medio) || 0
        var valAtual = (f.getInt ? f.getInt('valor_atual') : f.valor_atual) || 0
        var effectiveVal = potVal || valAtual || valMedio || 0

        if (
          stage === 'Lead' ||
          stage === 'Primeiro Contato' ||
          stage === 'Diagnóstico Técnico' ||
          stage === 'Apresentação' ||
          stage === 'Teste/Trial'
        ) {
          stagesMap['Leads'].quantidade++
          stagesMap['Leads'].valor_brl += effectiveVal
        } else if (stage === 'Proposta' || stage === 'Negociação') {
          stagesMap['Propostas'].quantidade++
          stagesMap['Propostas'].valor_brl += effectiveVal
        }
      }
    } catch (_) {}

    try {
      var MESES_NOMES = [
        '',
        'janeiro',
        'fevereiro',
        'março',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro',
      ]
      var mesNome = MESES_NOMES[curMonth]
      var sumCart = 0
      var qtdCart = 0
      if (mesNome) {
        var cartRows = $app.findRecordsByFilter(
          'pedidos_carteira',
          "mes = '" + mesNome + "'",
          '',
          1000,
          0,
        )
        for (var ci = 0; ci < cartRows.length; ci++) {
          var cItem = cartRows[ci]
          sumCart += (cItem.getInt ? cItem.getInt('valor') : cItem.valor) || 0
          qtdCart++
        }
      }

      var orderRows = $app.findRecordsByFilter('orders', '1=1', '', 1000, 0)
      for (var oi = 0; oi < orderRows.length; oi++) {
        var oItem = orderRows[oi]
        sumCart += (oItem.getInt ? oItem.getInt('totalValue') : oItem.totalValue) || 0
        qtdCart++
      }

      stagesMap['Pedidos'].quantidade = qtdCart
      stagesMap['Pedidos'].valor_brl = Math.round(sumCart * 100) / 100
    } catch (_) {}

    try {
      var fatRows = $app.findRecordsByFilter(
        'faturamento',
        'ano = ' + curYear + ' && mes = ' + curMonth,
        '',
        5000,
        0,
      )
      var sumFat = 0
      for (var fti = 0; fti < fatRows.length; fti++) {
        var ftItem = fatRows[fti]
        sumFat += (ftItem.getInt ? ftItem.getInt('valor_brl') : ftItem.valor_brl) || 0
      }
      stagesMap['Faturado'].quantidade = fatRows.length
      stagesMap['Faturado'].valor_brl = Math.round(sumFat * 100) / 100
    } catch (_) {}

    var metaMensal = 0
    try {
      var metaRows = $app.findRecordsByFilter('metas', '1=1', '', 500, 0)
      for (var mi = 0; mi < metaRows.length; mi++) {
        metaMensal +=
          (metaRows[mi].getInt ? metaRows[mi].getInt('meta_valor') : metaRows[mi].meta_valor) || 0
      }
    } catch (_) {}

    var etapas = [
      stagesMap['Leads'],
      stagesMap['Propostas'],
      stagesMap['Pedidos'],
      stagesMap['Faturado'],
    ]

    var conversao = []
    for (var k = 0; k < etapas.length - 1; k++) {
      var de = etapas[k]
      var para = etapas[k + 1]
      var taxa = 0
      if (de.valor_brl > 0) {
        taxa = Math.round((para.valor_brl / de.valor_brl) * 10000) / 100
      } else if (de.quantidade > 0) {
        taxa = Math.round((para.quantidade / de.quantidade) * 10000) / 100
      }
      conversao.push({
        de_etapa: de.nome,
        para_etapa: para.nome,
        taxa: taxa,
      })
    }

    var realizado = stagesMap['Faturado'].valor_brl
    var cobertura = metaMensal > 0 ? Math.round((realizado / metaMensal) * 10000) / 100 : 0

    var result = {
      etapas: etapas,
      conversao: conversao,
      fechado_versus_meta: {
        meta: Math.round(metaMensal * 100) / 100,
        realizado: Math.round(realizado * 100) / 100,
        cobertura: cobertura,
      },
      updated_at: new Date().toISOString(),
    }

    try {
      var acCol = $app.findCollectionByNameOrId('automation_cache')
      var acRecord = null
      try {
        acRecord = $app.findFirstRecordByFilter('automation_cache', 'cache_key = {:ck}', {
          ck: cacheKey,
        })
      } catch (_) {}

      var rec = acRecord || new Record(acCol)
      rec.set('cache_key', cacheKey)
      rec.set('data', result)
      rec.set('periodo', curYear + '-' + pad(curMonth, 2))
      rec.set('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
      $app.save(rec)
    } catch (_) {}

    return e.json(200, result)
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/funil_vendas',
  (e) => {
    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    function pad(n, len) {
      var s = '' + n
      while (s.length < (len || 2)) s = '0' + s
      return s
    }

    var now = new Date()
    var curYear = now.getUTCFullYear()
    var curMonth = now.getUTCMonth() + 1
    var cacheKey = 'funil_vendas_' + curYear + '_' + pad(curMonth, 2)

    // 1. Tentar ler do cache
    try {
      var cacheRecord = $app.findFirstRecordByFilter('automation_cache', 'cache_key = {:ck}', {
        ck: cacheKey,
      })
      if (cacheRecord) {
        var expStr = cacheRecord.getString('expires_at')
        if (expStr) {
          var expTime = new Date(expStr).getTime()
          if (expTime > Date.now()) {
            var dbData = cacheRecord.get('data')
            if (dbData) {
              return e.json(200, dbData)
            }
          }
        }
      }
    } catch (_) {}

    // 2. Se cache ausente ou expirado, calcular
    var stagesMap = {
      Leads: { nome: 'Leads', quantidade: 0, valor_brl: 0 },
      Propostas: { nome: 'Propostas', quantidade: 0, valor_brl: 0 },
      Pedidos: { nome: 'Pedidos', quantidade: 0, valor_brl: 0 },
      Faturado: { nome: 'Faturado', quantidade: 0, valor_brl: 0 },
    }

    try {
      var factRows = $app.findRecordsByFilter('factories', '1=1', '', 5000, 0)
      for (var fi = 0; fi < factRows.length; fi++) {
        var f = factRows[fi]
        var stage = (f.getString ? f.getString('funnelStage') : f.funnelStage) || 'Lead'
        var potVal = (f.getInt ? f.getInt('potentialValue') : f.potentialValue) || 0
        var valMedio = (f.getInt ? f.getInt('valor_medio') : f.valor_medio) || 0
        var valAtual = (f.getInt ? f.getInt('valor_atual') : f.valor_atual) || 0
        var effectiveVal = potVal || valAtual || valMedio || 0

        if (
          stage === 'Lead' ||
          stage === 'Primeiro Contato' ||
          stage === 'Diagnóstico Técnico' ||
          stage === 'Apresentação' ||
          stage === 'Teste/Trial'
        ) {
          stagesMap['Leads'].quantidade++
          stagesMap['Leads'].valor_brl += effectiveVal
        } else if (stage === 'Proposta' || stage === 'Negociação') {
          stagesMap['Propostas'].quantidade++
          stagesMap['Propostas'].valor_brl += effectiveVal
        }
      }
    } catch (errFact) {
      $app.logger().warn('maestro_funil: erro ao ler factories', 'error', String(errFact))
    }

    try {
      var MESES_NOMES = [
        '',
        'janeiro',
        'fevereiro',
        'março',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro',
      ]
      var mesNome = MESES_NOMES[curMonth]
      var sumCart = 0
      var qtdCart = 0
      if (mesNome) {
        var cartRows = $app.findRecordsByFilter(
          'pedidos_carteira',
          "mes = '" + mesNome + "'",
          '',
          1000,
          0,
        )
        for (var ci = 0; ci < cartRows.length; ci++) {
          var cItem = cartRows[ci]
          sumCart += (cItem.getInt ? cItem.getInt('valor') : cItem.valor) || 0
          qtdCart++
        }
      }

      var orderRows = $app.findRecordsByFilter('orders', '1=1', '', 1000, 0)
      for (var oi = 0; oi < orderRows.length; oi++) {
        var oItem = orderRows[oi]
        sumCart += (oItem.getInt ? oItem.getInt('totalValue') : oItem.totalValue) || 0
        qtdCart++
      }

      stagesMap['Pedidos'].quantidade = qtdCart
      stagesMap['Pedidos'].valor_brl = Math.round(sumCart * 100) / 100
    } catch (errOrders) {
      $app.logger().warn('maestro_funil: erro ao ler orders', 'error', String(errOrders))
    }

    try {
      var fatRows = $app.findRecordsByFilter(
        'faturamento',
        'ano = ' + curYear + ' && mes = ' + curMonth,
        '',
        5000,
        0,
      )
      var sumFat = 0
      for (var fti = 0; fti < fatRows.length; fti++) {
        var ftItem = fatRows[fti]
        sumFat += (ftItem.getInt ? ftItem.getInt('valor_brl') : ftItem.valor_brl) || 0
      }
      stagesMap['Faturado'].quantidade = fatRows.length
      stagesMap['Faturado'].valor_brl = Math.round(sumFat * 100) / 100
    } catch (errFat) {
      $app.logger().warn('maestro_funil: erro ao ler faturamento', 'error', String(errFat))
    }

    var metaMensal = 0
    try {
      var metaRows = $app.findRecordsByFilter('metas', '1=1', '', 500, 0)
      for (var mi = 0; mi < metaRows.length; mi++) {
        metaMensal +=
          (metaRows[mi].getInt ? metaRows[mi].getInt('meta_valor') : metaRows[mi].meta_valor) || 0
      }
    } catch (_) {}

    var etapas = [
      stagesMap['Leads'],
      stagesMap['Propostas'],
      stagesMap['Pedidos'],
      stagesMap['Faturado'],
    ]

    var conversao = []
    for (var k = 0; k < etapas.length - 1; k++) {
      var de = etapas[k]
      var para = etapas[k + 1]
      var taxa = 0
      if (de.valor_brl > 0) {
        taxa = Math.round((para.valor_brl / de.valor_brl) * 10000) / 100
      } else if (de.quantidade > 0) {
        taxa = Math.round((para.quantidade / de.quantidade) * 10000) / 100
      }
      conversao.push({
        de_etapa: de.nome,
        para_etapa: para.nome,
        taxa: taxa,
      })
    }

    var realizado = stagesMap['Faturado'].valor_brl
    var cobertura = metaMensal > 0 ? Math.round((realizado / metaMensal) * 10000) / 100 : 0

    var result = {
      etapas: etapas,
      conversao: conversao,
      fechado_versus_meta: {
        meta: Math.round(metaMensal * 100) / 100,
        realizado: Math.round(realizado * 100) / 100,
        cobertura: cobertura,
      },
      updated_at: new Date().toISOString(),
    }

    try {
      var acCol = $app.findCollectionByNameOrId('automation_cache')
      var acRecord = null
      try {
        acRecord = $app.findFirstRecordByFilter('automation_cache', 'cache_key = {:ck}', {
          ck: cacheKey,
        })
      } catch (_) {}

      var rec = acRecord || new Record(acCol)
      rec.set('cache_key', cacheKey)
      rec.set('data', result)
      rec.set('periodo', curYear + '-' + pad(curMonth, 2))
      rec.set('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
      $app.save(rec)
    } catch (errSave) {
      $app.logger().warn('maestro_funil: failed to save cache', 'error', String(errSave))
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
