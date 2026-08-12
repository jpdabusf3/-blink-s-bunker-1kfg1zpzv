onRecordAfterCreateSuccess((e) => {
  e.next()
  try {
    var metas = $app.findRecordsByFilter('metas', '1=1', '-created', 1000, 0)
    if (metas.length === 0) return

    var allSales = $app.findRecordsByFilter('historico_vendas', '1=1', '-data', 50000, 0)
    var MONTHS = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]
    var now = new Date().toISOString()

    for (var i = 0; i < metas.length; i++) {
      var meta = metas[i]
      var mVend = meta.getString('vendedor_id') || ''
      var mGest = meta.getString('gestor_tecnico_id') || ''
      var mEsp = meta.getString('especie') || ''
      var mPer = meta.getString('periodo') || ''
      var mCanal = meta.getString('canal_vendas') || ''

      var total = 0
      for (var j = 0; j < allSales.length; j++) {
        var sale = allSales[j]
        var sPer = ''
        var sd = sale.getString('data') || ''
        if (sd) {
          var d = new Date(sd)
          if (!isNaN(d.getTime())) sPer = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear()
        }
        if (sPer !== mPer) continue
        if (mVend && mVend !== (sale.getString('vendedor_id') || '')) continue
        if (mGest && mGest !== (sale.getString('gestor_tecnico_id') || '')) continue
        if (mEsp && mEsp !== (sale.getString('especie') || '')) continue
        if (mCanal && mCanal !== (sale.getString('canal_vendas') || '')) continue
        total += sale.getFloat('valor') || 0
      }

      var rec = $app.findRecordById('metas', meta.id)
      rec.set('valor_realizado', total)
      rec.set('atualizado_em', now)
      $app.save(rec)
    }
  } catch (err) {
    $app.logger().error('metas recalc (vendas create) error', 'error', String(err))
  }
}, 'historico_vendas')
