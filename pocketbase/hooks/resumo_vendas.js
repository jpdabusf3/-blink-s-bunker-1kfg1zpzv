// pocketbase/hooks/resumo_vendas.js
// Endpoint oficial resumo-vendas (CORS, Auth PB, aggregations de faturamento/vendas, metas, cobertura e vendedores)

routerAdd('OPTIONS', '/backend/v1/resumo_vendas', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  return e.noContent(204)
})

routerAdd('OPTIONS', '/backend/v1/resumo-vendas', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  return e.noContent(204)
})

routerAdd(
  'POST',
  '/backend/v1/resumo-vendas',
  (e) => {
    e.response.header().set('Access-Control-Allow-Origin', '*')
    e.response.header().set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    e.response
      .header()
      .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')

    try {
      var userId = e.auth && e.auth.id
      if (!userId) {
        return e.json(401, { error: 'Nao autorizado' })
      }

      function pad(n) {
        return n < 10 ? '0' + n : '' + n
      }

      function getIsoWeek(dateObj) {
        var d = new Date(
          Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()),
        )
        var dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      }

      // Normalização canônica do nome do vendedor: João Pedro -> João Figueiredo
      function normalizeSellerName(rawName) {
        if (!rawName) return ''
        var s = String(rawName).trim()
        var lower = s.toLowerCase()
        if (lower === 'joão pedro' || lower === 'joao pedro' || lower === 'joao figueiredo') {
          return 'João Figueiredo'
        }
        return s
      }

      // Normalização de segmentos canônicos (AVES, PETS, RUMINANTES, SUINOS)
      function normalizeSegment(seg) {
        if (!seg) return ''
        var u = String(seg).trim().toUpperCase()
        if (u.indexOf('AVE') !== -1 || u.indexOf('FRANGO') !== -1 || u === 'MO-BE') return 'AVES'
        if (
          u.indexOf('PET') !== -1 ||
          u.indexOf('CÃO') !== -1 ||
          u.indexOf('CAO') !== -1 ||
          u.indexOf('GATO') !== -1 ||
          u === 'MI-XS'
        )
          return 'PETS'
        if (
          u.indexOf('RUMINANTE') !== -1 ||
          u.indexOf('BOVIN') !== -1 ||
          u.indexOf('GADO') !== -1 ||
          u.indexOf('LEITE') !== -1 ||
          u.indexOf('CORTE') !== -1 ||
          u === 'MI-OR'
        )
          return 'RUMINANTES'
        if (u.indexOf('SUIN') !== -1 || u.indexOf('PORCO') !== -1 || u === 'MY-CO') return 'SUINOS'
        if (u.indexOf('AQUA') !== -1 || u.indexOf('PEIXE') !== -1) return 'AQUA'
        return ''
      }

      // Resolução de família canônica Blink
      function resolveFamilia(prodCod, rawFam) {
        var cod = String(prodCod || '')
          .trim()
          .toUpperCase()
        var raw = String(rawFam || '')
          .trim()
          .toUpperCase()

        if (
          cod.indexOf('BBMI.XS') === 0 ||
          cod.indexOf('BPMI.XS') === 0 ||
          cod.indexOf('MI-XS') === 0 ||
          cod.indexOf('MI.XS') === 0
        ) {
          return 'Blends'
        }
        if (
          cod.indexOf('BBMO.BE') === 0 ||
          cod.indexOf('BPMO.BE') === 0 ||
          cod.indexOf('MO-BE') === 0 ||
          cod.indexOf('MO.BE') === 0
        ) {
          return 'Mos/BetaLink'
        }
        if (
          cod.indexOf('BBMY.CO') === 0 ||
          cod.indexOf('BPMY.CO') === 0 ||
          cod.indexOf('MY-CO') === 0 ||
          cod.indexOf('MY.CO') === 0
        ) {
          return 'Mycolink'
        }
        if (
          cod.indexOf('BBMI.OR') === 0 ||
          cod.indexOf('BPMI.OR') === 0 ||
          cod.indexOf('MI-OR') === 0 ||
          cod.indexOf('MI.OR') === 0
        ) {
          return 'Minerais Orgânicos'
        }
        if (
          cod.indexOf('BBMY.ST') === 0 ||
          cod.indexOf('BPMY.ST') === 0 ||
          cod.indexOf('MY-ST') === 0 ||
          cod.indexOf('MY.ST') === 0
        ) {
          return 'Leveduras'
        }

        if (raw === 'MI-XS' || raw === 'MI.XS' || raw === 'BLENDS') return 'Blends'
        if (
          raw === 'MO-BE' ||
          raw === 'MO.BE' ||
          raw === 'MOS/BETALINK' ||
          raw === 'PREBIÓTICOS' ||
          raw === 'ADITIVOS'
        )
          return 'Mos/BetaLink'
        if (raw === 'MY-CO' || raw === 'MY.CO' || raw === 'MYCOLINK' || raw === 'ADSORVENTES')
          return 'Mycolink'
        if (raw === 'MI-OR' || raw === 'MI.OR' || raw.indexOf('MINERAIS') !== -1)
          return 'Minerais Orgânicos'
        if (
          raw === 'MY-ST' ||
          raw === 'MY.ST' ||
          raw === 'LEVEDURAS' ||
          raw === 'INGREDIENTES' ||
          raw === 'SUPLEMENTOS'
        )
          return 'Leveduras'

        if (raw && raw !== '—' && raw !== '-' && raw !== '?') return raw
        return 'Outros'
      }

      var now = new Date()
      var curYear = now.getUTCFullYear()
      var curMonth = now.getUTCMonth() + 1
      var curWeek = getIsoWeek(now)

      // Suporta query params ou POST body
      var body = {}
      try {
        body = e.requestInfo().body || {}
      } catch (_) {
        body = {}
      }

      var qMode = e.request.url.query().get('mode') || body.mode || 'month'
      var qAno = e.request.url.query().get('ano') || body.ano
      var qMes = e.request.url.query().get('mes') || body.mes
      var qSemana = e.request.url.query().get('semana') || body.semana

      var mode = String(qMode).toLowerCase()
      var targetYear = qAno ? parseInt(qAno, 10) : curYear
      var targetMonth = qMes ? parseInt(qMes, 10) : curMonth
      var targetWeek = qSemana ? parseInt(qSemana, 10) : curWeek

      var MESES_CAP = [
        '',
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

      // 1. CARTEIRA DE PEDIDOS (pedidos_carteira + pedidos com status ABERTO)
      var carteiraTotalBrl = 0
      try {
        var cartRows = $app.findRecordsByFilter('pedidos_carteira', '1=1', '', 1000, 0)
        for (var ci = 0; ci < cartRows.length; ci++) {
          var cr = cartRows[ci]
          carteiraTotalBrl += (cr.getInt ? cr.getInt('valor') : cr.valor) || 0
        }
      } catch (errCart) {
        $app
          .logger()
          .warn('resumo-vendas: erro ao consultar pedidos_carteira', 'error', String(errCart))
      }

      try {
        var pedAbertos = $app.findRecordsByFilter('pedidos', "status = 'ABERTO'", '', 1000, 0)
        for (var pa = 0; pa < pedAbertos.length; pa++) {
          var por = pedAbertos[pa]
          carteiraTotalBrl += (por.getInt ? por.getInt('valorTotal') : por.valorTotal) || 0
        }
      } catch (_) {}

      carteiraTotalBrl = Math.round(carteiraTotalBrl * 100) / 100

      // 2. METAS DO PERÍODO
      var metaBrl = 0
      try {
        var mesCap = MESES_CAP[targetMonth] || ''
        var mesExtAno = mesCap ? mesCap + ' ' + targetYear : ''
        var yyyyMm = targetYear + '-' + pad(targetMonth)
        var yyyyMmDd = yyyyMm + '-01'

        var metasRows = $app.findRecordsByFilter(
          'metas',
          "periodo = '" +
            yyyyMm +
            "' || periodo = '" +
            yyyyMmDd +
            "' || periodo = '" +
            mesExtAno +
            "' || (ano = " +
            targetYear +
            ' && mes = ' +
            targetMonth +
            ')',
          '',
          500,
          0,
        )

        for (var mi = 0; mi < metasRows.length; mi++) {
          var mRow = metasRows[mi]
          var mv =
            (mRow.getInt ? mRow.getInt('meta_valor') : mRow.meta_valor) ||
            (mRow.getInt ? mRow.getInt('valor_meta') : mRow.valor_meta) ||
            0
          metaBrl += mv
        }
        metaBrl = Math.round(metaBrl * 100) / 100
      } catch (errMeta) {
        $app.logger().warn('resumo-vendas: erro ao consultar metas', 'error', String(errMeta))
        metaBrl = 0
      }

      // 3. COBERTURA COMERCIAL CANÔNICA (carteira ÷ meta do período)
      var coberturaPercent =
        metaBrl > 0 ? Math.round((carteiraTotalBrl / metaBrl) * 10000) / 100 : null

      // 4. FATURAMENTO TOTAL DO ANO ATUAL (Year to Date)
      var ytdBrl = 0
      var allYearRecords = []
      try {
        allYearRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && is_deleted != true',
          '',
          10000,
          0,
        )
        for (var y = 0; y < allYearRecords.length; y++) {
          var yVal =
            (allYearRecords[y].getInt
              ? allYearRecords[y].getInt('valor_brl')
              : allYearRecords[y].valor_brl) || 0
          ytdBrl += yVal
        }
      } catch (errYtd) {
        $app.logger().warn('resumo-vendas: erro ytd faturamento', 'error', String(errYtd))
      }
      ytdBrl = Math.round(ytdBrl * 100) / 100

      // 5. REGISTROS DO PERÍODO SELECIONADO E ANTERIOR
      var currentRecords = []
      var prevRecords = []
      var periodoLabel = targetYear + '-' + pad(targetMonth)

      if (mode === 'week') {
        periodoLabel = targetYear + '-W' + pad(targetWeek)
        currentRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && semana_iso = ' + targetWeek + ' && is_deleted != true',
          '-valor_brl',
          5000,
          0,
        )
        var prevW = targetWeek - 1
        var prevYW = targetYear
        if (prevW < 1) {
          prevW = 52
          prevYW = targetYear - 1
        }
        prevRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + prevYW + ' && semana_iso = ' + prevW + ' && is_deleted != true',
          '',
          500,
          0,
        )
      } else {
        currentRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && mes = ' + targetMonth + ' && is_deleted != true',
          '-valor_brl',
          5000,
          0,
        )
        var prevM = targetMonth - 1
        var prevYM = targetYear
        if (prevM < 1) {
          prevM = 12
          prevYM = targetYear - 1
        }
        prevRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + prevYM + ' && mes = ' + prevM + ' && is_deleted != true',
          '',
          5000,
          0,
        )
      }

      // 6. MAPA DE CLIENTES / FACTORIES PARA RESOLVER CARTEIRA / SEGMENTO E VENDEDOR
      var factoriesMap = {}
      try {
        var facList = $app.findRecordsByFilter('factories', 'is_deleted != true', '', 2000, 0)
        for (var fIdx = 0; fIdx < facList.length; fIdx++) {
          var fc = facList[fIdx]
          var fName = (fc.getString ? fc.getString('name') : fc.name || '').trim().toLowerCase()
          var fCod = (fc.getString ? fc.getString('codigo_cliente') : fc.codigo_cliente || '')
            .trim()
            .toLowerCase()
          var fCart = fc.getString ? fc.getString('carteira') : fc.carteira || ''
          var fEsp = fc.getString ? fc.getString('animalSpecies') : fc.animalSpecies || ''
          var fVend = fc.getString ? fc.getString('vendedor_name') : fc.vendedor_name || ''
          var fObj = {
            carteira: fCart,
            animalSpecies: fEsp,
            vendedor: normalizeSellerName(fVend),
          }
          if (fName) factoriesMap['N_' + fName] = fObj
          if (fCod) factoriesMap['C_' + fCod] = fObj
        }
      } catch (_) {}

      // 7. AGREGAR INDICADORES DO MÊS / PERÍODO
      var totalBrl = 0
      var totalUsd = 0
      var clienteMap = {}
      var familiaMap = {}
      var activeClientsSet = {}
      var notasSet = {}

      // Vendas por segmento (AVES, PETS, RUMINANTES, SUINOS) - ano corrente e período
      var segmentYearMap = { AVES: 0, PETS: 0, RUMINANTES: 0, SUINOS: 0 }
      var segmentPeriodMap = { AVES: 0, PETS: 0, RUMINANTES: 0, SUINOS: 0 }

      // Vendas por vendedor
      var sellerMap = {}

      // Processar período atual
      for (var i = 0; i < currentRecords.length; i++) {
        var r = currentRecords[i]
        var vBrl = (r.getInt ? r.getInt('valor_brl') : r.valor_brl) || 0
        var vUsd = (r.getInt ? r.getInt('valor_usd') : r.valor_usd) || 0
        totalBrl += vBrl
        totalUsd += vUsd

        var cNome = (r.getString ? r.getString('cliente_nome') : r.cliente_nome) || ''
        var cCod = (r.getString ? r.getString('cliente_codigo') : r.cliente_codigo) || ''
        var cDisplay = cNome || cCod || 'Outros'
        clienteMap[cDisplay] = (clienteMap[cDisplay] || 0) + vBrl
        if (cDisplay) activeClientsSet[cDisplay] = true

        var prodCod = r.getString ? r.getString('produto_codigo') : r.produto_codigo || ''
        var famBruta = (r.getString ? r.getString('familia_produto') : r.familia_produto) || ''
        var famResolved = resolveFamilia(prodCod, famBruta)
        familiaMap[famResolved] = (familiaMap[famResolved] || 0) + vBrl

        // Vendedor
        var rawVend = (r.getString ? r.getString('vendedor') : r.vendedor) || ''
        var facMatch =
          factoriesMap['N_' + cNome.trim().toLowerCase()] ||
          factoriesMap['C_' + cCod.trim().toLowerCase()]
        if (!rawVend && facMatch && facMatch.vendedor) {
          rawVend = facMatch.vendedor
        }
        var canonSeller = normalizeSellerName(rawVend) || 'Não atribuído'
        sellerMap[canonSeller] = (sellerMap[canonSeller] || 0) + vBrl

        // Segmento
        var rawSeg = facMatch ? facMatch.carteira || facMatch.animalSpecies : ''
        var normSeg = normalizeSegment(rawSeg)
        if (!normSeg) {
          if (famResolved === 'Minerais Orgânicos') normSeg = 'RUMINANTES'
          else if (famResolved === 'Mos/BetaLink') normSeg = 'AVES'
          else if (famResolved === 'Blends') normSeg = 'PETS'
          else if (famResolved === 'Mycolink') normSeg = 'SUINOS'
        }
        if (normSeg && segmentPeriodMap[normSeg] !== undefined) {
          segmentPeriodMap[normSeg] += vBrl
        }

        var nfAnoVal = (r.getInt ? r.getInt('nf_ano') : r.nf_ano) || 0
        var docData = r.getString ? r.getString('data_documento') : r.data_documento || ''
        var docKey =
          nfAnoVal > 0 ? nfAnoVal + '_' + cCod + '_' + docData : docData + '_' + cCod + '_' + i
        notasSet[docKey] = true
      }

      // Processar vendas por segmento no ano atual (current year)
      for (var yi = 0; yi < allYearRecords.length; yi++) {
        var yr = allYearRecords[yi]
        var yvBrl = (yr.getInt ? yr.getInt('valor_brl') : yr.valor_brl) || 0
        var ycn = (yr.getString ? yr.getString('cliente_nome') : yr.cliente_nome) || ''
        var ycc = (yr.getString ? yr.getString('cliente_codigo') : yr.cliente_codigo) || ''
        var ypc = yr.getString ? yr.getString('produto_codigo') : yr.produto_codigo || ''
        var yfb = (yr.getString ? yr.getString('familia_produto') : yr.familia_produto) || ''

        var yfac =
          factoriesMap['N_' + ycn.trim().toLowerCase()] ||
          factoriesMap['C_' + ycc.trim().toLowerCase()]
        var ySeg = normalizeSegment(yfac ? yfac.carteira || yfac.animalSpecies : '')
        if (!ySeg) {
          var yFam = resolveFamilia(ypc, yfb)
          if (yFam === 'Minerais Orgânicos') ySeg = 'RUMINANTES'
          else if (yFam === 'Mos/BetaLink') ySeg = 'AVES'
          else if (yFam === 'Blends') ySeg = 'PETS'
          else if (yFam === 'Mycolink') ySeg = 'SUINOS'
        }
        if (ySeg && segmentYearMap[ySeg] !== undefined) {
          segmentYearMap[ySeg] += yvBrl
        }
      }

      // 8. EVOLUÇÃO MENSAL (ÚLTIMOS 12 MESES)
      var evolucaoMensal = []
      for (var mOffset = 11; mOffset >= 0; mOffset--) {
        var dCur = new Date(targetYear, targetMonth - 1 - mOffset, 1)
        var ey = dCur.getFullYear()
        var em = dCur.getMonth() + 1
        var mKey = ey + '-' + pad(em)
        var mShort = MESES_CAP[em] ? MESES_CAP[em].substring(0, 3) : 'M' + em
        var mLabel = mShort + '/' + String(ey).slice(2)

        var mSum = 0
        try {
          var mRecs = $app.findRecordsByFilter(
            'faturamento',
            'ano = ' + ey + ' && mes = ' + em + ' && is_deleted != true',
            '',
            5000,
            0,
          )
          for (var mi2 = 0; mi2 < mRecs.length; mi2++) {
            mSum += (mRecs[mi2].getInt ? mRecs[mi2].getInt('valor_brl') : mRecs[mi2].valor_brl) || 0
          }
        } catch (_) {}

        evolucaoMensal.push({
          ano: ey,
          mes: em,
          label: mLabel,
          key: mKey,
          valor_brl: Math.round(mSum * 100) / 100,
        })
      }

      // 9. METAS POR VENDEDOR (com targets, realizado, percentual e status badge)
      var metasPorVendedor = []
      try {
        var allMetasVendedores = $app.findRecordsByFilter(
          'metas',
          'ano = ' + targetYear + ' && mes = ' + targetMonth,
          '',
          500,
          0,
        )

        var sellerMetaAgg = {}
        for (var mvIdx = 0; mvIdx < allMetasVendedores.length; mvIdx++) {
          var mItem = allMetasVendedores[mvIdx]
          var sName =
            normalizeSellerName(
              mItem.getString
                ? mItem.getString('vendedor_nome') || mItem.getString('vendedor')
                : mItem.vendedor_nome || mItem.vendedor,
            ) || 'Não atribuído'
          var sMetaVal =
            (mItem.getInt ? mItem.getInt('valor_meta') : mItem.valor_meta) ||
            (mItem.getInt ? mItem.getInt('meta_valor') : mItem.meta_valor) ||
            0
          sellerMetaAgg[sName] = (sellerMetaAgg[sName] || 0) + sMetaVal
        }

        // Adicionar vendedores com vendas mesmo sem meta cadastrada
        var allSellersSet = {}
        for (var s1 in sellerMetaAgg) allSellersSet[s1] = true
        for (var s2 in sellerMap) allSellersSet[s2] = true

        for (var sKey in allSellersSet) {
          var sMeta = sellerMetaAgg[sKey] || 0
          var sAchieved = sellerMap[sKey] || 0
          var sPct =
            sMeta > 0 ? Math.round((sAchieved / sMeta) * 10000) / 100 : sAchieved > 0 ? 100 : 0
          var sStatus = 'vermelho'
          if (sPct >= 100) sStatus = 'verde'
          else if (sPct >= 70) sStatus = 'amarelo'

          metasPorVendedor.push({
            vendedor: sKey,
            meta_mensal: Math.round(sMeta * 100) / 100,
            valor_atingido: Math.round(sAchieved * 100) / 100,
            percentual_atingido: sPct,
            status: sStatus, // 'verde' | 'amarelo' | 'vermelho'
          })
        }
        metasPorVendedor.sort((a, b) => b.valor_atingido - a.valor_atingido)
      } catch (errMv) {
        $app.logger().warn('resumo-vendas: erro metas por vendedor', 'error', String(errMv))
      }

      // 10. COMPARAÇÃO COM PERÍODO ANTERIOR
      var prevTotalBrl = 0
      var prevNotasSet = {}
      for (var p = 0; p < prevRecords.length; p++) {
        var prRec = prevRecords[p]
        var prBrl = (prRec.getInt ? prRec.getInt('valor_brl') : prRec.valor_brl) || 0
        prevTotalBrl += prBrl
        var prDoc = prRec.getString ? prRec.getString('data_documento') : prRec.data_documento || ''
        var prCli = prRec.getString ? prRec.getString('cliente_codigo') : prRec.cliente_codigo || ''
        prevNotasSet[prDoc + '_' + prCli + '_' + p] = true
      }

      var variacaoFaturamento = null
      if (prevTotalBrl > 0) {
        variacaoFaturamento = Math.round(((totalBrl - prevTotalBrl) / prevTotalBrl) * 10000) / 100
      } else if (totalBrl > 0) {
        variacaoFaturamento = 100
      }

      var qtdNotas = Object.keys(notasSet).length || currentRecords.length
      var qtdNotasPrev = Object.keys(prevNotasSet).length || prevRecords.length
      var ticketMedio = qtdNotas > 0 ? Math.round((totalBrl / qtdNotas) * 100) / 100 : 0
      var ticketMedioPrev =
        qtdNotasPrev > 0 ? Math.round((prevTotalBrl / qtdNotasPrev) * 100) / 100 : 0
      var variacaoTicketMedio = null
      if (ticketMedioPrev > 0) {
        variacaoTicketMedio =
          Math.round(((ticketMedio - ticketMedioPrev) / ticketMedioPrev) * 10000) / 100
      } else if (ticketMedio > 0) {
        variacaoTicketMedio = 100
      }

      var clientesAtivosCount = Object.keys(activeClientsSet).length

      // 11. TOP 10 CLIENTES (rank, nome, total revenue, share percentage)
      var porCliente = Object.keys(clienteMap).map((k) => ({
        cliente: k,
        valor_brl: Math.round(clienteMap[k] * 100) / 100,
        share_percentual: totalBrl > 0 ? Math.round((clienteMap[k] / totalBrl) * 10000) / 100 : 0,
      }))
      porCliente.sort((a, b) => b.valor_brl - a.valor_brl)
      var top10Clientes = porCliente.slice(0, 10).map((c, idx) => ({
        rank: idx + 1,
        cliente: c.cliente,
        valor_brl: c.valor_brl,
        share_percentual: c.share_percentual,
      }))

      // 12. TOP 10 FAMÍLIAS (rank, nome, total revenue, share percentage)
      var porFamilia = Object.keys(familiaMap).map((k) => ({
        familia: k,
        valor_brl: Math.round(familiaMap[k] * 100) / 100,
        share_percentual: totalBrl > 0 ? Math.round((familiaMap[k] / totalBrl) * 10000) / 100 : 0,
      }))
      porFamilia.sort((a, b) => b.valor_brl - a.valor_brl)
      var top10Familias = porFamilia.slice(0, 10).map((f, idx) => ({
        rank: idx + 1,
        familia: f.familia,
        valor_brl: f.valor_brl,
        share_percentual: f.share_percentual,
      }))

      // 13. VENDAS POR SEGMENTO (AVES, PETS, RUMINANTES, SUINOS)
      var vendasPorSegmento = [
        {
          segmento: 'AVES',
          valor_ano: Math.round((segmentYearMap.AVES || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.AVES || 0) * 100) / 100,
        },
        {
          segmento: 'PETS',
          valor_ano: Math.round((segmentYearMap.PETS || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.PETS || 0) * 100) / 100,
        },
        {
          segmento: 'RUMINANTES',
          valor_ano: Math.round((segmentYearMap.RUMINANTES || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.RUMINANTES || 0) * 100) / 100,
        },
        {
          segmento: 'SUINOS',
          valor_ano: Math.round((segmentYearMap.SUINOS || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.SUINOS || 0) * 100) / 100,
        },
      ]

      // 14. ALERTAS DE CARTEIRA (em português com ícone, mensagem e data)
      // Regras:
      // a) Cliente sem pedidos nos últimos 60 dias
      // b) Cobertura abaixo de 70%
      // c) Segmento com zero vendas no mês corrente
      var alertasCarteira = []
      var hojeIso = now.toISOString()
      var sessentaDiasAtras = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

      // Alerta de Cobertura < 70%
      if (coberturaPercent !== null && coberturaPercent < 70) {
        alertasCarteira.push({
          id: 'alerta-cobertura-baixa',
          tipo: 'cobertura_baixa',
          severidade: 'critical',
          mensagem:
            'Cobertura de carteira em ' +
            coberturaPercent.toFixed(1).replace('.', ',') +
            '%, abaixo do limiar operacional de 70%.',
          data: hojeIso,
        })
      }

      // Alerta de segmentos com zero vendas no mês corrente
      var segmentosPrincipais = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS']
      for (var sIdx = 0; sIdx < segmentosPrincipais.length; sIdx++) {
        var segNome = segmentosPrincipais[sIdx]
        if (!segmentPeriodMap[segNome] || segmentPeriodMap[segNome] <= 0) {
          alertasCarteira.push({
            id: 'alerta-segmento-zero-' + segNome.toLowerCase(),
            tipo: 'segmento_zerado',
            severidade: 'warning',
            mensagem:
              'Segmento ' +
              segNome +
              ' com faturamento zerado no mês de ' +
              (MESES_CAP[targetMonth] || targetMonth) +
              '.',
            data: hojeIso,
          })
        }
      }

      // Alerta de clientes sem pedidos nos últimos 60 dias (verificar factories com último pedido)
      try {
        var facActiveList = $app.findRecordsByFilter(
          'factories',
          "tipo = 'Cliente' && status_funil = 'Ativo' && is_deleted != true",
          '-ultimo_pedido',
          50,
          0,
        )
        for (var fa = 0; fa < facActiveList.length; fa++) {
          var faRec = facActiveList[fa]
          var upDateStr = faRec.getString ? faRec.getString('ultimo_pedido') : faRec.ultimo_pedido
          var faName = (faRec.getString ? faRec.getString('name') : faRec.name) || 'Cliente'
          if (upDateStr) {
            var upDate = new Date(upDateStr)
            if (!isNaN(upDate.getTime()) && upDate < sessentaDiasAtras) {
              alertasCarteira.push({
                id: 'alerta-inatividade-' + faRec.id,
                tipo: 'cliente_inativo_60d',
                severidade: 'risk',
                mensagem:
                  'Cliente ' +
                  faName +
                  ' sem novos pedidos há mais de 60 dias (último em ' +
                  upDate.toLocaleDateString('pt-BR') +
                  ').',
                data: hojeIso,
              })
              if (alertasCarteira.length >= 8) break // limita para não poluir
            }
          }
        }
      } catch (_) {}

      // Resposta 200 completa
      return e.json(200, {
        periodo: periodoLabel,
        faturamento_mes: Math.round(totalBrl * 100) / 100,
        faturamento_ano_ytd: ytdBrl,
        clientes_ativos: clientesAtivosCount,
        ticket_medio: ticketMedio,
        carteira_total_brl: carteiraTotalBrl,
        meta_brl: metaBrl,
        cobertura_percent: coberturaPercent,
        variacao_faturamento_mes: variacaoFaturamento,
        variacao_ticket_medio: variacaoTicketMedio,
        top_clientes: top10Clientes,
        top_familias: top10Familias,
        metas_por_vendedor: metasPorVendedor,
        vendas_por_segmento: vendasPorSegmento,
        evolucao_mensal: evolucaoMensal,
        alertas_carteira: alertasCarteira,
        // Retrocompatibilidade para Maestro e abas legadas:
        faturado_total_brl: Math.round(totalBrl * 100) / 100,
        faturado_total_usd: Math.round(totalUsd * 100) / 100,
        meta_atingida_percent: metaBrl > 0 ? Math.round((totalBrl / metaBrl) * 10000) / 100 : null,
        por_cliente: top10Clientes.map((c) => ({ cliente: c.cliente, valor_brl: c.valor_brl })),
        por_familia: top10Familias.map((f) => ({ familia: f.familia, valor_brl: f.valor_brl })),
        quantidade_notas: qtdNotas,
        variacao_semana_anterior: variacaoFaturamento,
      })
    } catch (err) {
      console.error('resumo-vendas: erro ao processar resumo', err)
      $app.logger().error('resumo-vendas: erro ao processar resumo', 'error', String(err))
      return e.json(500, { error: 'Não foi possível processar o resumo de vendas.' })
    }
  },
  $apis.requireAuth(),
)

