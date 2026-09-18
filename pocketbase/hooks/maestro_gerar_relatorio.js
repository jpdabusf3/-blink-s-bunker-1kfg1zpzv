// pocketbase/hooks/maestro_gerar_relatorio.js
// Gera relatório de vendas MAESTRO consolidado a partir do JSON de configuração retornado pelo chat do Maestro.
// Consulta faturamento, metas e pedidos_carteira. Gera PDF binário com cabeçalho Blink Biotech e seções solicitadas.
// Salva em documents (category: 'Relatórios Automáticos', min_access_level: 'Comum', nome_original: 'relatorio-mensal-...')
// e em client_reports (generated_by: usuário autenticado).
// Retorna KPIs, nome do arquivo e IDs gerados.

routerAdd(
  'POST',
  '/backend/v1/maestro/gerar-relatorio',
  (e) => {
    function pad(n, len) {
      var s = '' + n
      while (s.length < (len || 2)) s = '0' + s
      return s
    }

    // Resolução de Família de Produtos baseada no código do produto e família bruta
    var PREFIXO_FAMILIA_LOCAL = [
      { prefixo: '1100', familia: 'Adsorventes de Micotoxinas' },
      { prefixo: '1200', familia: 'Adsorventes de Micotoxinas' },
      { prefixo: '1300', familia: 'Adsorventes de Micotoxinas' },
      { prefixo: '1400', familia: 'Adsorventes de Micotoxinas' },
      { prefixo: '2100', familia: 'Antioxidantes' },
      { prefixo: '2200', familia: 'Antioxidantes' },
      { prefixo: '3100', familia: 'Moduladores de Microbiota' },
      { prefixo: '3200', familia: 'Moduladores de Microbiota' },
      { prefixo: '3300', familia: 'Moduladores de Microbiota' },
      { prefixo: '4100', familia: 'Nutracêuticos' },
      { prefixo: '4200', familia: 'Nutracêuticos' },
      { prefixo: '4300', familia: 'Nutracêuticos' },
      { prefixo: '4400', familia: 'Nutracêuticos' },
      { prefixo: '4500', familia: 'Nutracêuticos' },
      { prefixo: '5100', familia: 'Minerais Orgânicos' },
      { prefixo: '5200', familia: 'Minerais Orgânicos' },
      { prefixo: '5300', familia: 'Minerais Orgânicos' },
      { prefixo: '6100', familia: 'Saúde Hepática' },
      { prefixo: '6200', familia: 'Saúde Hepática' },
      { prefixo: '7100', familia: 'Pigmentantes Naturais' },
      { prefixo: '8100', familia: 'Palatabilizantes' },
      { prefixo: '8200', familia: 'Palatabilizantes' },
      { prefixo: '9100', familia: 'Blend e Customizados' },
      { prefixo: '9200', familia: 'Blend e Customizados' },
    ]

    function resolverFamiliaLocal(produtoCodigo, familiaBruta) {
      var prodStr = String(produtoCodigo || '').trim()
      for (var p = 0; p < PREFIXO_FAMILIA_LOCAL.length; p++) {
        var item = PREFIXO_FAMILIA_LOCAL[p]
        if (prodStr.indexOf(item.prefixo) === 0) {
          return item.familia
        }
      }
      var fb = String(familiaBruta || '').trim()
      if (!fb || fb === '\u2014' || fb === '-' || fb === '?') {
        return 'Não identificado'
      }
      return fb
    }

    function sanitizeForPdf(s) {
      if (s == null) return ''
      return String(s)
        .replace(/[\u2014\u2013]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2022/g, '.')
        .replace(/\u00B7/g, '.')
        .replace(/\u2026/g, '...')
    }

    function escPdf(s) {
      var sanitized = sanitizeForPdf(s)
      return sanitized
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
    }
    function fmtDateOnly(iso) {
      if (!iso) return '-'
      try {
        var d = new Date(iso)
        if (isNaN(d.getTime())) return String(iso)
        return pad(d.getDate(), 2) + '/' + pad(d.getMonth() + 1, 2) + '/' + d.getFullYear()
      } catch (_) {
        return String(iso)
      }
    }

    function fmtDateTime(iso) {
      if (!iso) return '-'
      try {
        var d = new Date(iso)
        if (isNaN(d.getTime())) return String(iso)
        return (
          pad(d.getDate(), 2) +
          '/' +
          pad(d.getMonth() + 1, 2) +
          '/' +
          d.getFullYear() +
          ' ' +
          pad(d.getHours(), 2) +
          ':' +
          pad(d.getMinutes(), 2)
        )
      } catch (_) {
        return String(iso)
      }
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
      return sign + 'R$ ' + intPart + ',' + decPart
    }

    function fmtUSD(val) {
      if (val == null || isNaN(val)) return 'US$ 0,00'
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
      return sign + 'US$ ' + intPart + ',' + decPart
    }

    function stringToBytes(s) {
      var bytes = []
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i)
        if (c < 0x80) {
          bytes.push(c)
        } else if (c < 0x800) {
          bytes.push(0xc0 | (c >> 6))
          bytes.push(0x80 | (c & 0x3f))
        } else if (c < 0xd800 || c >= 0xe000) {
          bytes.push(0xe0 | (c >> 12))
          bytes.push(0x80 | ((c >> 6) & 0x3f))
          bytes.push(0x80 | (c & 0x3f))
        } else {
          i++
          var c2 = s.charCodeAt(i)
          var cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff))
          bytes.push(0xf0 | (cp >> 18))
          bytes.push(0x80 | ((cp >> 12) & 0x3f))
          bytes.push(0x80 | ((cp >> 6) & 0x3f))
          bytes.push(0x80 | (cp & 0x3f))
        }
      }
      return bytes
    }

    function latin1Bytes(s) {
      var out = []
      var cleaned = sanitizeForPdf(s)
      for (var i = 0; i < cleaned.length; i++) {
        var c = cleaned.charCodeAt(i)
        if (c > 255) out.push(63)
        else out.push(c)
      }
      return out
    }

    function appendBytes(buf, arr) {
      for (var i = 0; i < arr.length; i++) buf.push(arr[i])
      return buf
    }

    function appendStr(buf, s) {
      for (var i = 0; i < s.length; i++) buf.push(s.charCodeAt(i) & 0xff)
      return buf
    }

    function wrapText(text, maxChars) {
      text = String(text == null ? '' : text)
      var out = []
      var paragraphs = text.split('\n')
      for (var p = 0; p < paragraphs.length; p++) {
        var words = paragraphs[p].split(' ')
        var cur = ''
        for (var w = 0; w < words.length; w++) {
          if ((cur + ' ' + words[w]).trim().length > maxChars) {
            if (cur) out.push(cur)
            cur = words[w]
          } else {
            cur = (cur + ' ' + words[w]).trim()
          }
        }
        if (cur) out.push(cur)
        if (paragraphs.length > 1 && p < paragraphs.length - 1) out.push('')
      }
      return out.length ? out : ['']
    }

    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    var userRecord = null
    try {
      userRecord = $app.findRecordById('users', userId)
    } catch (_) {}

    var userName = ''
    if (userRecord) {
      userName = userRecord.getString('name') || userRecord.getString('email') || ''
    }

    var body = e.requestInfo().body || {}
    var config = body.config || body
    if (!config || typeof config !== 'object') {
      config = {}
    }

    try {
      // 1. Interpretar período e modo
      var modo = (config.modo || 'custom').toLowerCase()
      var periodoRaw = String(config.periodo || '').trim()
      var anoCfg = config.ano ? parseInt(config.ano, 10) : null
      var mesCfg = config.mes ? parseInt(config.mes, 10) : null
      var semanaCfg = config.semana ? parseInt(config.semana, 10) : null

      var now = new Date()
      var curYear = now.getUTCFullYear()
      var curMonth = now.getUTCMonth() + 1

      var startDateStr = ''
      var endDateStr = ''
      var periodoEtiqueta = ''

      // Verificação de range "custom": ex. "2025-01_to_2026-09" ou "2025-01-01_to_2026-09-30"
      if (periodoRaw.indexOf('_to_') > 0) {
        var pParts = periodoRaw.split('_to_')
        var pStart = pParts[0].trim()
        var pEnd = pParts[1].trim()

        if (pStart.length === 7) {
          startDateStr = pStart + '-01'
        } else if (pStart.length === 10) {
          startDateStr = pStart
        } else if (pStart.length === 4) {
          startDateStr = pStart + '-01-01'
        }

        if (pEnd.length === 7) {
          // Último dia do mês aproximado / 31
          var pEndParts = pEnd.split('-')
          var eYear = parseInt(pEndParts[0], 10)
          var eMonth = parseInt(pEndParts[1], 10)
          var lastDay = new Date(Date.UTC(eYear, eMonth, 0)).getUTCDate()
          endDateStr = pEnd + '-' + pad(lastDay, 2)
        } else if (pEnd.length === 10) {
          endDateStr = pEnd
        } else if (pEnd.length === 4) {
          endDateStr = pEnd + '-12-31'
        }

        periodoEtiqueta = periodoRaw
      } else if (modo === 'month' || modo === 'mensal' || (anoCfg && mesCfg && !periodoRaw)) {
        var targetAno = anoCfg || curYear
        var targetMes = mesCfg || curMonth
        startDateStr = targetAno + '-' + pad(targetMes, 2) + '-01'
        var lastDayM = new Date(Date.UTC(targetAno, targetMes, 0)).getUTCDate()
        endDateStr = targetAno + '-' + pad(targetMes, 2) + '-' + pad(lastDayM, 2)
        periodoEtiqueta = targetAno + '-' + pad(targetMes, 2)
      } else if (modo === 'week' || modo === 'semanal') {
        var wAno = anoCfg || curYear
        var wSem = semanaCfg || 1
        periodoEtiqueta = wAno + '-W' + pad(wSem, 2)
      } else if (periodoRaw) {
        periodoEtiqueta = periodoRaw
        if (periodoRaw.length === 7) {
          var y = parseInt(periodoRaw.slice(0, 4), 10)
          var m = parseInt(periodoRaw.slice(5, 7), 10)
          startDateStr = periodoRaw + '-01'
          var ld = new Date(Date.UTC(y, m, 0)).getUTCDate()
          endDateStr = periodoRaw + '-' + pad(ld, 2)
        } else if (periodoRaw.length === 4) {
          startDateStr = periodoRaw + '-01-01'
          endDateStr = periodoRaw + '-12-31'
        }
      } else {
        periodoEtiqueta = curYear + '-' + pad(curMonth, 2)
        startDateStr = curYear + '-' + pad(curMonth, 2) + '-01'
        var curLast = new Date(Date.UTC(curYear, curMonth, 0)).getUTCDate()
        endDateStr = curYear + '-' + pad(curMonth, 2) + '-' + pad(curLast, 2)
      }

      // 2. Filtros e Seções
      var filtros = config.filtros || {}
      var dadosInclusos = config.dados_inclusos || {}
      var inclFaturamento = dadosInclusos.faturamento !== false
      var inclPedidos = dadosInclusos.pedidos !== false
      var inclTopClientes = dadosInclusos.top_clientes !== false
      var inclFamilias = dadosInclusos.familias !== false
      var inclCobertura = dadosInclusos.cobertura !== false

      // Montar filtro para a collection faturamento
      var filterParts = []
      if (startDateStr) {
        filterParts.push("data_documento >= '" + startDateStr + " 00:00:00.000Z'")
      }
      if (endDateStr) {
        filterParts.push("data_documento <= '" + endDateStr + " 23:59:59.999Z'")
      }
      if (modo === 'week' && semanaCfg && anoCfg) {
        filterParts.push('ano = ' + anoCfg + ' && semana_iso = ' + semanaCfg)
      } else if (modo === 'month' && mesCfg && anoCfg && !startDateStr) {
        filterParts.push('ano = ' + anoCfg + ' && mes = ' + mesCfg)
      }

      if (filtros.pais) {
        filterParts.push("country ~ '" + filtros.pais.replace(/'/g, "\\'") + "'")
      }
      if (filtros.cliente) {
        var cliEsc = filtros.cliente.replace(/'/g, "\\'")
        filterParts.push("(cliente_nome ~ '" + cliEsc + "' || cliente_codigo ~ '" + cliEsc + "')")
      }

      var fatFilter = filterParts.length > 0 ? filterParts.join(' && ') : '1=1'

      var fatRecords = []
      try {
        fatRecords = $app.findRecordsByFilter('faturamento', fatFilter, '-valor_brl', 10000, 0)
      } catch (errQ) {
        $app
          .logger()
          .warn(
            'maestro_gerar_relatorio: query faturamento falhou com filtro exato, tentando sem horas',
            'err',
            String(errQ),
          )
        // Fallback para caso simples
        try {
          var fbFilter = []
          if (startDateStr) fbFilter.push("data_documento >= '" + startDateStr + "'")
          if (endDateStr) fbFilter.push("data_documento <= '" + endDateStr + "'")
          fatRecords = $app.findRecordsByFilter(
            'faturamento',
            fbFilter.join(' && ') || '1=1',
            '-valor_brl',
            10000,
            0,
          )
        } catch (_) {}
      }

      // Se ainda vazio e período for custom range, busca por ano se houver
      if (fatRecords.length === 0 && anoCfg) {
        try {
          fatRecords = $app.findRecordsByFilter(
            'faturamento',
            'ano = ' + anoCfg,
            '-valor_brl',
            10000,
            0,
          )
        } catch (_) {}
      }

      // 3. Consolidação dos dados
      var totalBrl = 0
      var totalUsd = 0
      var clienteMap = {}
      var familiaMap = {}
      var notasSet = {}

      for (var fi = 0; fi < fatRecords.length; fi++) {
        var r = fatRecords[fi]
        var vBrl = (r.getInt ? r.getInt('valor_brl') : r.valor_brl) || 0
        var vUsd = (r.getInt ? r.getInt('valor_usd') : r.valor_usd) || 0
        totalBrl += vBrl
        totalUsd += vUsd

        var cNome = (r.getString ? r.getString('cliente_nome') : r.cliente_nome) || ''
        var cCod = (r.getString ? r.getString('cliente_codigo') : r.cliente_codigo) || ''
        var cDisplay = cNome || cCod || 'Outros'
        clienteMap[cDisplay] = (clienteMap[cDisplay] || 0) + vBrl

        var prodCod = (r.getString ? r.getString('produto_codigo') : r.produto_codigo || '')
          .trim()
          .toUpperCase()
        var famBruta = (r.getString ? r.getString('familia_produto') : r.familia_produto) || ''
        var famClean = resolverFamiliaLocal(prodCod, famBruta)
        familiaMap[famClean] = (familiaMap[famClean] || 0) + vBrl

        var docData = r.getString ? r.getString('data_documento') : r.data_documento || ''
        var nfAnoVal = (r.getInt ? r.getInt('nf_ano') : r.nf_ano) || 0
        var docKey = (nfAnoVal > 0 ? nfAnoVal + '_' : '') + cCod + '_' + docData
        notasSet[docKey] = true
      }

      var qtdNotas = Object.keys(notasSet).length || fatRecords.length
      var ticketMedio = qtdNotas > 0 ? totalBrl / qtdNotas : 0

      // Top 10 Clientes
      var topClientes = Object.keys(clienteMap).map((k) => ({
        cliente: k,
        valor_brl: Math.round(clienteMap[k] * 100) / 100,
      }))
      topClientes.sort((a, b) => b.valor_brl - a.valor_brl)
      var top10 = topClientes.slice(0, 10)

      // Top Famílias
      var topFamilias = Object.keys(familiaMap).map((k) => ({
        familia: k,
        valor_brl: Math.round(familiaMap[k] * 100) / 100,
      }))
      topFamilias.sort((a, b) => b.valor_brl - a.valor_brl)

      // Carteira de Pedidos e Cobertura
      var carteiraTotalBrl = 0
      try {
        var cartRecords = $app.findRecordsByFilter('pedidos_carteira', '1=1', '', 500, 0)
        for (var ci = 0; ci < cartRecords.length; ci++) {
          var cr = cartRecords[ci]
          carteiraTotalBrl += (cr.getInt ? cr.getInt('valor') : cr.valor) || 0
        }
      } catch (_) {}

      // Metas do período
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
      var metaMesTotal = 0
      try {
        var metaFilterParts = []
        if (periodoEtiqueta) {
          metaFilterParts.push("periodo = '" + periodoEtiqueta.replace(/'/g, "\\'") + "'")
          metaFilterParts.push("periodo ~ '" + periodoEtiqueta.replace(/'/g, "\\'") + "'")
        }
        if (anoCfg && mesCfg) {
          var mCap = MESES_CAP[mesCfg] || ''
          if (mCap) {
            metaFilterParts.push("periodo = '" + mCap + ' ' + anoCfg + "'")
            metaFilterParts.push("periodo ~ '" + mCap + "'")
          }
          var ymStr = anoCfg + '-' + pad(mesCfg, 2)
          metaFilterParts.push("periodo = '" + ymStr + "'")
          metaFilterParts.push("periodo = '" + ymStr + "-01'")
        } else if (anoCfg && !mesCfg) {
          metaFilterParts.push("periodo ~ '" + anoCfg + "'")
        }

        var metaQuery = metaFilterParts.length > 0 ? metaFilterParts.join(' || ') : '1=1'
        var metaRows = $app.findRecordsByFilter('metas', metaQuery, '', 500, 0)
        for (var mi = 0; mi < metaRows.length; mi++) {
          metaMesTotal +=
            (metaRows[mi].getInt ? metaRows[mi].getInt('meta_valor') : metaRows[mi].meta_valor) || 0
        }
      } catch (_) {}

      // Cobertura Comercial = Carteira de Pedidos ÷ Meta do período × 100
      var coberturaPercent =
        metaMesTotal > 0 ? Math.round((carteiraTotalBrl / metaMesTotal) * 10000) / 100 : null

      var metaAtingidaPercent =
        metaMesTotal > 0 ? Math.round((totalBrl / metaMesTotal) * 10000) / 100 : 0

      // 4. Montar o PDF binário (A4 Portrait 595.28 x 841.89)
      var PAGE_W = 595.28
      var PAGE_H = 841.89
      var MARGIN = 50
      var BOTTOM = 60
      var contentW = PAGE_W - 2 * MARGIN

      var pages = []
      var cur = []
      var y = 0

      function newPage() {
        pages.push(cur)
        cur = []
        y = PAGE_H - MARGIN
      }
      newPage()

      function ensure(h) {
        if (y - h < BOTTOM) newPage()
      }
      function line(s) {
        cur.push(s)
      }
      function txt(s, size, font, x, yy) {
        line('BT /' + font + ' ' + size + ' Tf ' + x + ' ' + yy + ' Td (' + escPdf(s) + ') Tj ET')
      }
      function heading(s, desc) {
        ensure(desc ? 38 : 28)
        y -= 6
        // Barra indicadora azul marinho corporativo #1e3a8a
        line('0.12 0.23 0.54 rg ' + MARGIN + ' ' + (y - 3) + ' ' + contentW + ' 2 re f')
        line('0.06 0.09 0.16 rg')
        txt(s, 12.5, 'F2', MARGIN, y - 16)
        y -= 20
        if (desc) {
          line('0.4 0.45 0.55 rg')
          txt(desc, 8.5, 'F1', MARGIN, y - 4)
          line('0.06 0.09 0.16 rg')
          y -= 12
        }
      }
      function fieldLine(label, value) {
        ensure(16)
        var valStr = String(value == null ? '' : value)
        var valLines = wrapText(valStr, 78)
        line('BT /F2 10 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(label) + ': ) Tj ET')
        line(
          'BT /F1 10 Tf ' +
            (MARGIN + label.length * 5.3 + 4) +
            ' ' +
            y +
            ' Td (' +
            escPdf(valLines[0] || '') +
            ') Tj ET',
        )
        y -= 14
        for (var vi = 1; vi < valLines.length; vi++) {
          ensure(14)
          line('BT /F1 10 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(valLines[vi]) + ') Tj ET')
          y -= 13
        }
      }
      function gap(h) {
        y -= h || 8
      }

      // 1. Cabeçalho Corporativo Institucional (Azul Marinho #0f172a / #1e3a8a e Ocre #d97706)
      line('0.06 0.09 0.16 rg ' + MARGIN + ' ' + (PAGE_H - 110) + ' ' + contentW + ' 60 re f')
      // Faixa de destaque dourada #d97706
      line('0.85 0.47 0.02 rg ' + MARGIN + ' ' + (PAGE_H - 113) + ' ' + contentW + ' 3 re f')
      line('1 1 1 rg')
      line('BT /F2 18 Tf ' + (MARGIN + 16) + ' ' + (PAGE_H - 60) + ' Td (BLINK BIOTECH) Tj ET')
      line(
        'BT /F1 9.5 Tf ' +
          (MARGIN + 16) +
          ' ' +
          (PAGE_H - 76) +
          " Td (Blink's Bunker  .  Inteligencia Comercial & Gestao B2B) Tj ET",
      )
      line(
        'BT /F2 8 Tf ' +
          (PAGE_W - MARGIN - 175) +
          ' ' +
          (PAGE_H - 60) +
          ' Td (DOCUMENTO DA DIRETORIA EXECUTIVA) Tj ET',
      )
      line('0.06 0.09 0.16 rg')
      y = PAGE_H - 138

      var tituloRelatorio = 'Blink Biotech - Relatório de Vendas MAESTRO'
      txt(tituloRelatorio, 15, 'F2', MARGIN, y)
      y -= 18
      txt(
        'Demonstrativo Comercial Estruturado . Emissão Automática MAESTRO AI',
        10,
        'F1',
        MARGIN,
        y,
      )
      y -= 20

      // Bloco de Metadados Corporativos
      ensure(58)
      line('0.97 0.98 0.99 rg ' + MARGIN + ' ' + (y - 52) + ' ' + contentW + ' 54 re f')
      line('0.89 0.91 0.94 RG ' + MARGIN + ' ' + (y - 52) + ' ' + contentW + ' 54 re S')
      line('0.06 0.09 0.16 rg')

      var col1X = MARGIN + 10
      var col2X = MARGIN + 140
      var col3X = MARGIN + 280
      var col4X = MARGIN + 390

      // Linha 1 de Metadados
      line('0.4 0.45 0.55 rg')
      txt('ORIGEM', 7.5, 'F2', col1X, y - 10)
      txt('PERÍODO', 7.5, 'F2', col2X, y - 10)
      txt('EMITIDO EM', 7.5, 'F2', col3X, y - 10)
      txt('EMITIDO POR', 7.5, 'F2', col4X, y - 10)

      line('0.06 0.09 0.16 rg')
      txt('Maestro AI (Vendas)', 9, 'F2', col1X, y - 22)
      txt(periodoEtiqueta, 9, 'F2', col2X, y - 22)
      txt(fmtDateTime(new Date().toISOString()), 9, 'F2', col3X, y - 22)
      txt((userName || 'Diretoria').substring(0, 18), 9, 'F2', col4X, y - 22)

      // Linha 2 de Metadados: Filtros
      var activeFiltersList = []
      if (filtros.segmento) activeFiltersList.push('Segmento: ' + filtros.segmento)
      if (filtros.pais) activeFiltersList.push('País: ' + filtros.pais)
      if (filtros.estado) activeFiltersList.push('UF: ' + filtros.estado)
      if (filtros.cliente) activeFiltersList.push('Cliente: ' + filtros.cliente)
      var filtrosDesc =
        activeFiltersList.length > 0
          ? activeFiltersList.join(' | ')
          : 'Visão Global / Sem filtros restritivos'

      line('0.4 0.45 0.55 rg')
      txt('FILTROS APLICADOS:', 7.5, 'F2', col1X, y - 36)
      line('0.15 0.2 0.3 rg')
      txt(filtrosDesc.substring(0, 95), 8.5, 'F1', col1X + 85, y - 36)
      line('0.06 0.09 0.16 rg')
      y -= 68

      // Sumário Executivo do Documento (TOC)
      ensure(42)
      line('0.94 0.96 0.98 rg ' + MARGIN + ' ' + (y - 36) + ' ' + contentW + ' 38 re f')
      // Borda lateral esquerda azul marinho
      line('0.06 0.09 0.16 rg ' + MARGIN + ' ' + (y - 36) + ' 3.5 38 re f')
      line('0.8 0.84 0.9 RG ' + MARGIN + ' ' + (y - 36) + ' ' + contentW + ' 38 re S')
      line('0.06 0.09 0.16 rg')
      txt('SUMÁRIO EXECUTIVO DO DOCUMENTO', 8, 'F2', MARGIN + 10, y - 12)
      line('0.25 0.3 0.4 rg')
      txt(
        '1. Indicadores Gerais de Desempenho    .    2. Top 10 Clientes    .    3. Faturamento por Família    .    4. Cobertura & Parecer',
        8.5,
        'F1',
        MARGIN + 10,
        y - 26,
      )
      line('0.06 0.09 0.16 rg')
      y -= 52

      // Seção 1: Indicadores Gerais de Desempenho (KPIs)
      heading(
        '1. Indicadores Gerais de Desempenho',
        'Demonstrativo consolidado de receita faturada, volume operacional, ticket médio e atingimento de metas comerciais.',
      )
      var kpis = []
      if (inclFaturamento) {
        kpis.push({ label: 'Faturamento Total BRL', value: fmtBRL(totalBrl) })
        if (totalUsd > 0) {
          kpis.push({ label: 'Faturamento Total USD', value: fmtUSD(totalUsd) })
        }
      }
      if (inclPedidos) {
        kpis.push({ label: 'Quantidade de Pedidos/Notas', value: String(qtdNotas) })
        if (ticketMedio > 0) {
          kpis.push({ label: 'Ticket Médio', value: fmtBRL(ticketMedio) })
        }
      }
      if (inclCobertura) {
        kpis.push({ label: 'Carteira de Pedidos', value: fmtBRL(carteiraTotalBrl) })
        kpis.push({
          label: 'Cobertura de Carteira',
          value:
            coberturaPercent !== null && coberturaPercent !== undefined
              ? coberturaPercent.toFixed(1).replace('.', ',') + '%'
              : 'Meta não cadastrada',
        })
      }
      if (metaMesTotal > 0) {
        kpis.push({ label: 'Meta de Faturamento', value: fmtBRL(metaMesTotal) })
        kpis.push({
          label: 'Atingimento da Meta',
          value: metaAtingidaPercent.toFixed(1).replace('.', ',') + '%',
        })
      }

      if (kpis.length > 0) {
        var numCols = kpis.length > 3 ? 3 : kpis.length
        var boxW = (contentW - (numCols - 1) * 8) / numCols
        var boxH = 46

        for (var ki = 0; ki < kpis.length; ki++) {
          var colIdx = ki % numCols
          if (colIdx === 0 && ki > 0) {
            y -= boxH + 8
          }
          ensure(boxH + 6)
          var bx = MARGIN + colIdx * (boxW + 8)
          var by = y - boxH

          line('0.97 0.98 0.99 rg ' + bx + ' ' + by + ' ' + boxW + ' ' + boxH + ' re f')
          line('0.85 0.88 0.92 RG ' + bx + ' ' + by + ' ' + boxW + ' ' + boxH + ' re S')
          line('0.1 0.1 0.1 rg')
          var valStr = String(kpis[ki].value || '')
          var valFontSize = 12
          if (valStr.length > 18) {
            valFontSize = 8.5
          } else if (valStr.length > 13) {
            valFontSize = 9.5
          } else if (valStr.length > 10) {
            valFontSize = 10.5
          }
          line(
            'BT /F2 ' +
              valFontSize +
              ' Tf ' +
              (bx + 8) +
              ' ' +
              (by + 21) +
              ' Td (' +
              escPdf(valStr) +
              ') Tj ET',
          )
          line(
            'BT /F1 8 Tf ' +
              (bx + 8) +
              ' ' +
              (by + 8) +
              ' Td (' +
              escPdf(kpis[ki].label) +
              ') Tj ET',
          )
        }
        y -= boxH + 14
      }

      // Seção 2: Top Clientes por Faturamento
      if (inclTopClientes && top10.length > 0) {
        heading(
          '2. Top Clientes por Faturamento',
          'Relação dos clientes com maior representatividade no faturamento comercial do período.',
        )
        ensure(24)
        // Cabeçalho da tabela zebrada corporativa
        line('0.12 0.23 0.54 rg ' + MARGIN + ' ' + (y - 15) + ' ' + contentW + ' 16 re f')
        line('1 1 1 rg')
        txt('POS.', 8, 'F2', MARGIN + 6, y - 11)
        txt('RAZÃO SOCIAL / CLIENTE', 8, 'F2', MARGIN + 40, y - 11)
        txt('FATURAMENTO TOTAL (R$)', 8, 'F2', PAGE_W - MARGIN - 120, y - 11)
        line('0.06 0.09 0.16 rg')
        y -= 18

        var totalTop10Brl = 0
        for (var ti = 0; ti < top10.length; ti++) {
          ensure(15)
          var cliItem = top10[ti]
          totalTop10Brl += cliItem.valor_brl || 0
          if (ti % 2 === 1) {
            line('0.96 0.97 0.98 rg ' + MARGIN + ' ' + (y - 12) + ' ' + contentW + ' 13 re f')
            line('0.06 0.09 0.16 rg')
          }
          txt(String(ti + 1) + 'º', 8, 'F2', MARGIN + 6, y - 9)
          txt(String(cliItem.cliente).substring(0, 55), 8, 'F1', MARGIN + 40, y - 9)
          txt(fmtBRL(cliItem.valor_brl), 8, 'F2', PAGE_W - MARGIN - 120, y - 9)
          y -= 14
        }
        // Linha de total no rodapé da tabela
        ensure(16)
        line('0.88 0.91 0.94 rg ' + MARGIN + ' ' + (y - 12) + ' ' + contentW + ' 14 re f')
        line('0.12 0.23 0.54 rg')
        txt('TOTAL TOP ' + top10.length + ':', 8.5, 'F2', MARGIN + 6, y - 9)
        txt(fmtBRL(totalTop10Brl), 8.5, 'F2', PAGE_W - MARGIN - 120, y - 9)
        line('0.06 0.09 0.16 rg')
        y -= 20
      }

      // Seção 3: Famílias de Produtos
      if (inclFamilias && topFamilias.length > 0) {
        heading(
          '3. Faturamento por Família de Produtos',
          'Distribuição da receita comercial por categoria e linha de produtos Blink Biotech.',
        )
        ensure(24)
        line('0.12 0.23 0.54 rg ' + MARGIN + ' ' + (y - 15) + ' ' + contentW + ' 16 re f')
        line('1 1 1 rg')
        txt('POS.', 8, 'F2', MARGIN + 6, y - 11)
        txt('FAMÍLIA DE PRODUTOS', 8, 'F2', MARGIN + 40, y - 11)
        txt('FATURAMENTO TOTAL (R$)', 8, 'F2', PAGE_W - MARGIN - 120, y - 11)
        line('0.06 0.09 0.16 rg')
        y -= 18

        var totalFamBrl = 0
        for (var fmi = 0; fmi < topFamilias.length; fmi++) {
          ensure(15)
          var famItem = topFamilias[fmi]
          totalFamBrl += famItem.valor_brl || 0
          if (fmi % 2 === 1) {
            line('0.96 0.97 0.98 rg ' + MARGIN + ' ' + (y - 12) + ' ' + contentW + ' 13 re f')
            line('0.06 0.09 0.16 rg')
          }
          txt(String(fmi + 1) + 'º', 8, 'F2', MARGIN + 6, y - 9)
          txt(String(famItem.familia).substring(0, 55), 8, 'F1', MARGIN + 40, y - 9)
          txt(fmtBRL(famItem.valor_brl), 8, 'F2', PAGE_W - MARGIN - 120, y - 9)
          y -= 14
        }
        // Linha de total no rodapé da tabela
        ensure(16)
        line('0.88 0.91 0.94 rg ' + MARGIN + ' ' + (y - 12) + ' ' + contentW + ' 14 re f')
        line('0.12 0.23 0.54 rg')
        txt('TOTAL DAS FAMÍLIAS:', 8.5, 'F2', MARGIN + 6, y - 9)
        txt(fmtBRL(totalFamBrl), 8.5, 'F2', PAGE_W - MARGIN - 120, y - 9)
        line('0.06 0.09 0.16 rg')
        y -= 20
      }

      // Seção 4: Parecer Estratégico e Observações Operacionais
      if (config.observacoes || inclCobertura) {
        heading(
          '4. Parecer Estratégico & Observações Operacionais',
          'Recomendações gerenciais e diretrizes para arquivamento executivo.',
        )
        if (inclCobertura) {
          ensure(18)
          var cobDesc = ''
          if (coberturaPercent !== null && coberturaPercent !== undefined) {
            cobDesc =
              'Cobertura Comercial de Carteira calculada em ' +
              coberturaPercent.toFixed(1).replace('.', ',') +
              '% (' +
              fmtBRL(carteiraTotalBrl) +
              ' em carteira de pedidos frente a ' +
              fmtBRL(metaMesTotal) +
              ' de meta do período).'
          } else {
            cobDesc =
              'Carteira de pedidos em ' +
              fmtBRL(carteiraTotalBrl) +
              ' (meta do período não cadastrada para apuração de cobertura comercial).'
          }
          txt(cobDesc, 8.5, 'F2', MARGIN, y - 8)
          y -= 16
        }
        if (config.observacoes) {
          var obsLines = wrapText(config.observacoes, 95)
          for (var oi = 0; oi < obsLines.length; oi++) {
            ensure(13)
            txt(obsLines[oi], 8.5, 'F1', MARGIN, y - 8)
            y -= 12
          }
        }
        gap(6)
      }

      // Finalizar página atual
      pages.push(cur)

      // Rodapé institucional em todas as páginas
      var totalPages = pages.length
      for (var pi = 0; pi < totalPages; pi++) {
        var pg = pages[pi]
        // Linha divisória de rodapé
        pg.push('0.85 0.88 0.92 rg ' + MARGIN + ' 44 ' + contentW + ' 1 re f')
        pg.push('0.4 0.45 0.55 rg')
        pg.push(
          'BT /F1 8 Tf ' +
            MARGIN +
            ' 32 Td (' +
            escPdf('Blink Biotech - Documento confidencial para Diretoria Executiva . MAESTRO AI') +
            ') Tj ET',
        )
        pg.push(
          'BT /F2 8 Tf ' +
            (PAGE_W - MARGIN - 75) +
            ' 32 Td (Pagina ' +
            (pi + 1) +
            ' de ' +
            totalPages +
            ') Tj ET',
        )
        pg.push('0.1 0.1 0.1 rg')
      }

      // Montar objetos PDF
      var objects = []
      objects.push(stringToBytes('<< /Type /Catalog /Pages 2 0 R >>'))
      var kids = []
      for (var ki2 = 0; ki2 < totalPages; ki2++) {
        kids.push(3 + ki2 * 2 + ' 0 R')
      }
      objects.push(
        stringToBytes(
          '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + totalPages + ' >>',
        ),
      )

      for (var pi2 = 0; pi2 < totalPages; pi2++) {
        var pageObjNum = 3 + pi2 * 2
        var contentObjNum = pageObjNum + 1
        objects.push(
          stringToBytes(
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
              PAGE_W +
              ' ' +
              PAGE_H +
              '] /Resources << /Font << /F1 ' +
              (3 + totalPages * 2) +
              ' 0 R /F2 ' +
              (3 + totalPages * 2 + 1) +
              ' 0 R >> >> /Contents ' +
              contentObjNum +
              ' 0 R >>',
          ),
        )
        var pageContentStr = pages[pi2].join('\n')
        var pageContentBytes = latin1Bytes(pageContentStr)
        var streamBody = stringToBytes('<< /Length ' + pageContentBytes.length + ' >>\nstream\n')
        streamBody = streamBody.concat(pageContentBytes)
        streamBody = streamBody.concat(stringToBytes('\nendstream'))
        objects.push(streamBody)
      }

      objects.push(
        stringToBytes(
          '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        ),
      )
      objects.push(
        stringToBytes(
          '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        ),
      )

      var pdf = []
      appendStr(pdf, '%PDF-1.4\n')
      appendStr(pdf, '%\u00e2\u00e3\u00cf\u00d3\n')

      var offsets = [0]
      for (var oi2 = 0; oi2 < objects.length; oi2++) {
        offsets.push(pdf.length)
        appendStr(pdf, oi2 + 1 + ' 0 obj\n')
        appendBytes(pdf, objects[oi2])
        appendStr(pdf, '\nendobj\n')
      }

      var xrefStart = pdf.length
      appendStr(pdf, 'xref\n')
      appendStr(pdf, '0 ' + (objects.length + 1) + '\n')
      appendStr(pdf, '0000000000 65535 f \n')
      for (var xi = 1; xi <= objects.length; xi++) {
        appendStr(pdf, pad(offsets[xi], 10) + ' 00000 n \n')
      }
      appendStr(pdf, 'trailer\n')
      appendStr(pdf, '<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n')
      appendStr(pdf, 'startxref\n')
      appendStr(pdf, xrefStart + '\n')
      appendStr(pdf, '%%EOF')

      var pdfBytes = pdf

      // 5. Salvar em documents e client_reports via $app.save (privilégio de aplicação)
      // Nome padronizado para aparecer em /relatorios-automaticos e /documents
      // Formato: relatorio-mensal-YYYY-MM-maestro-... ou relatorio-mensal-[periodo].pdf
      var safePeriod = periodoEtiqueta.replace(/[^a-zA-Z0-9_-]/g, '_')
      var fileTimestamp = Math.floor(new Date().getTime() / 1000)
      var nomeOriginalDoc = 'relatorio-mensal-' + safePeriod + '-' + fileTimestamp + '.pdf'

      var docFile = $filesystem.fileFromBytes(pdfBytes, nomeOriginalDoc)
      var docCollection = $app.findCollectionByNameOrId('documents')
      var docRecord = new Record(docCollection)
      docRecord.set('title', 'Relatório de Vendas MAESTRO - ' + periodoEtiqueta)
      docRecord.set('nome_original', nomeOriginalDoc)
      docRecord.set('category', 'Relatórios Automáticos')
      docRecord.set('min_access_level', 'Comum')
      docRecord.set('file', docFile)
      $app.save(docRecord)

      // Salvar em client_reports
      var crRecordId = ''
      try {
        var crCollection = $app.findCollectionByNameOrId('client_reports')
        var crRecord = new Record(crCollection)

        // Se houver fábrica vinculada por filtro de cliente, associa
        var linkedFactory = null
        if (filtros.cliente) {
          try {
            linkedFactory = $app.findFirstRecordByFilter(
              'factories',
              "name ~ '" +
                filtros.cliente.replace(/'/g, "\\'") +
                "' || codigo_cliente = '" +
                filtros.cliente.replace(/'/g, "\\'") +
                "'",
            )
          } catch (_) {}
        }
        if (!linkedFactory) {
          try {
            var anyFactory = $app.findRecordsByFilter('factories', '1=1', '', 1, 0)
            if (anyFactory && anyFactory.length > 0) linkedFactory = anyFactory[0]
          } catch (_) {}
        }

        if (linkedFactory) {
          crRecord.set('client_id', linkedFactory.id)
          crRecord.set('client_name', linkedFactory.getString('name') || 'Blink Biotech')
        } else {
          crRecord.set('client_name', 'Blink Biotech Geral')
        }

        crRecord.set('generated_by', userId)
        crRecord.set('generated_by_name', userName || 'Maestro AI')
        crRecord.set('title', 'Relatório de Vendas MAESTRO - ' + periodoEtiqueta)
        var crFile = $filesystem.fileFromBytes(pdfBytes, nomeOriginalDoc)
        crRecord.set('file', crFile)
        if (startDateStr) crRecord.set('periodo_inicio', startDateStr)
        if (endDateStr) crRecord.set('periodo_fim', endDateStr)
        crRecord.set('total_acoes', qtdNotas)
        $app.save(crRecord)
        crRecordId = crRecord.id
      } catch (errCr) {
        $app
          .logger()
          .warn('maestro_gerar_relatorio: client_reports save failed', 'error', String(errCr))
      }

      // Log de atividade
      try {
        var actCol = $app.findCollectionByNameOrId('activity_logs')
        var actRecord = new Record(actCol)
        actRecord.set('user', userId)
        actRecord.set('action', 'Relatório MAESTRO gerado: ' + periodoEtiqueta)
        actRecord.set(
          'details',
          'Relatório consolidado de faturamento e vendas gerado pelo assistente MAESTRO e salvo no sistema.',
        )
        actRecord.set('origem', 'painel')
        actRecord.set('tipo', 'outro')
        actRecord.set('target_collection', 'documents')
        actRecord.set('recordId', docRecord.id)
        $app.save(actRecord)
      } catch (_) {}

      // Retornar JSON com os KPIs e metadados
      return e.json(200, {
        success: true,
        document_id: docRecord.id,
        client_report_id: crRecordId,
        nome_arquivo: nomeOriginalDoc,
        titulo: 'Relatório de Vendas MAESTRO - ' + periodoEtiqueta,
        periodo: periodoEtiqueta,
        faturado_total_brl: Math.round(totalBrl * 100) / 100,
        faturado_total_usd: Math.round(totalUsd * 100) / 100,
        quantidade_notas: qtdNotas,
        ticket_medio: Math.round(ticketMedio * 100) / 100,
        carteira_total_brl: Math.round(carteiraTotalBrl * 100) / 100,
        cobertura_percent: coberturaPercent,
        top_clientes: top10,
        top_familias: topFamilias,
      })
    } catch (err) {
      $app.logger().error('maestro_gerar_relatorio: error', 'error', String(err))
      return e.json(500, {
        success: false,
        error: 'Não foi possível gerar o relatório. Tente novamente.',
      })
    }
  },
  $apis.requireAuth(),
)
