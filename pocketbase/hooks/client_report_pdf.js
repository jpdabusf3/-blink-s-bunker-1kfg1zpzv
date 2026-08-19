// Generates a client history report as a PDF file from the activity_logs and
// funnel_activity_log linked to a factory/client, and returns the binary PDF
// for download. The generated blob is then stored in `client_reports` by the
// client (standard SDK multipart upload) so it appears in the Relatórios tab.
//
// POST /backend/v1/client-reports/pdf
// body: { clientId, titulo?, periodoInicio?, periodoFim?, modelo?, solicitante? }
//   - modelo: "executivo" | "tecnico" | "comercial" (default: executivo)
//   - solicitante: name of the requesting user (falls back to auth user)
//   - gathers activity_logs + funnel_activity_log (últimas 5) for the client
//   - builds a multi-page PDF 1.4 (Helvetica/Helvetica-Bold, A4 portrait)
//   - cover: branded Blink header band, title, client, generated-by, date
//   - sections: Dados do Cliente, Status do Funil, Próximos Passos, KPIs,
//     Últimas Atividades do Funil, Histórico de Ações
//   - footer on every page: "Blink Biotech — Inteligência Comercial" + page n°
//   - responds with the binary blob (application/pdf)
//
// All helpers are inlined inside the callback (JSVM callbacks cannot see
// top-level declarations).
routerAdd(
  'POST',
  '/backend/v1/client-reports/pdf',
  (e) => {
    function pad(n, len) {
      var s = '' + n
      while (s.length < len) s = '0' + s
      return s
    }
    function escPdf(s) {
      return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
    }
    function fmtDate(iso) {
      if (!iso) return '—'
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
    function fmtDateOnly(iso) {
      if (!iso) return '—'
      try {
        var d = new Date(iso)
        if (isNaN(d.getTime())) return String(iso)
        return pad(d.getDate(), 2) + '/' + pad(d.getMonth() + 1, 2) + '/' + d.getFullYear()
      } catch (_) {
        return String(iso)
      }
    }
    function fmtBRL(n) {
      if (n == null || isNaN(n)) return '—'
      try {
        return Number(n).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      } catch (_) {
        return String(n)
      }
    }
    function funnelIcon(actionType) {
      switch (actionType) {
        case 'create':
          return '[+]'
        case 'update':
          return '[~]'
        case 'delete':
          return '[x]'
        case 'move':
          return '[->]'
        case 'assign':
          return '[@]'
        case 'status_change':
          return '[<->]'
        default:
          return '[•]'
      }
    }
    // UTF-8 string -> byte array (number[]) for PDF object bodies.
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
    // Latin-1 string -> byte array for content streams (WinAnsiEncoding).
    // Non-representable chars become '?'.
    function latin1Bytes(s) {
      var out = []
      s = String(s == null ? '' : s)
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i)
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
    function userDisplay(log) {
      try {
        var uId = log.getString('user')
        if (!uId) return '—'
        var u = $app.findRecordById('users', uId)
        return u.getString('name') || u.getString('email') || '—'
      } catch (_) {
        return '—'
      }
    }

    // ---------- visual templates ----------
    var TEMPLATES = {
      executivo: {
        label: 'Executivo',
        primary: '#1f2937',
        accent: '#6b7280',
        headerRgb: '0.12 0.16 0.22',
        accentRgb: '0.42 0.45 0.50',
        tableHeaderRgb: '0.90 0.91 0.93',
        kpiBgRgb: '0.98 0.98 0.98',
        kpiBorderRgb: '0.82 0.84 0.86',
      },
      tecnico: {
        label: 'Técnico',
        primary: '#1e3a8a',
        accent: '#2563eb',
        headerRgb: '0.12 0.23 0.54',
        accentRgb: '0.15 0.39 0.92',
        tableHeaderRgb: '0.86 0.92 1.00',
        kpiBgRgb: '0.94 0.96 1.00',
        kpiBorderRgb: '0.15 0.39 0.92',
      },
      comercial: {
        label: 'Comercial',
        primary: '#b91c1c',
        accent: '#f59e0b',
        headerRgb: '0.73 0.11 0.11',
        accentRgb: '0.96 0.62 0.04',
        tableHeaderRgb: '1.00 0.95 0.78',
        kpiBgRgb: '1.00 0.97 0.93',
        kpiBorderRgb: '0.96 0.62 0.04',
      },
    }

    // ---------- main ----------
    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    var body = e.requestInfo().body || {}
    var clientId = body.clientId
    if (!clientId) return e.badRequestError('clientId é obrigatório')

    try {
      var modeloKey = String(body.modelo || 'executivo').toLowerCase()
      if (!TEMPLATES[modeloKey]) modeloKey = 'executivo'
      var T = TEMPLATES[modeloKey]

      var factory = null
      try {
        factory = $app.findRecordById('factories', clientId)
      } catch (_) {
        return e.notFoundError('cliente não encontrado')
      }
      var clientName = factory.getString('name')

      // factory registration fields
      var cnpj = ''
      try {
        cnpj = factory.getString('cnpj')
      } catch (_) {}
      var valorMedio = factory.get('valor_medio')
      var valorAtual = factory.get('valor_atual')
      var ultimoPedidoRaw = ''
      try {
        ultimoPedidoRaw = factory.getString('ultimo_pedido')
      } catch (_) {}
      var proximosPassos = ''
      try {
        proximosPassos = factory.getString('proximos_passos')
      } catch (_) {}
      var acao = ''
      try {
        acao = factory.getString('acao')
      } catch (_) {}

      var gestorTecnicoName = '—'
      try {
        var gtId = factory.getString('gestor_tecnico_id')
        if (gtId) {
          var gt = $app.findRecordById('gestao_tecnica', gtId)
          gestorTecnicoName = gt.getString('nome') || '—'
        }
      } catch (_) {}
      var vendedorName = '—'
      try {
        var vId = factory.getString('vendedor_id')
        if (vId) {
          var v = $app.findRecordById('gestao_tecnica', vId)
          vendedorName = v.getString('nome') || '—'
        }
      } catch (_) {}

      var titulo = body.titulo || 'Relatório de Histórico — ' + clientName
      var periodoInicio = body.periodoInicio || ''
      var periodoFim = body.periodoFim || ''
      var periodoTxt = ''
      if (periodoInicio || periodoFim) {
        periodoTxt =
          '(' +
          (periodoInicio ? fmtDate(periodoInicio) : 'início') +
          ' até ' +
          (periodoFim ? fmtDate(periodoFim) : 'agora') +
          ')'
      }

      var userName = body.solicitante || ''
      if (!userName && e.auth && e.auth.getString) {
        userName = e.auth.getString('name') || e.auth.getString('email') || ''
      }

      function fmtIsoDateStart(dStr) {
        if (!dStr) return ''
        if (dStr.indexOf(' ') > 0 || dStr.indexOf('T') > 0) return dStr
        return dStr + ' 00:00:00'
      }

      function fmtIsoDateEnd(dStr) {
        if (!dStr) return ''
        if (dStr.indexOf(' ') > 0 || dStr.indexOf('T') > 0) return dStr
        return dStr + ' 23:59:59'
      }

      var activityFilter = "recordId = '" + clientId + "'"
      if (periodoInicio) {
        activityFilter += " && created >= '" + fmtIsoDateStart(periodoInicio) + "'"
      }
      if (periodoFim) {
        activityFilter += " && created <= '" + fmtIsoDateEnd(periodoFim) + "'"
      }

      var logs = []
      try {
        logs = $app.findRecordsByFilter('activity_logs', activityFilter, 'created', 10000, 0)
      } catch (_) {}

      var funnelFilter =
        "entity_id = '" + clientId + "' && (entity_type = 'client' || entity_type = 'factory')"
      if (periodoInicio) {
        funnelFilter += " && created >= '" + fmtIsoDateStart(periodoInicio) + "'"
      }
      if (periodoFim) {
        funnelFilter += " && created <= '" + fmtIsoDateEnd(periodoFim) + "'"
      }

      var funnelLogs = []
      try {
        funnelLogs = $app.findRecordsByFilter('funnel_activity_log', funnelFilter, '-created', 5, 0)
      } catch (_) {}

      // ---------- build the PDF ----------
      var PAGE_W = 595.28
      var PAGE_H = 841.89
      var MARGIN = 50
      var BOTTOM = 60
      var contentW = PAGE_W - 2 * MARGIN

      // State: array of pages, each page is an array of content-stream lines.
      var pages = []
      var cur = []
      var y = 0

      function newPage() {
        pages.push(cur)
        cur = []
        y = PAGE_H - MARGIN
      }
      newPage() // first page

      function ensure(h) {
        if (y - h < BOTTOM) newPage()
      }
      function line(s) {
        cur.push(s)
      }
      function txt(s, size, font, x, yy) {
        line('BT /' + font + ' ' + size + ' Tf ' + x + ' ' + yy + ' Td (' + escPdf(s) + ') Tj ET')
      }
      function heading(s) {
        ensure(28)
        y -= 6
        // accent rule
        line(T.accentRgb + ' rg ' + MARGIN + ' ' + (y - 4) + ' ' + contentW + ' 1.5 re f')
        line('0.1 0.1 0.1 rg')
        txt(s, 13, 'F2', MARGIN, y - 16)
        y -= 26
      }
      function fieldLine(label, value) {
        ensure(16)
        var valStr = String(value == null ? '' : value)
        var valLines = wrapText(valStr, 78)
        // label bold then value (first line)
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
      function paragraph(s, size) {
        size = size || 10
        var ls = wrapText(s, 95)
        for (var i = 0; i < ls.length; i++) {
          ensure(14)
          line('BT /F1 ' + size + ' Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(ls[i]) + ') Tj ET')
          y -= size + 4
        }
      }
      function gap(h) {
        y -= h || 8
      }

      // ---- cover header band ----
      line(T.headerRgb + ' rg ' + MARGIN + ' ' + (PAGE_H - 110) + ' ' + contentW + ' 60 re f')
      line('1 1 1 rg')
      line('BT /F2 20 Tf ' + (MARGIN + 16) + ' ' + (PAGE_H - 62) + ' Td (BLINK BIOTECH) Tj ET')
      line(
        'BT /F1 10 Tf ' +
          (MARGIN + 16) +
          ' ' +
          (PAGE_H - 78) +
          ' Td (Inteligencia Comercial  -  Relatorio ' +
          escPdf(T.label) +
          ') Tj ET',
      )
      line('0.1 0.1 0.1 rg')
      y = PAGE_H - 140

      txt(titulo, 16, 'F2', MARGIN, y)
      y -= 24
      txt('Cliente: ' + clientName, 12, 'F1', MARGIN, y)
      y -= 18
      txt('Período: ' + (periodoTxt || 'Todo o histórico'), 10, 'F1', MARGIN, y)
      y -= 14
      txt('Total de ações registradas: ' + logs.length, 10, 'F1', MARGIN, y)
      y -= 14
      txt('Solicitado por: ' + (userName || '—'), 10, 'F1', MARGIN, y)
      y -= 14
      txt('Gerado em: ' + fmtDate(new Date().toISOString()), 10, 'F1', MARGIN, y)
      y -= 10
      line('0.8 0.8 0.8 rg ' + MARGIN + ' ' + (y - 2) + ' ' + contentW + ' 0.5 re f')
      line('0.1 0.1 0.1 rg')
      y -= 12

      // 2. Dados do Cliente
      heading('Dados do Cliente')
      fieldLine('Nome', clientName)
      fieldLine('CNPJ', cnpj || '—')
      var species = ''
      try {
        species = factory.getString('animalSpecies')
      } catch (_) {}
      fieldLine('Espécie', species || '—')
      var cidadeEstado = ''
      try {
        if (factory.getString('city')) cidadeEstado = factory.getString('city')
      } catch (_) {}
      try {
        if (factory.getString('state'))
          cidadeEstado += (cidadeEstado ? ' — ' : '') + factory.getString('state')
      } catch (_) {}
      fieldLine('Cidade/Estado', cidadeEstado || '—')
      fieldLine('Gestor Técnico', gestorTecnicoName)
      fieldLine('Vendedor', vendedorName)
      gap(6)

      // 3. Status do Funil
      heading('Status do Funil')
      var statusFunil = ''
      try {
        statusFunil = factory.getString('status_funil')
      } catch (_) {}
      fieldLine('Status', statusFunil || '—')
      fieldLine('Valor Médio', fmtBRL(valorMedio))
      fieldLine('Valor Atual', fmtBRL(valorAtual))
      fieldLine('Último Pedido', fmtDateOnly(ultimoPedidoRaw))
      gap(6)

      // 4. Próximos Passos e Ação
      heading('Próximos Passos e Ação')
      fieldLine('Próximos Passos', proximosPassos || '—')
      fieldLine('Ação', acao || '—')
      gap(6)

      // 5. KPIs (counts by tipo)
      var byTipo = {}
      for (var ti = 0; ti < logs.length; ti++) {
        var tKey = logs[ti].getString('tipo') || 'outro'
        byTipo[tKey] = (byTipo[tKey] || 0) + 1
      }
      heading('Indicadores')
      var kpis = [
        { label: 'Ações', value: logs.length },
        { label: 'Mudanças de Status', value: byTipo['status'] || 0 },
        { label: 'Ações Registradas', value: byTipo['acao'] || 0 },
      ]
      var boxW = (contentW - 2 * 12) / 3
      var boxH = 44
      ensure(boxH + 6)
      for (var ki = 0; ki < kpis.length; ki++) {
        var bx = MARGIN + ki * (boxW + 12)
        var by = y - boxH
        line(T.kpiBgRgb + ' rg ' + bx + ' ' + by + ' ' + boxW + ' ' + boxH + ' re f')
        line(T.kpiBorderRgb + ' RG ' + bx + ' ' + by + ' ' + boxW + ' ' + boxH + ' re S')
        line('0.1 0.1 0.1 rg')
        line(
          'BT /F2 16 Tf ' +
            (bx + boxW / 2 - 10) +
            ' ' +
            (by + 18) +
            ' Td (' +
            escPdf(String(kpis[ki].value)) +
            ') Tj ET',
        )
        line(
          'BT /F1 8 Tf ' + (bx + 6) + ' ' + (by + 6) + ' Td (' + escPdf(kpis[ki].label) + ') Tj ET',
        )
      }
      y -= boxH + 12

      // 6. Últimas Atividades do Funil
      heading('Últimas Atividades do Funil')
      if (funnelLogs.length === 0) {
        paragraph('Nenhuma atividade de funil registrada para este cliente.', 10)
      } else {
        for (var fi = 0; fi < funnelLogs.length; fi++) {
          var fLog = funnelLogs[fi]
          var fActionType = fLog.getString('action_type') || ''
          var fDesc = fLog.getString('description') || ''
          var fOld = fLog.getString('old_value') || ''
          var fNew = fLog.getString('new_value') || ''
          ensure(34)
          // accent left bar
          line(T.accentRgb + ' rg ' + MARGIN + ' ' + (y - 18) + ' 3 18 re f')
          line('0.1 0.1 0.1 rg')
          line(
            'BT /F2 9 Tf ' +
              (MARGIN + 8) +
              ' ' +
              y +
              ' Td (' +
              escPdf(funnelIcon(fActionType) + ' ' + fmtDate(fLog.getString('created'))) +
              ') Tj ET',
          )
          y -= 12
          var descLines = wrapText(fDesc, 92)
          for (var di = 0; di < descLines.length; di++) {
            ensure(12)
            line(
              'BT /F1 9 Tf ' + (MARGIN + 8) + ' ' + y + ' Td (' + escPdf(descLines[di]) + ') Tj ET',
            )
            y -= 11
          }
          if (fOld || fNew) {
            ensure(12)
            line(
              'BT /F1 8 Tf ' +
                (MARGIN + 8) +
                ' ' +
                y +
                ' Td (Anterior: ' +
                escPdf(fOld || '—') +
                '  ->  Novo: ' +
                escPdf(fNew || '—') +
                ') Tj ET',
            )
            y -= 10
          }
          y -= 4
        }
      }
      gap(6)

      // 7. Histórico de Ações
      heading('Histórico de Ações')
      if (logs.length === 0) {
        paragraph('Nenhuma ação registrada para este cliente.', 10)
      } else {
        for (var li = 0; li < logs.length; li++) {
          var log = logs[li]
          var tipo = log.getString('tipo') || 'outro'
          var action = log.getString('action') || ''
          var details = log.getString('details') || ''
          var prox = log.getString('proximo_passo') || ''
          var stOld = log.getString('status_anterior') || ''
          var stNew = log.getString('status_novo') || ''
          ensure(30)
          line(T.tableHeaderRgb + ' rg ' + MARGIN + ' ' + (y - 16) + ' ' + contentW + ' 16 re f')
          line('0.1 0.1 0.1 rg')
          line(
            'BT /F2 9 Tf ' +
              (MARGIN + 4) +
              ' ' +
              (y - 12) +
              ' Td (' +
              escPdf(fmtDate(log.getString('created')) + '   [' + tipo + ']') +
              ') Tj ET',
          )
          y -= 18
          var actLines = wrapText(action, 95)
          for (var ai = 0; ai < actLines.length; ai++) {
            ensure(12)
            line('BT /F1 9 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(actLines[ai]) + ') Tj ET')
            y -= 11
          }
          if (details) {
            var detLines = wrapText(details, 95)
            for (var ddi = 0; ddi < detLines.length; ddi++) {
              ensure(12)
              line('BT /F1 8 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(detLines[ddi]) + ') Tj ET')
              y -= 10
            }
          }
          if (prox) {
            ensure(12)
            line(
              'BT /F1 8 Tf ' + MARGIN + ' ' + y + ' Td (Proximo passo: ' + escPdf(prox) + ') Tj ET',
            )
            y -= 10
          }
          if (stOld || stNew) {
            ensure(12)
            line(
              'BT /F1 8 Tf ' +
                MARGIN +
                ' ' +
                y +
                ' Td (Status: ' +
                escPdf(stOld || '—') +
                ' -> ' +
                escPdf(stNew || '—') +
                ') Tj ET',
            )
            y -= 10
          }
          ensure(12)
          line(
            'BT /F1 8 Tf ' +
              MARGIN +
              ' ' +
              y +
              ' Td (Responsavel: ' +
              escPdf(userDisplay(log)) +
              ') Tj ET',
          )
          y -= 14
        }
      }

      // final page
      pages.push(cur)

      // ---------- footer for every page ----------
      var totalPages = pages.length
      for (var pi = 0; pi < totalPages; pi++) {
        var pg = pages[pi]
        pg.push('0.5 0.5 0.5 rg')
        pg.push('BT /F1 8 Tf ' + MARGIN + ' 35 Td (Blink Biotech - Inteligencia Comercial) Tj ET')
        pg.push(
          'BT /F1 8 Tf ' +
            (PAGE_W - MARGIN - 60) +
            ' 35 Td (Pagina ' +
            (pi + 1) +
            '/' +
            totalPages +
            ') Tj ET',
        )
        pg.push('0.1 0.1 0.1 rg')
      }

      // ---------- assemble PDF objects ----------
      // Object numbering:
      //   1 = Catalog, 2 = Pages
      //   then for each page i: pageObj (2 + i*2 + 1), contentObj (2 + i*2 + 2)
      //   then fonts: Helvetica, Helvetica-Bold
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
      // fonts
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
      for (var oi = 0; oi < objects.length; oi++) {
        offsets.push(pdf.length)
        appendStr(pdf, oi + 1 + ' 0 obj\n')
        appendBytes(pdf, objects[oi])
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

      return e.blob(200, 'application/pdf', pdf)
    } catch (err) {
      return e.json(500, { error: 'Erro ao gerar relatório PDF.' })
    }
  },
  $apis.requireAuth(),
)
