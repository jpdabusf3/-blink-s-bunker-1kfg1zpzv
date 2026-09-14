// pocketbase/hooks/maestro_monthly.js
// Automação 2: Relatório mensal automático
// 1º dia de cada mês às 07:00 (America/Sao_Paulo = UTC-3 -> 10:00 UTC)
// Action: resumo de vendas do MÊS ANTERIOR (mode=month)
// Output: .docx "Relatório Mensal Blink Biotech" agregando:
//   - faturado
//   - carteira
//   - top clientes
//   - famílias
//   - espécies
//   - variação MoM
//   - comparativo vs meta (metas)
//   - funil: leads -> propostas -> pedidos -> faturado
// Salvo em documents (nome_original: "relatorio-mensal-YYYY-MM.docx")
// Assinatura: "Diretoria Comercial — Blink Biotech" (sem gestor técnico)
// Log em activity_logs (action='automation')
// Atualiza dashboard_preferences (Automação 4)

cronAdd('maestro_relatorio_mensal', '0 10 1 * *', () => {
  function escXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  function pad(n, len) {
    var s = '' + n
    while (s.length < (len || 2)) s = '0' + s
    return s
  }

  function fmtBRL(val) {
    if (val == null || isNaN(val)) return 'R$ 0,00'
    var num = Number(val)
    var fixed = Math.abs(num).toFixed(2)
    var parts = fixed.split('.')
    var intPart = parts[0]
    var decPart = parts[1]
    var rgx = /(\d+)(\d{3})/
    while (rgx.test(intPart)) {
      intPart = intPart.replace(rgx, '$1.$2')
    }
    var sign = num < 0 ? '-' : ''
    return (sign ? '-' : '') + 'R$ ' + intPart + ',' + decPart
  }

  function fmtUSD(val) {
    if (val == null || isNaN(val)) return '$ 0,00'
    var num = Number(val)
    var fixed = Math.abs(num).toFixed(2)
    var parts = fixed.split('.')
    var intPart = parts[0]
    var decPart = parts[1]
    var rgx = /(\d+)(\d{3})/
    while (rgx.test(intPart)) {
      intPart = intPart.replace(rgx, '$1.$2')
    }
    var sign = num < 0 ? '-' : ''
    return sign + '$ ' + intPart + ',' + decPart
  }

  function logActivityEntry(actionText, detailsText, docId) {
    try {
      var logCol = $app.findCollectionByNameOrId('activity_logs')
      var userRecord = null
      try {
        userRecord = $app.findFirstRecordByFilter(
          'users',
          "email = 'joaopedro_zoo@hotmail.com' || job_title = 'CEO' || job_title = 'Diretor'",
        )
      } catch (_) {
        try {
          var anyUsers = $app.findRecordsByFilter('users', '1=1', '', 1, 0)
          if (anyUsers && anyUsers.length > 0) userRecord = anyUsers[0]
        } catch (_) {}
      }
      if (!userRecord) return

      var record = new Record(logCol)
      record.set('user', userRecord.id)
      record.set('action', actionText)
      record.set('details', detailsText)
      record.set('origem', 'painel')
      record.set('tipo', 'outro')
      record.set('target_collection', 'documents')
      if (docId) record.set('recordId', docId)
      $app.save(record)
    } catch (err) {
      $app.logger().warn('maestro_monthly: logActivityEntry failed', 'error', String(err))
    }
  }

  function updateDashboardPreferences(periodLabel) {
    try {
      var nowIso = new Date().toISOString()
      var prefRows = $app.findRecordsByFilter('dashboard_preferences', '1=1', '', 500, 0)
      for (var i = 0; i < prefRows.length; i++) {
        var pref = prefRows[i]
        pref.set('last_automation_update', nowIso)
        pref.set('last_automation_period', periodLabel)
        $app.save(pref)
      }
      if (prefRows.length === 0) {
        var users = $app.findRecordsByFilter('users', '1=1', '', 1, 0)
        if (users && users.length > 0) {
          var prefCol = $app.findCollectionByNameOrId('dashboard_preferences')
          var newPref = new Record(prefCol)
          newPref.set('userId', users[0].id)
          newPref.set('blocks', [
            'metrics',
            'executive',
            'consolidated',
            'targets',
            'role-widgets',
            'maps',
            'distribution',
            'charts',
            'historical',
            'list',
            'gestor-comparison',
          ])
          newPref.set('period_view', 'mensal')
          newPref.set('last_automation_update', nowIso)
          newPref.set('last_automation_period', periodLabel)
          $app.save(newPref)
        }
      }
    } catch (err) {
      $app.logger().warn('maestro_monthly: updateDashboardPreferences failed', 'error', String(err))
    }
  }

  var maxRetries = 2
  var attempt = 0
  var lastError = null

  var now = new Date()
  var curMonth = now.getUTCMonth() + 1
  var curYear = now.getUTCFullYear()
  var targetMonth = curMonth - 1
  var targetYear = curYear
  if (targetMonth < 1) {
    targetMonth = 12
    targetYear = curYear - 1
  }

  var periodoLabel = targetYear + '-' + pad(targetMonth, 2)
  var fileName = 'relatorio-mensal-' + periodoLabel + '.docx'
  var title = 'Relatório Mensal Blink Biotech — ' + periodoLabel
  var emissaoDataStr =
    pad(now.getDate(), 2) + '/' + pad(now.getMonth() + 1, 2) + '/' + now.getFullYear()

  function sleep(ms) {
    if (!ms || ms <= 0) return
    var start = new Date().getTime()
    while (new Date().getTime() - start < ms) {
      // wait
    }
  }

  while (attempt <= maxRetries) {
    try {
      attempt++
      $app.logger().info('maestro_monthly: attempt ' + attempt, 'periodo', periodoLabel)

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

      var FAMILIA_ESPECIE_HEURISTIC = {
        'MI.OR': 'Bovinos / Ruminantes',
        'MY.CO': 'Aves e Suínos',
        'MY.ST': 'Aves e Suínos',
        'MINERAIS ORGANICOS': 'Bovinos / Ruminantes',
        ADSORVENTES: 'Multi espécie',
        BLENDS: 'Multi espécie',
      }

      var currentRecords = $app.findRecordsByFilter(
        'faturamento',
        'ano = ' + targetYear + ' && mes = ' + targetMonth,
        '-valor_brl',
        5000,
        0,
      )

      var prevMonth = targetMonth - 1
      var prevYearForMonth = targetYear
      if (prevMonth < 1) {
        prevMonth = 12
        prevYearForMonth = targetYear - 1
      }
      var prevRecords = $app.findRecordsByFilter(
        'faturamento',
        'ano = ' + prevYearForMonth + ' && mes = ' + prevMonth,
        '',
        5000,
        0,
      )

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

        var docKey =
          (r.getString ? r.getString('data_documento') : r.data_documento || '') + '_' + cCod
        notasSet[docKey] = true
      }

      var prevTotalBrl = 0
      for (var p = 0; p < prevRecords.length; p++) {
        var prRec = prevRecords[p]
        prevTotalBrl += (prRec.getInt ? prRec.getInt('valor_brl') : prRec.valor_brl) || 0
      }

      var variacaoMoM = 0
      if (prevTotalBrl > 0) {
        variacaoMoM = Math.round(((totalBrl - prevTotalBrl) / prevTotalBrl) * 10000) / 100
      } else if (totalBrl > 0) {
        variacaoMoM = 100
      }

      var porCliente = Object.keys(clienteMap).map((k) => ({
        cliente: k,
        valor_brl: Math.round(clienteMap[k] * 100) / 100,
      }))
      porCliente.sort((a, b) => b.valor_brl - a.valor_brl)
      var top10Clientes = porCliente.slice(0, 10)

      var porFamilia = Object.keys(familiaMap).map((k) => ({
        familia: k,
        valor_brl: Math.round(familiaMap[k] * 100) / 100,
      }))
      porFamilia.sort((a, b) => b.valor_brl - a.valor_brl)

      var porEspecie = Object.keys(especieMap).map((k) => ({
        especie: k,
        valor_brl: Math.round(especieMap[k] * 100) / 100,
      }))
      porEspecie.sort((a, b) => b.valor_brl - a.valor_brl)

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
      var mesNome = MESES_NOMES[targetMonth]
      var carteiraTotalBrl = 0
      try {
        if (mesNome) {
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
              sumCart += (pRow.getInt ? pRow.getInt('valor') : pRow.valor) || 0
            }
            carteiraTotalBrl = Math.round(sumCart * 100) / 100
          }
        }
      } catch (_) {}

      if (carteiraTotalBrl === 0) {
        try {
          var ordersRows = $app.findRecordsByFilter('orders', '1=1', '', 500, 0)
          if (ordersRows && ordersRows.length > 0) {
            var sumOrd = 0
            for (var oi = 0; oi < ordersRows.length; oi++) {
              var oRow = ordersRows[oi]
              sumOrd += (oRow.getInt ? oRow.getInt('totalValue') : oRow.totalValue) || 0
            }
            carteiraTotalBrl = Math.round(sumOrd * 100) / 100
          }
        } catch (_) {}
      }

      var metaMesTotal = 0
      try {
        var metaRows = $app.findRecordsByFilter('metas', '1=1', '', 500, 0)
        for (var mi = 0; mi < metaRows.length; mi++) {
          metaMesTotal +=
            (metaRows[mi].getInt ? metaRows[mi].getInt('meta_valor') : metaRows[mi].meta_valor) || 0
        }
      } catch (_) {}

      var atingimentoMeta =
        metaMesTotal > 0 ? Math.round((totalBrl / metaMesTotal) * 10000) / 100 : 0

      var funilStagesMap = {
        Leads: { nome: 'Leads', quantidade: 0, valor_brl: 0 },
        Propostas: { nome: 'Propostas', quantidade: 0, valor_brl: 0 },
        Pedidos: { nome: 'Pedidos', quantidade: 0, valor_brl: 0 },
        Faturado: { nome: 'Faturado', quantidade: currentRecords.length, valor_brl: totalBrl },
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
            funilStagesMap['Leads'].quantidade++
            funilStagesMap['Leads'].valor_brl += effectiveVal
          } else if (stage === 'Proposta' || stage === 'Negociação') {
            funilStagesMap['Propostas'].quantidade++
            funilStagesMap['Propostas'].valor_brl += effectiveVal
          }
        }
      } catch (_) {}

      funilStagesMap['Pedidos'].valor_brl = carteiraTotalBrl
      funilStagesMap['Pedidos'].quantidade = carteiraTotalBrl > 0 ? 1 : 0

      function heading1(t) {
        return (
          '<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="240" w:after="120"/>' +
          '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr>' +
          '</w:pPr><w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>' +
          '<w:t>' +
          escXml(t) +
          '</w:t></w:r></w:p>\n'
        )
      }

      function tableRow(c1, c2, isHeader, isEven) {
        var bg = isHeader ? '1F497D' : isEven ? 'F2F2F2' : 'FFFFFF'
        var color = isHeader ? 'FFFFFF' : '000000'
        var bTag = isHeader ? '<w:b/>' : ''
        return (
          '<w:tr>' +
          '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="' +
          bg +
          '"/><w:tcW w:w="5500" w:type="dxa"/></w:tcPr>' +
          '<w:p><w:r><w:rPr>' +
          bTag +
          '<w:color w:val="' +
          color +
          '"/></w:rPr><w:t>' +
          escXml(c1) +
          '</w:t></w:r></w:p></w:tc>' +
          '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="' +
          bg +
          '"/><w:tcW w:w="3700" w:type="dxa"/></w:tcPr>' +
          '<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr>' +
          bTag +
          '<w:color w:val="' +
          color +
          '"/></w:rPr><w:t>' +
          escXml(c2) +
          '</w:t></w:r></w:p></w:tc>' +
          '</w:tr>\n'
        )
      }

      var topClientesRows = ''
      for (var tcIdx = 0; tcIdx < top10Clientes.length; tcIdx++) {
        var cli = top10Clientes[tcIdx]
        topClientesRows += tableRow(
          tcIdx + 1 + '. ' + cli.cliente,
          fmtBRL(cli.valor_brl),
          false,
          tcIdx % 2 === 1,
        )
      }
      if (!topClientesRows) {
        topClientesRows = tableRow(
          'Nenhum faturamento registrado no período',
          fmtBRL(0),
          false,
          false,
        )
      }

      var topFamiliasRows = ''
      for (var tfIdx = 0; tfIdx < porFamilia.length; tfIdx++) {
        var famObj = porFamilia[tfIdx]
        topFamiliasRows += tableRow(
          famObj.familia,
          fmtBRL(famObj.valor_brl),
          false,
          tfIdx % 2 === 1,
        )
      }
      if (!topFamiliasRows) {
        topFamiliasRows = tableRow('Nenhuma família faturada', fmtBRL(0), false, false)
      }

      var topEspeciesRows = ''
      for (var teIdx = 0; teIdx < porEspecie.length; teIdx++) {
        var espObj = porEspecie[teIdx]
        topEspeciesRows += tableRow(
          espObj.especie,
          fmtBRL(espObj.valor_brl),
          false,
          teIdx % 2 === 1,
        )
      }
      if (!topEspeciesRows) {
        topEspeciesRows = tableRow('Nenhuma espécie faturada', fmtBRL(0), false, false)
      }

      var funilRows =
        tableRow(
          '1. Leads (Oportunidades em Mapeamento) — Qtd: ' + funilStagesMap['Leads'].quantidade,
          fmtBRL(funilStagesMap['Leads'].valor_brl),
          false,
          false,
        ) +
        tableRow(
          '2. Propostas Comerciais Ativas — Qtd: ' + funilStagesMap['Propostas'].quantidade,
          fmtBRL(funilStagesMap['Propostas'].valor_brl),
          false,
          true,
        ) +
        tableRow(
          '3. Pedidos em Carteira — Qtd: ' + funilStagesMap['Pedidos'].quantidade,
          fmtBRL(funilStagesMap['Pedidos'].valor_brl),
          false,
          false,
        ) +
        tableRow(
          '4. Faturado do Mês — Qtd: ' + funilStagesMap['Faturado'].quantidade,
          fmtBRL(funilStagesMap['Faturado'].valor_brl),
          false,
          true,
        )

      var fullDocxXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<?mso-application progid="Word.Document"?>\n' +
        '<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml" ' +
        'xmlns:v="urn:schemas-microsoft-com:vml" ' +
        'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
        'xmlns:sl="http://schemas.microsoft.com/schemaLibrary/2003/core" ' +
        'xmlns:aml="http://schemas.microsoft.com/aml/2001/core" ' +
        'xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint" ' +
        'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:dt="uuid:C2F41010-65B3-11d1-A29F-00AA00C14882" ' +
        'w:macrosPresent="no" w:embeddedObjPresent="no" w:ocxPresent="no" xml:space="preserve">\n' +
        '<w:styles>' +
        '<w:style w:type="paragraph" w:default="on" w:styleId="Normal">' +
        '<w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:sz w:val="22"/><w:lang w:val="PT-BR"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1">' +
        '<w:name w:val="heading 1"/><w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:b/><w:color w:val="1F497D"/><w:sz w:val="26"/><w:lang w:val="PT-BR"/></w:rPr>' +
        '</w:style>' +
        '<w:style w:type="paragraph" w:styleId="Footer">' +
        '<w:name w:val="footer"/><w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:sz w:val="18"/><w:color w:val="666666"/><w:lang w:val="PT-BR"/></w:rPr>' +
        '</w:style>' +
        '</w:styles>\n' +
        '<w:body>\n' +
        '<w:p><w:pPr><w:spacing w:before="400" w:after="120"/><w:jc w:val="center"/></w:pPr>' +
        '<w:r><w:rPr><w:b/><w:color w:val="C00000"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t>Blink Biotech</w:t></w:r></w:p>\n' +
        '<w:p><w:pPr><w:spacing w:before="60" w:after="160"/><w:jc w:val="center"/></w:pPr>' +
        '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>Relatório Mensal Blink Biotech</w:t></w:r></w:p>\n' +
        '<w:p><w:pPr><w:spacing w:before="40" w:after="300"/><w:jc w:val="center"/></w:pPr>' +
        '<w:r><w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="22"/></w:rPr><w:t>Mês de Referência: ' +
        escXml(periodoLabel) +
        ' • Emitido em: ' +
        escXml(emissaoDataStr) +
        '</w:t></w:r></w:p>\n' +
        heading1('1. Desempenho Financeiro e Metas') +
        '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
        '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '</w:tblBorders></w:tblPr>\n' +
        tableRow('Indicador', 'Valor / Realizado', true, false) +
        tableRow('Faturamento Mensal (BRL)', fmtBRL(totalBrl), false, false) +
        tableRow('Faturamento Mensal (USD)', fmtUSD(totalUsd), false, true) +
        tableRow('Pedidos em Carteira', fmtBRL(carteiraTotalBrl), false, false) +
        tableRow(
          'Variação MoM (Mês vs. Mês Anterior)',
          (variacaoMoM >= 0 ? '+' : '') + variacaoMoM.toFixed(2).replace('.', ',') + '%',
          false,
          true,
        ) +
        tableRow('Meta Orçada (Collection Metas)', fmtBRL(metaMesTotal), false, false) +
        tableRow(
          'Atingimento da Meta',
          atingimentoMeta.toFixed(2).replace('.', ',') + '%',
          false,
          true,
        ) +
        '</w:tbl>\n' +
        heading1('2. Top 10 Clientes do Mês') +
        '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
        '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '</w:tblBorders></w:tblPr>\n' +
        tableRow('Cliente', 'Faturado (BRL)', true, false) +
        topClientesRows +
        '</w:tbl>\n' +
        heading1('3. Distribuição por Família de Produtos') +
        '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
        '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '</w:tblBorders></w:tblPr>\n' +
        tableRow('Família de Produto', 'Faturado (BRL)', true, false) +
        topFamiliasRows +
        '</w:tbl>\n' +
        heading1('4. Distribuição por Espécie Destino') +
        '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
        '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '</w:tblBorders></w:tblPr>\n' +
        tableRow('Espécie', 'Faturado (BRL)', true, false) +
        topEspeciesRows +
        '</w:tbl>\n' +
        heading1('5. Pipeline Comercial e Funil de Vendas') +
        '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
        '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
        '</w:tblBorders></w:tblPr>\n' +
        tableRow('Estágio do Funil (Pipeline)', 'Volume Total (BRL)', true, false) +
        funilRows +
        '</w:tbl>\n' +
        '<w:p><w:pPr><w:spacing w:before="600" w:after="80"/><w:jc w:val="center"/></w:pPr>' +
        '<w:r><w:rPr><w:b/></w:rPr><w:t>____________________________________________________</w:t></w:r></w:p>\n' +
        '<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>' +
        '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>Diretoria Comercial — Blink Biotech</w:t></w:r></w:p>\n' +
        '<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>' +
        '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="595959"/></w:rPr><w:t>Automação MAESTRO • ' +
        escXml(emissaoDataStr) +
        '</w:t></w:r></w:p>\n' +
        '<w:sectPr>\n' +
        '<w:pgSz w:w="11906" w:h="16838"/>\n' +
        '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708"/>\n' +
        '<w:ftr w:type="default">\n' +
        '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs><w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="D9D9D9"/></w:pBdr></w:pPr>' +
        '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Diretoria Comercial — Blink Biotech</w:t></w:r>' +
        '<w:r><w:tab/></w:r>' +
        '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Página </w:t></w:r>' +
        '<w:fldSimple w:instr="PAGE"/>' +
        '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t> de </w:t></w:r>' +
        '<w:fldSimple w:instr="NUMPAGES"/>' +
        '</w:p>\n' +
        '</w:ftr>\n' +
        '</w:sectPr>\n' +
        '</w:body></w:wordDocument>'

      var docCol = $app.findCollectionByNameOrId('documents')
      var fileObj = $filesystem.fileFromBytes(fullDocxXml, fileName)

      var existingDoc = null
      try {
        existingDoc = $app.findFirstRecordByFilter(
          'documents',
          'title = {:title} || nome_original = {:fname}',
          { title: title, fname: fileName },
        )
      } catch (_) {}

      var docRecord = existingDoc || new Record(docCol)
      docRecord.set('title', title)
      docRecord.set('file', fileObj)
      docRecord.set('category', 'Relatórios Automáticos')
      docRecord.set('min_access_level', 'Diretor')
      if (docCol.fields.getByName('nome_original')) {
        docRecord.set('nome_original', fileName)
      }
      $app.save(docRecord)

      updateDashboardPreferences(periodoLabel)

      logActivityEntry(
        'automation',
        'Execução MAESTRO: Relatório Mensal gerado com sucesso para ' +
          periodoLabel +
          ' (Arquivo: ' +
          fileName +
          ')',
        docRecord.id,
      )

      return
    } catch (err) {
      lastError = err
      $app.logger().error('maestro_monthly: attempt ' + attempt + ' failed', 'error', String(err))
      if (attempt <= maxRetries) {
        $app.logger().info('maestro_monthly: aguardando retry em 5 minutos...', 'attempt', attempt)
        // 5 minutos de atraso (300.000 ms)
        sleep(5 * 60 * 1000)
      }
    }
  }

  logActivityEntry(
    'automation',
    'Falha na automação mensal MAESTRO para o período ' + periodoLabel + ': ' + String(lastError),
    '',
  )
})
