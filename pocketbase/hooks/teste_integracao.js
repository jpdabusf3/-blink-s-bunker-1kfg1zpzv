routerAdd('GET', '/backend/v1/teste-integracao', (e) => {
  var collections = {}
  var allOk = true

  var names = [
    'factories',
    'atividades',
    'metas',
    'users',
    'faturamento',
    'automation_cache',
    'dashboard_preferences',
    'documents',
  ]
  for (var i = 0; i < names.length; i++) {
    var exists = false
    try {
      $app.findCollectionByNameOrId(names[i])
      exists = true
    } catch (_) {
      exists = false
      allOk = false
    }
    collections[names[i]] = exists
  }

  // Executa teste de inicialização do cache do funil se trigger_funil=1
  var funilTest = null
  if (e.request.url.query().get('trigger_funil') === '1') {
    try {
      var now = new Date()
      var curYear = now.getUTCFullYear()
      var curMonth = now.getUTCMonth() + 1
      var pad = function (n) {
        return (n < 10 ? '0' : '') + n
      }
      var cacheKey = 'funil_vendas_' + curYear + '_' + pad(curMonth)
      var periodoStr = curYear + '-' + pad(curMonth)

      // Calcula e popula se não existir
      var stagesMap = {
        Leads: { nome: 'Leads', quantidade: 0, valor_brl: 0 },
        Propostas: { nome: 'Propostas', quantidade: 0, valor_brl: 0 },
        Pedidos: { nome: 'Pedidos', quantidade: 0, valor_brl: 0 },
        Faturado: { nome: 'Faturado', quantidade: 0, valor_brl: 0 },
      }

      var factRows = $app.findRecordsByFilter('factories', '1=1', '', 1000, 0)
      for (var fi = 0; fi < factRows.length; fi++) {
        var f = factRows[fi]
        var stage = (f.getString ? f.getString('funnelStage') : f.funnelStage) || 'Lead'
        var potVal = (f.getInt ? f.getInt('potentialValue') : f.potentialValue) || 0
        if (stage === 'Lead' || stage === 'Primeiro Contato') {
          stagesMap['Leads'].quantidade++
          stagesMap['Leads'].valor_brl += potVal
        } else if (stage === 'Proposta' || stage === 'Negociação') {
          stagesMap['Propostas'].quantidade++
          stagesMap['Propostas'].valor_brl += potVal
        }
      }

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
        var taxa = de.valor_brl > 0 ? Math.round((para.valor_brl / de.valor_brl) * 10000) / 100 : 0
        conversao.push({ de_etapa: de.nome, para_etapa: para.nome, taxa: taxa })
      }

      var result = {
        etapas: etapas,
        conversao: conversao,
        fechado_versus_meta: { meta: 0, realizado: 0, cobertura: 0 },
        updated_at: new Date().toISOString(),
      }

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
      rec.set('periodo', periodoStr)
      rec.set('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
      $app.save(rec)
      funilTest = result

      // Registra activity_log de automação
      var logCol = $app.findCollectionByNameOrId('activity_logs')
      var userRecord = $app.findRecordsByFilter('users', '1=1', '', 1, 0)[0]
      if (userRecord) {
        var logRec = new Record(logCol)
        logRec.set('user', userRecord.id)
        logRec.set('action', 'automation')
        logRec.set('details', 'Execução MAESTRO: Funil de vendas recalculado para ' + periodoStr)
        logRec.set('origem', 'painel')
        logRec.set('tipo', 'outro')
        logRec.set('target_collection', 'automation_cache')
        $app.save(logRec)
      }
    } catch (_) {}
  }

  return e.json(200, {
    status: 'ok',
    banco: 'conectado',
    collections: collections,
    allCollectionsExist: allOk,
    funilTest: funilTest,
  })
})
