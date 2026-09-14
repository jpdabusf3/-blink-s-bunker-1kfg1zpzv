routerAdd(
  'GET',
  '/backend/v1/resumo_vendas',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

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

      var now = new Date()
      var curYear = now.getUTCFullYear()
      var curMonth = now.getUTCMonth() + 1
      var curWeek = getIsoWeek(now)

      var mode = (e.request.url.query().get('mode') || 'month').toLowerCase()
      var qAno = e.request.url.query().get('ano')
      var qMes = e.request.url.query().get('mes')
      var qSemana = e.request.url.query().get('semana')

      var targetYear = qAno ? parseInt(qAno, 10) : curYear
      var targetMonth = qMes ? parseInt(qMes, 10) : curMonth
      var targetWeek = qSemana ? parseInt(qSemana, 10) : curWeek

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

      // Carteira de pedidos (pedidos_carteira) para o mês alvo
      var carteiraTotalBrl = null
      try {
        var mesNome = MESES_NOMES[targetMonth]
        if (mesNome) {
          // Os selects da collection pedidos_carteira são agosto, setembro, outubro, novembro, dezembro
          var pedidosCarteiraRows = $app.findRecordsByFilter(
            'pedidos_carteira',
            "mes = '" + mesNome + "'",
            '',
            500,
            0,
          )
          if (pedidosCarteiraRows && pedidosCarteiraRows.length > 0) {
            var sumCart = 0
            for (var cIdx = 0; cIdx < pedidosCarteiraRows.length; cIdx++) {
              var pRow = pedidosCarteiraRows[cIdx]
              sumCart += pRow.getInt ? pRow.getInt('valor') : pRow.valor || 0
            }
            carteiraTotalBrl = Math.round(sumCart * 100) / 100
          }
        }
      } catch (errCart) {
        $app.logger().warn('Erro ao consultar pedidos_carteira', 'error', String(errCart))
        carteiraTotalBrl = null
      }

      var periodoLabel = ''
      var currentRecords = []
      var prevRecords = []

      // Carregar produtos para mapeamento confiável de família/código -> espécie
      var produtosMap = {}
      try {
        var prodRecords = $app.findRecordsByFilter('produtos', 'ativo = true', '', 1000, 0)
        for (var pr = 0; pr < prodRecords.length; pr++) {
          var pRec = prodRecords[pr]
          var pCod = (pRec.getString ? pRec.getString('codigo') : pRec.codigo || '')
            .trim()
            .toUpperCase()
          var pFam = (pRec.getString ? pRec.getString('familia') : pRec.familia || '')
            .trim()
            .toUpperCase()
          var pEsp =
            (pRec.getString ? pRec.getString('especie_padrao') : pRec.especie_padrao) ||
            (pRec.getString ? pRec.getString('especie_destino') : pRec.especie_destino) ||
            ''
          if (pCod && pEsp) produtosMap['COD_' + pCod] = pEsp
          if (pFam && pEsp && !produtosMap['FAM_' + pFam]) produtosMap['FAM_' + pFam] = pEsp
        }
      } catch (_) {}

      // Mapeamento prévio conhecido da Blink (MI.OR -> Minerais Orgânicos, MY.CO -> Micotoxinas, etc.)
      var FAMILIA_ESPECIE_HEURISTIC = {
        'MI.OR': 'Bovinos / Ruminantes',
        'MY.CO': 'Aves e Suínos',
        'MY.ST': 'Aves e Suínos',
        'MINERAIS ORGANICOS': 'Bovinos / Ruminantes',
        ADSORVENTES: 'Multi espécie',
        BLENDS: 'Multi espécie',
      }

      if (mode === 'week') {
        periodoLabel = targetYear + '-W' + pad(targetWeek)

        // Registros do faturamento para a semana
        currentRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && semana_iso = ' + targetWeek,
          '-valor_brl',
          5000,
          0,
        )

        // Período anterior: semana anterior
        var prevWeek = targetWeek - 1
        var prevYearForWeek = targetYear
        if (prevWeek < 1) {
          prevWeek = 52
          prevYearForWeek = targetYear - 1
        }
        prevRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + prevYearForWeek + ' && semana_iso = ' + prevWeek,
          '',
          5000,
          0,
        )
      } else {
        // mode === 'month'
        periodoLabel = targetYear + '-' + pad(targetMonth)

        currentRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + targetYear + ' && mes = ' + targetMonth,
          '-valor_brl',
          5000,
          0,
        )

        // Período anterior: mês anterior
        var prevMonth = targetMonth - 1
        var prevYearForMonth = targetYear
        if (prevMonth < 1) {
          prevMonth = 12
          prevYearForMonth = targetYear - 1
        }
        prevRecords = $app.findRecordsByFilter(
          'faturamento',
          'ano = ' + prevYearForMonth + ' && mes = ' + prevMonth,
          '',
          5000,
          0,
        )
      }

      var totalBrl = 0
      var totalUsd = 0
      var clienteMap = {}
      var familiaMap = {}
      var especieMap = {}
      var notasSet = {}

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

        var fam = (r.getString ? r.getString('familia_produto') : r.familia_produto) || 'Outros'
        if (!fam.trim()) fam = 'Outros'
        familiaMap[fam] = (familiaMap[fam] || 0) + vBrl

        // Mapeamento espécie
        var prodCod = (r.getString ? r.getString('produto_codigo') : r.produto_codigo || '')
          .trim()
          .toUpperCase()
        var famNorm = fam.toUpperCase().trim()
        var matchedEsp =
          produtosMap['COD_' + prodCod] ||
          produtosMap['FAM_' + famNorm] ||
          FAMILIA_ESPECIE_HEURISTIC[famNorm] ||
          ''
        if (matchedEsp) {
          especieMap[matchedEsp] = (especieMap[matchedEsp] || 0) + vBrl
        }

        // Chave de agrupamento de documento / nota para contagem:
        // Use nf_ano + cliente_codigo + data_documento quando nf_ano > 0, fallback para data + cliente
        var nfAnoVal = (r.getInt ? r.getInt('nf_ano') : r.nf_ano) || 0
        var docData = r.getString ? r.getString('data_documento') : r.data_documento || ''
        var docKey = ''
        if (nfAnoVal > 0) {
          docKey = nfAnoVal + '_' + cCod + '_' + docData
        } else {
          docKey = docData + '_' + cCod
        }
        notasSet[docKey] = true
      }

      // Período anterior total para calcular variação percentual
      var prevTotalBrl = 0
      for (var p = 0; p < prevRecords.length; p++) {
        var prRec = prevRecords[p]
        prevTotalBrl += (prRec.getInt ? prRec.getInt('valor_brl') : prRec.valor_brl) || 0
      }

      var variacaoPercentual = 0
      if (prevTotalBrl > 0) {
        variacaoPercentual = Math.round(((totalBrl - prevTotalBrl) / prevTotalBrl) * 10000) / 100
      } else if (totalBrl > 0) {
        variacaoPercentual = 100
      }

      // Top 10 Clientes ordenados desc
      var porCliente = Object.keys(clienteMap).map((k) => ({
        cliente: k,
        valor_brl: Math.round(clienteMap[k] * 100) / 100,
      }))
      porCliente.sort((a, b) => b.valor_brl - a.valor_brl)
      if (porCliente.length > 10) {
        porCliente = porCliente.slice(0, 10)
      }

      // Por Família
      var porFamilia = Object.keys(familiaMap).map((k) => ({
        familia: k,
        valor_brl: Math.round(familiaMap[k] * 100) / 100,
      }))
      porFamilia.sort((a, b) => b.valor_brl - a.valor_brl)

      // Por Espécie
      var porEspecie = Object.keys(especieMap).map((k) => ({
        especie: k,
        valor_brl: Math.round(especieMap[k] * 100) / 100,
      }))
      porEspecie.sort((a, b) => b.valor_brl - a.valor_brl)

      var qtdNotas = Object.keys(notasSet).length || currentRecords.length

      // 1. Meta do período: query da collection metas
      var metaBrl = 0
      var metaAtingidaPercent = null
      try {
        var mesExtenso = MESES_NOMES[targetMonth] || ''
        var mesCapitalized = mesExtenso
          ? mesExtenso.charAt(0).toUpperCase() + mesExtenso.slice(1)
          : ''
        var mesExtensoAno = mesCapitalized ? mesCapitalized + ' ' + targetYear : ''
        var yyyyMm = targetYear + '-' + pad(targetMonth)
        var yyyyMmDd = yyyyMm + '-01'
        var yyyyMm00 = yyyyMm + '-00'

        var metasRows = []
        if (mode === 'week') {
          metasRows = $app.findRecordsByFilter(
            'metas',
            'periodo = {:pLabel} || periodo ~ {:pWeek}',
            '',
            500,
            0,
            { pLabel: periodoLabel, pWeek: 'W' + pad(targetWeek) },
          )
        } else {
          metasRows = $app.findRecordsByFilter(
            'metas',
            'periodo = {:pLabel} || periodo = {:pExt} || periodo = {:pYm} || periodo = {:pYmd} || periodo = {:pYm00}',
            '',
            500,
            0,
            {
              pLabel: periodoLabel,
              pExt: mesExtensoAno,
              pYm: yyyyMm,
              pYmd: yyyyMmDd,
              pYm00: yyyyMm00,
            },
          )
        }

        if (metasRows && metasRows.length > 0) {
          var sumMeta = 0
          for (var mIdx = 0; mIdx < metasRows.length; mIdx++) {
            var mRow = metasRows[mIdx]
            var mVal = (mRow.getInt ? mRow.getInt('meta_valor') : mRow.meta_valor) || 0
            sumMeta += mVal
          }
          metaBrl = Math.round(sumMeta * 100) / 100
        }
      } catch (errMeta) {
        $app.logger().warn('Erro ao consultar metas', 'error', String(errMeta))
        metaBrl = 0
      }

      if (metaBrl > 0) {
        metaAtingidaPercent = Math.round((totalBrl / metaBrl) * 10000) / 100
      }

      // 2. Cobertura: faturado_total_brl / carteira_total_brl * 100 ou null
      var coberturaPercent = null
      if (carteiraTotalBrl !== null && carteiraTotalBrl !== undefined && carteiraTotalBrl > 0) {
        coberturaPercent = Math.round((totalBrl / carteiraTotalBrl) * 10000) / 100
      }

      var faturadoTotalBrl = Math.round(totalBrl * 100) / 100
      var faturadoTotalUsd = Math.round(totalUsd * 100) / 100

      return e.json(200, {
        periodo: periodoLabel,
        faturado_total_brl: faturadoTotalBrl,
        faturado_total_usd: faturadoTotalUsd,
        carteira_total_brl: carteiraTotalBrl,
        cobertura_percent: coberturaPercent,
        meta_brl: metaBrl,
        meta_atingida_percent: metaAtingidaPercent,
        por_cliente: porCliente,
        por_familia: porFamilia,
        por_especie: porEspecie,
        quantidade_notas: qtdNotas,
        variacao_semana_anterior: variacaoPercentual,
      })
    } catch (err) {
      $app.logger().error('resumo_vendas: error', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
