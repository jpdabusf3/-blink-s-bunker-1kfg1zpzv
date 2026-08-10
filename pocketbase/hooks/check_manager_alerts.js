cronAdd('check_manager_alerts', '0 8 * * *', () => {
  var managers = []
  try {
    managers = $app.findRecordsByFilter(
      'gestao_tecnica',
      "funcao = 'gestor_tecnico' && ativo = true",
      '',
      1000,
      0,
    )
  } catch (_) {
    return
  }

  var now = new Date()
  var alertsCreated = 0

  var monthNames = [
    'janeiro',
    'fevereiro',
    'marco',
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
  var monthAbbrev = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ]

  for (var i = 0; i < managers.length; i++) {
    var manager = managers[i]
    var managerId = manager.id
    var managerName = manager.getString('nome') || ''
    var managerRegion = manager.getString('regiao') || ''

    var metas = []
    try {
      metas = $app.findRecordsByFilter(
        'metas',
        "gestor_tecnico_id = '" + managerId + "'",
        '-created',
        1000,
        0,
      )
    } catch (_) {
      continue
    }

    for (var j = 0; j < metas.length; j++) {
      var meta = metas[j]
      var metaValor = meta.getFloat('meta_valor')
      var valorRealizado = meta.getFloat('valor_realizado')
      var periodo = meta.getString('periodo') || ''

      if (metaValor <= 0) continue
      if (valorRealizado >= metaValor * 0.5) continue

      var parsed = null
      var p = periodo.toLowerCase().trim()

      var m1 = p.match(/(\d{4})-(\d{1,2})/)
      if (m1) {
        parsed = { year: parseInt(m1[1]), month: parseInt(m1[2]) }
      } else {
        var m2 = p.match(/(\d{1,2})\/(\d{4})/)
        if (m2) {
          parsed = { year: parseInt(m2[2]), month: parseInt(m2[1]) }
        } else {
          for (var mi = 0; mi < 12; mi++) {
            if (p.indexOf(monthNames[mi]) !== -1 || p.indexOf(monthAbbrev[mi]) !== -1) {
              var ym = p.match(/(\d{4})/)
              if (ym) {
                parsed = { year: parseInt(ym[1]), month: mi + 1 }
                break
              }
            }
          }
        }
      }

      if (!parsed) continue
      if (parsed.month < 1 || parsed.month > 12) continue

      var periodMidpoint = new Date(parsed.year, parsed.month - 1, 15, 0, 0, 0)
      if (now.getTime() < periodMidpoint.getTime()) continue

      var periodEnd = new Date(parsed.year, parsed.month, 0, 23, 59, 59)
      if (now.getTime() > periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000) continue

      var vendedorId = meta.getString('vendedor_id') || ''
      var vendedorName = 'N/A'
      if (vendedorId) {
        try {
          var vendedor = $app.findRecordById('gestao_tecnica', vendedorId)
          vendedorName = vendedor.getString('nome') || 'N/A'
        } catch (_) {}
      }

      var pct = (valorRealizado / metaValor) * 100
      var milestone = 'manager_alert_' + vendedorId + '_' + periodo

      try {
        $app.findFirstRecordByFilter('notifications', 'milestone={:m} && type={:t}', {
          m: milestone,
          t: 'performance_alert',
        })
        continue
      } catch (_) {}

      var userId = ''
      if (managerName) {
        try {
          var userRecord = $app.findFirstRecordByFilter('users', 'name={:n}', { n: managerName })
          userId = userRecord.id
        } catch (_) {}
      }

      var notifCol = $app.findCollectionByNameOrId('notifications')
      var record = new Record(notifCol)
      record.set('title', 'Vendedor abaixo da meta')
      record.set(
        'message',
        vendedorName +
          ' esta em ' +
          pct.toFixed(1) +
          '% da meta (R$ ' +
          valorRealizado.toFixed(2) +
          ' de R$ ' +
          metaValor.toFixed(2) +
          ') - Periodo: ' +
          periodo +
          ' - Gestor: ' +
          managerName,
      )
      record.set('type', 'performance_alert')
      record.set('region', managerRegion)
      record.set('isRead', false)
      record.set('read', false)
      record.set('milestone', milestone)
      if (userId) {
        record.set('userId', userId)
      }

      try {
        $app.save(record)
        alertsCreated++
      } catch (_) {}
    }
  }

  $app.logger().info('manager alerts check completed', 'alertsCreated', alertsCreated)
})