// Também suporta o path legado /backend/v1/resumo_vendas via re-registro idêntico ou chamada
routerAdd(
  'POST',
  '/backend/v1/resumo_vendas',
  (e) => {
    // Redireciona internamente invocando a mesma lógica
    e.response.header().set('Access-Control-Allow-Origin', '*')
    e.response.header().set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    e.response
      .header()
      .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')

    try {
      var userId = e.auth && e.auth.id
      if (!userId) {
        return e.json(401, { error: 'Nao autorizado' })
      }

      function pad(n) {
        return n < 10 ? '0' + n : '' + n
      }

      function getIsoWeek(dateObj) {
        var d = new Date(
          Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()),
        )
        var dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      }

      function normalizeSellerName(rawName) {
        if (!rawName) return ''
        var s = String(rawName).trim()
        var lower = s.toLowerCase()
        if (lower === 'joão pedro' || lower === 'joao pedro' || lower === 'joao figueiredo') {
          return 'João Figueiredo'
        }
        return s
      }

      function normalizeSegment(seg) {
        if (!seg) return ''
        var u = String(seg).trim().toUpperCase()
        if (u.indexOf('AVE') !== -1 || u.indexOf('FRANGO') !== -1 || u === 'MO-BE') return 'AVES'
        if (
          u.indexOf('PET') !== -1 ||
          u.indexOf('CÃO') !== -1 ||
          u.indexOf('CAO') !== -1 ||
          u.indexOf('GATO') !== -1 ||
          u === 'MI-XS'
        )
          return 'PETS'
        if (
          u.indexOf('RUMINANTE') !== -1 ||
          u.indexOf('BOVIN') !== -1 ||
          u.indexOf('GADO') !== -1 ||
          u.indexOf('LEITE') !== -1 ||
          u.indexOf('CORTE') !== -1 ||
          u === 'MI-OR'
        )
          return 'RUMINANTES'
        if (u.indexOf('SUIN') !== -1 || u.indexOf('PORCO') !== -1 || u === 'MY-CO') return 'SUINOS'
        if (u.indexOf('AQUA') !== -1 || u.indexOf('PEIXE') !== -1) return 'AQUA'
        return ''
      }

      function resolveFamilia(prodCod, rawFam) {
        var cod = String(prodCod || '')
          .trim()
          .toUpperCase()
        var raw = String(rawFam || '')
          .trim()
          .toUpperCase()

        if (
          cod.indexOf('BBMI.XS') === 0 ||
          cod.indexOf('BPMI.XS') === 0 ||
          cod.indexOf('MI-XS') === 0 ||
          cod.indexOf('MI.XS') === 0
        ) {
          return 'Blends'
        }
        if (
          cod.indexOf('BBMO.BE') === 0 ||
          cod.indexOf('BPMO.BE') === 0 ||
          cod.indexOf('MO-BE') === 0 ||
          cod.indexOf('MO.BE') === 0
        ) {
          return 'Mos/BetaLink'
        }
        if (
          cod.indexOf('BBMY.CO') === 0 ||
          cod.indexOf('BPMY.CO') === 0 ||
          cod.indexOf('MY-CO') === 0 ||
          cod.indexOf('MY.CO') === 0
        ) {
          return 'Mycolink'
        }
        if (
          cod.indexOf('BBMI.OR') === 0 ||
          cod.indexOf('BPMI.OR') === 0 ||
          cod.indexOf('MI-OR') === 0 ||
          cod.indexOf('MI.OR') === 0
        ) {
          return 'Minerais Orgânicos'
        }
        if (
          cod.indexOf('BBMY.ST') === 0 ||
          cod.indexOf('BPMY.ST') === 0 ||
          cod.indexOf('MY-ST') === 0 ||
          cod.indexOf('MY.ST') === 0
        ) {
          return 'Leveduras'
        }

        if (raw === 'MI-XS' || raw === 'MI.XS' || raw === 'BLENDS') return 'Blends'
        if (
          raw === 'MO-BE' ||
          raw === 'MO.BE' ||
          raw === 'MOS/BETALINK' ||
          raw === 'PREBIÓTICOS' ||
          raw === 'ADITIVOS'
        )
          return 'Mos/BetaLink'
        if (raw === 'MY-CO' || raw === 'MY.CO' || raw === 'MYCOLINK' || raw === 'ADSORVENTES')
          return 'Mycolink'
        if (raw === 'MI-OR' || raw === 'MI.OR' || raw.indexOf('MINERAIS') !== -1)
          return 'Minerais Orgânicos'
        if (
          raw === 'MY-ST' ||
          raw === 'MY.ST' ||
          raw === 'LEVEDURAS' ||
          raw === 'INGREDIENTES' ||
          raw === 'SUPLEMENTOS'
        )
          return 'Leveduras'

        if (raw && raw !== '—' && raw !== '-' && raw !== '?') return raw
        return 'Outros'
      }

      var now = new Date()
      var curYear = now.getUTCFullYear()
      var curMonth = now.getUTCMonth() + 1
      var curWeek = getIsoWeek(now)

      var body = {}
      try {
        body = e.requestInfo().body || {}
      } catch (_) {
        body = {}
      }

      var qMode = e.request.url.query().get('mode') || body.mode || 'month'
      var qAno = e.request.url.query().get('ano') || body.ano
      var qMes = e.request.url.query().get('mes') || body.mes
      var qSemana = e.request.url.query().get('semana') || body.semana

      var mode = String(qMode).toLowerCase()
      var targetYear = qAno ? parseInt(qAno, 10) : curYear
      var targetMonth = qMes ? parseInt(qMes, 10) : curMonth
      var targetWeek = qSemana ? parseInt(qSemana, 10) : curWeek

      var MESES_CAP = [
        '',
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

      var carteiraTotalBrl = 0
      try {
        var cartRows = $app.findRecordsByFilter('pedidos_carteira', '1=1', '', 1000, 0)
        for (var ci = 0; ci < cartRows.length; ci++) {
          var cr = cartRows[ci]
          carteiraTotalBrl += (cr.getInt ? cr.getInt('valor') : cr.valor) || 0
        }
      } catch (_) {}

      try {
        var pedAbertos = $app.findRecordsByFilter('pedidos', "status = 'ABERTO'", '', 1000, 0)
        for (var pa = 0; pa < pedAbertos.length; pa++) {
          var por = pedAbertos[pa]
          carteiraTotalBrl += (por.getInt ? por.getInt('valorTotal') : por.valorTotal) || 0
        }
      } catch (_) {}

      carteiraTotalBrl = Math.round(carteiraTotalBrl * 100) / 100

      var metaBrl = 0
      try {
        var mesCap = MESES_CAP[targetMonth] || ''
        var mesExtAno = mesCap ? mesCap + ' ' + targetYear : ''
        var yyyyMm = targetYear + '-' + pad(targetMonth)
        var yyyyMmDd = yyyyMm + '-01'

        var metasRows = $app.findRecordsByFilter(
          'metas',
          "periodo = '" +
            yyyyMm +
            "' || periodo = '" +
            yyyyMmDd +
            "' || periodo = '" +
            mesExtAno +
            "' || (ano = " +
            targetYear +
            ' && mes = ' +
            targetMonth +
            ')',
          '',
          500,
          0,
        )

        for (var mi = 0; mi < metasRows.length; mi++) {
          var mRow = metasRows[mi]
          var mv =
            (mRow.getInt ? mRow.getInt('meta_valor') : mRow.meta_valor) ||
            (mRow.getInt ? mRow.getInt('valor_meta') : mRow.valor_meta) ||
            0
          metaBrl += mv
        }
        metaBrl = Math.round(metaBrl * 100) / 100
      } catch (_) {
        metaBrl = 0
      }

      var coberturaPercent =
        metaBrl > 0 ? Math.round((carteiraTotalBrl / metaBrl) * 10000) / 100 : null

      var ytdBrl = 0
      var allYearRecords = []
      try {
        allYearRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && is_deleted != true',
          '',
          10000,
          0,
        )
        for (var y = 0; y < allYearRecords.length; y++) {
          var yVal =
            (allYearRecords[y].getInt
              ? allYearRecords[y].getInt('valor_brl')
              : allYearRecords[y].valor_brl) || 0
          ytdBrl += yVal
        }
      } catch (_) {}
      ytdBrl = Math.round(ytdBrl * 100) / 100

      var currentRecords = []
      var prevRecords = []
      var periodoLabel = targetYear + '-' + pad(targetMonth)

      if (mode === 'week') {
        periodoLabel = targetYear + '-W' + pad(targetWeek)
        currentRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && semana_iso = ' + targetWeek + ' && is_deleted != true',
          '-valor_brl',
          5000,
          0,
        )
        var prevW = targetWeek - 1
        var prevYW = targetYear
        if (prevW < 1) {
          prevW = 52
          prevYW = targetYear - 1
        }
        prevRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + prevYW + ' && semana_iso = ' + prevW + ' && is_deleted != true',
          '',
          500,
          0,
        )
      } else {
        currentRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && mes = ' + targetMonth + ' && is_deleted != true',
          '-valor_brl',
          5000,
          0,
        )
        var prevM = targetMonth - 1
        var prevYM = targetYear
        if (prevM < 1) {
          prevM = 12
          prevYM = targetYear - 1
        }
        prevRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + prevYM + ' && mes = ' + prevM + ' && is_deleted != true',
          '',
          5000,
          0,
        )
      }

      var factoriesMap = {}
      try {
        var facList = $app.findRecordsByFilter('factories', 'is_deleted != true', '', 2000, 0)
        for (var fIdx = 0; fIdx < facList.length; fIdx++) {
          var fc = facList[fIdx]
          var fName = (fc.getString ? fc.getString('name') : fc.name || '').trim().toLowerCase()
          var fCod = (fc.getString ? fc.getString('codigo_cliente') : fc.codigo_cliente || '')
            .trim()
            .toLowerCase()
          var fCart = fc.getString ? fc.getString('carteira') : fc.carteira || ''
          var fEsp = fc.getString ? fc.getString('animalSpecies') : fc.animalSpecies || ''
          var fVend = fc.getString ? fc.getString('vendedor_name') : fc.vendedor_name || ''
          var fObj = {
            carteira: fCart,
            animalSpecies: fEsp,
            vendedor: normalizeSellerName(fVend),
          }
          if (fName) factoriesMap['N_' + fName] = fObj
          if (fCod) factoriesMap['C_' + fCod] = fObj
        }
      } catch (_) {}

      var totalBrl = 0
      var totalUsd = 0
      var clienteMap = {}
      var familiaMap = {}
      var activeClientsSet = {}
      var notasSet = {}

      var segmentYearMap = { AVES: 0, PETS: 0, RUMINANTES: 0, SUINOS: 0 }
      var segmentPeriodMap = { AVES: 0, PETS: 0, RUMINANTES: 0, SUINOS: 0 }
      var sellerMap = {}

      for (var i = 0; i < currentRecords.length; i++) {
        var r = currentRecords[i]
        var vBrl = (r.getInt ? r.getInt('valor_brl') : r.valor_brl) || 0
        var vUsd = (r.getInt ? r.getInt('valor_usd') : r.valor_usd) || 0
        totalBrl += vBrl
        totalUsd += vUsd

        var cNome = (r.getString ? r.getString('cliente_nome') : r.cliente_nome) || ''
        var cCod = (r.getString ? r.getString('cliente_codigo') : r.cliente_codigo) || ''
        var cDisplay = cNome || cCod || 'Outros'
        clienteMap[cDisplay] = (clienteMap[cDisplay] || 0) + vBrl
        if (cDisplay) activeClientsSet[cDisplay] = true

        var prodCod = r.getString ? r.getString('produto_codigo') : r.produto_codigo || ''
        var famBruta = (r.getString ? r.getString('familia_produto') : r.familia_produto) || ''
        var famResolved = resolveFamilia(prodCod, famBruta)
        familiaMap[famResolved] = (familiaMap[famResolved] || 0) + vBrl

        var rawVend = (r.getString ? r.getString('vendedor') : r.vendedor) || ''
        var facMatch =
          factoriesMap['N_' + cNome.trim().toLowerCase()] ||
          factoriesMap['C_' + cCod.trim().toLowerCase()]
        if (!rawVend && facMatch && facMatch.vendedor) {
          rawVend = facMatch.vendedor
        }
        var canonSeller = normalizeSellerName(rawVend) || 'Não atribuído'
        sellerMap[canonSeller] = (sellerMap[canonSeller] || 0) + vBrl

        var rawSeg = facMatch ? facMatch.carteira || facMatch.animalSpecies : ''
        var normSeg = normalizeSegment(rawSeg)
        if (!normSeg) {
          if (famResolved === 'Minerais Orgânicos') normSeg = 'RUMINANTES'
          else if (famResolved === 'Mos/BetaLink') normSeg = 'AVES'
          else if (famResolved === 'Blends') normSeg = 'PETS'
          else if (famResolved === 'Mycolink') normSeg = 'SUINOS'
        }
        if (normSeg && segmentPeriodMap[normSeg] !== undefined) {
          segmentPeriodMap[normSeg] += vBrl
        }

        var nfAnoVal = (r.getInt ? r.getInt('nf_ano') : r.nf_ano) || 0
        var docData = r.getString ? r.getString('data_documento') : r.data_documento || ''
        var docKey =
          nfAnoVal > 0 ? nfAnoVal + '_' + cCod + '_' + docData : docData + '_' + cCod + '_' + i
        notasSet[docKey] = true
      }

      for (var yi = 0; yi < allYearRecords.length; yi++) {
        var yr = allYearRecords[yi]
        var yvBrl = (yr.getInt ? yr.getInt('valor_brl') : yr.valor_brl) || 0
        var ycn = (yr.getString ? yr.getString('cliente_nome') : yr.cliente_nome) || ''
        var ycc = (yr.getString ? yr.getString('cliente_codigo') : yr.cliente_codigo) || ''
        var ypc = yr.getString ? yr.getString('produto_codigo') : yr.produto_codigo || ''
        var yfb = (yr.getString ? yr.getString('familia_produto') : yr.familia_produto) || ''

        var yfac =
          factoriesMap['N_' + ycn.trim().toLowerCase()] ||
          factoriesMap['C_' + ycc.trim().toLowerCase()]
        var ySeg = normalizeSegment(yfac ? yfac.carteira || yfac.animalSpecies : '')
        if (!ySeg) {
          var yFam = resolveFamilia(ypc, yfb)
          if (yFam === 'Minerais Orgânicos') ySeg = 'RUMINANTES'
          else if (yFam === 'Mos/BetaLink') ySeg = 'AVES'
          else if (yFam === 'Blends') ySeg = 'PETS'
          else if (yFam === 'Mycolink') ySeg = 'SUINOS'
        }
        if (ySeg && segmentYearMap[ySeg] !== undefined) {
          segmentYearMap[ySeg] += yvBrl
        }
      }

      var evolucaoMensal = []
      for (var mOffset = 11; mOffset >= 0; mOffset--) {
        var dCur = new Date(targetYear, targetMonth - 1 - mOffset, 1)
        var ey = dCur.getFullYear()
        var em = dCur.getMonth() + 1
        var mKey = ey + '-' + pad(em)
        var mShort = MESES_CAP[em] ? MESES_CAP[em].substring(0, 3) : 'M' + em
        var mLabel = mShort + '/' + String(ey).slice(2)

        var mSum = 0
        try {
          var mRecs = $app.findRecordsByFilter(
            'faturamento',
            'ano = ' + ey + ' && mes = ' + em + ' && is_deleted != true',
            '',
            5000,
            0,
          )
          for (var mi2 = 0; mi2 < mRecs.length; mi2++) {
            mSum += (mRecs[mi2].getInt ? mRecs[mi2].getInt('valor_brl') : mRecs[mi2].valor_brl) || 0
          }
        } catch (_) {}

        evolucaoMensal.push({
          ano: ey,
          mes: em,
          label: mLabel,
          key: mKey,
          valor_brl: Math.round(mSum * 100) / 100,
        })
      }

      var metasPorVendedor = []
      try {
        var allMetasVendedores = $app.findRecordsByFilter(
          'metas',
          'ano = ' + targetYear + ' && mes = ' + targetMonth,
          '',
          500,
          0,
        )

        var sellerMetaAgg = {}
        for (var mvIdx = 0; mvIdx < allMetasVendedores.length; mvIdx++) {
          var mItem = allMetasVendedores[mvIdx]
          var sName =
            normalizeSellerName(
              mItem.getString
                ? mItem.getString('vendedor_nome') || mItem.getString('vendedor')
                : mItem.vendedor_nome || mItem.vendedor,
            ) || 'Não atribuído'
          var sMetaVal =
            (mItem.getInt ? mItem.getInt('valor_meta') : mItem.valor_meta) ||
            (mItem.getInt ? mItem.getInt('meta_valor') : mItem.meta_valor) ||
            0
          sellerMetaAgg[sName] = (sellerMetaAgg[sName] || 0) + sMetaVal
        }

        var allSellersSet = {}
        for (var s1 in sellerMetaAgg) allSellersSet[s1] = true
        for (var s2 in sellerMap) allSellersSet[s2] = true

        for (var sKey in allSellersSet) {
          var sMeta = sellerMetaAgg[sKey] || 0
          var sAchieved = sellerMap[sKey] || 0
          var sPct =
            sMeta > 0 ? Math.round((sAchieved / sMeta) * 10000) / 100 : sAchieved > 0 ? 100 : 0
          var sStatus = 'vermelho'
          if (sPct >= 100) sStatus = 'verde'
          else if (sPct >= 70) sStatus = 'amarelo'

          metasPorVendedor.push({
            vendedor: sKey,
            meta_mensal: Math.round(sMeta * 100) / 100,
            valor_atingido: Math.round(sAchieved * 100) / 100,
            percentual_atingido: sPct,
            status: sStatus,
          })
        }
        metasPorVendedor.sort((a, b) => b.valor_atingido - a.valor_atingido)
      } catch (_) {}

      var prevTotalBrl = 0
      var prevNotasSet = {}
      for (var p = 0; p < prevRecords.length; p++) {
        var prRec = prevRecords[p]
        var prBrl = (prRec.getInt ? prRec.getInt('valor_brl') : prRec.valor_brl) || 0
        prevTotalBrl += prBrl
        var prDoc = prRec.getString ? prRec.getString('data_documento') : prRec.data_documento || ''
        var prCli = prRec.getString ? prRec.getString('cliente_codigo') : prRec.cliente_codigo || ''
        prevNotasSet[prDoc + '_' + prCli + '_' + p] = true
      }

      var variacaoFaturamento = null
      if (prevTotalBrl > 0) {
        variacaoFaturamento = Math.round(((totalBrl - prevTotalBrl) / prevTotalBrl) * 10000) / 100
      } else if (totalBrl > 0) {
        variacaoFaturamento = 100
      }

      var qtdNotas = Object.keys(notasSet).length || currentRecords.length
      var qtdNotasPrev = Object.keys(prevNotasSet).length || prevRecords.length
      var ticketMedio = qtdNotas > 0 ? Math.round((totalBrl / qtdNotas) * 100) / 100 : 0
      var ticketMedioPrev =
        qtdNotasPrev > 0 ? Math.round((prevTotalBrl / qtdNotasPrev) * 100) / 100 : 0
      var variacaoTicketMedio = null
      if (ticketMedioPrev > 0) {
        variacaoTicketMedio =
          Math.round(((ticketMedio - ticketMedioPrev) / ticketMedioPrev) * 10000) / 100
      } else if (ticketMedio > 0) {
        variacaoTicketMedio = 100
      }

      var clientesAtivosCount = Object.keys(activeClientsSet).length

      var porCliente = Object.keys(clienteMap).map((k) => ({
        cliente: k,
        valor_brl: Math.round(clienteMap[k] * 100) / 100,
        share_percentual: totalBrl > 0 ? Math.round((clienteMap[k] / totalBrl) * 10000) / 100 : 0,
      }))
      porCliente.sort((a, b) => b.valor_brl - a.valor_brl)
      var top10Clientes = porCliente.slice(0, 10).map((c, idx) => ({
        rank: idx + 1,
        cliente: c.cliente,
        valor_brl: c.valor_brl,
        share_percentual: c.share_percentual,
      }))

      var porFamilia = Object.keys(familiaMap).map((k) => ({
        familia: k,
        valor_brl: Math.round(familiaMap[k] * 100) / 100,
        share_percentual: totalBrl > 0 ? Math.round((familiaMap[k] / totalBrl) * 10000) / 100 : 0,
      }))
      porFamilia.sort((a, b) => b.valor_brl - a.valor_brl)
      var top10Familias = porFamilia.slice(0, 10).map((f, idx) => ({
        rank: idx + 1,
        familia: f.familia,
        valor_brl: f.valor_brl,
        share_percentual: f.share_percentual,
      }))

      var vendasPorSegmento = [
        {
          segmento: 'AVES',
          valor_ano: Math.round((segmentYearMap.AVES || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.AVES || 0) * 100) / 100,
        },
        {
          segmento: 'PETS',
          valor_ano: Math.round((segmentYearMap.PETS || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.PETS || 0) * 100) / 100,
        },
        {
          segmento: 'RUMINANTES',
          valor_ano: Math.round((segmentYearMap.RUMINANTES || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.RUMINANTES || 0) * 100) / 100,
        },
        {
          segmento: 'SUINOS',
          valor_ano: Math.round((segmentYearMap.SUINOS || 0) * 100) / 100,
          valor_mes: Math.round((segmentPeriodMap.SUINOS || 0) * 100) / 100,
        },
      ]

      var alertasCarteira = []
      var hojeIso = now.toISOString()
      var sessentaDiasAtras = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

      if (coberturaPercent !== null && coberturaPercent < 70) {
        alertasCarteira.push({
          id: 'alerta-cobertura-baixa',
          tipo: 'cobertura_baixa',
          severidade: 'critical',
          mensagem:
            'Cobertura de carteira em ' +
            coberturaPercent.toFixed(1).replace('.', ',') +
            '%, abaixo do limiar operacional de 70%.',
          data: hojeIso,
        })
      }

      var segmentosPrincipais = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS']
      for (var sIdx = 0; sIdx < segmentosPrincipais.length; sIdx++) {
        var segNome = segmentosPrincipais[sIdx]
        if (!segmentPeriodMap[segNome] || segmentPeriodMap[segNome] <= 0) {
          alertasCarteira.push({
            id: 'alerta-segmento-zero-' + segNome.toLowerCase(),
            tipo: 'segmento_zerado',
            severidade: 'warning',
            mensagem:
              'Segmento ' +
              segNome +
              ' com faturamento zerado no mês de ' +
              (MESES_CAP[targetMonth] || targetMonth) +
              '.',
            data: hojeIso,
          })
        }
      }

      try {
        var facActiveList = $app.findRecordsByFilter(
          'factories',
          "tipo = 'Cliente' && status_funil = 'Ativo' && is_deleted != true",
          '-ultimo_pedido',
          50,
          0,
        )
        for (var fa = 0; fa < facActiveList.length; fa++) {
          var faRec = facActiveList[fa]
          var upDateStr = faRec.getString ? faRec.getString('ultimo_pedido') : faRec.ultimo_pedido
          var faName = (faRec.getString ? faRec.getString('name') : faRec.name) || 'Cliente'
          if (upDateStr) {
            var upDate = new Date(upDateStr)
            if (!isNaN(upDate.getTime()) && upDate < sessentaDiasAtras) {
              alertasCarteira.push({
                id: 'alerta-inatividade-' + faRec.id,
                tipo: 'cliente_inativo_60d',
                severidade: 'risk',
                mensagem:
                  'Cliente ' +
                  faName +
                  ' sem novos pedidos há mais de 60 dias (último em ' +
                  upDate.toLocaleDateString('pt-BR') +
                  ').',
                data: hojeIso,
              })
              if (alertasCarteira.length >= 8) break
            }
          }
        }
      } catch (_) {}

      return e.json(200, {
        periodo: periodoLabel,
        faturamento_mes: Math.round(totalBrl * 100) / 100,
        faturamento_ano_ytd: ytdBrl,
        clientes_ativos: clientesAtivosCount,
        ticket_medio: ticketMedio,
        carteira_total_brl: carteiraTotalBrl,
        meta_brl: metaBrl,
        cobertura_percent: coberturaPercent,
        variacao_faturamento_mes: variacaoFaturamento,
        variacao_ticket_medio: variacaoTicketMedio,
        top_clientes: top10Clientes,
        top_familias: top10Familias,
        metas_por_vendedor: metasPorVendedor,
        vendas_por_segmento: vendasPorSegmento,
        evolucao_mensal: evolucaoMensal,
        alertas_carteira: alertasCarteira,
        faturado_total_brl: Math.round(totalBrl * 100) / 100,
        faturado_total_usd: Math.round(totalUsd * 100) / 100,
        meta_atingida_percent: metaBrl > 0 ? Math.round((totalBrl / metaBrl) * 10000) / 100 : null,
        por_cliente: top10Clientes.map((c) => ({ cliente: c.cliente, valor_brl: c.valor_brl })),
        por_familia: top10Familias.map((f) => ({ familia: f.familia, valor_brl: f.valor_brl })),
        quantidade_notas: qtdNotas,
        variacao_semana_anterior: variacaoFaturamento,
      })
    } catch (err) {
      console.error('resumo-vendas: erro ao processar resumo', err)
      $app.logger().error('resumo-vendas: erro ao processar resumo', 'error', String(err))
      return e.json(500, { error: 'Não foi possível processar o resumo de vendas.' })
    }
  },
  $apis.requireAuth(),
)
