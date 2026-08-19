// Generates a client history report as a self-contained, Google-Docs-friendly
// HTML document (inline styles, no external CSS) and returns it as text/html.
// The frontend opens this in a new tab so the user can copy / "File > Open"
// it into Google Docs.
//
// POST /backend/v1/client-reports/google-docs
// body: { clientId, titulo?, modelo?, solicitante? }
//   - modelo: "executivo" | "tecnico" | "comercial" (default: executivo)
//   - gathers activity_logs + funnel_activity_log (últimas 5) for the client
//   - builds HTML with the same structure as the PDF: cover, dados do cliente,
//     status do funil, próximos passos, KPIs, últimas 5 atividades, histórico
//     de ações, footer "Blink Biotech — Inteligência Comercial"
//   - all styles are inline / in a <style> block (Google-Docs compatible)
//
// All helpers are inlined inside the callback (JSVM callbacks cannot see
// top-level declarations).
routerAdd(
  'POST',
  '/backend/v1/client-reports/google-docs',
  (e) => {
    function pad(n, len) {
      var s = '' + n
      while (s.length < len) s = '0' + s
      return s
    }
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
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
          return '[→]'
        case 'assign':
          return '[@]'
        case 'status_change':
          return '[⇄]'
        default:
          return '[•]'
      }
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

    var TEMPLATES = {
      executivo: {
        label: 'Executivo',
        primary: '#1f2937',
        accent: '#6b7280',
        headerBg: '#1f2937',
        headerColor: '#ffffff',
        tableHeaderBg: '#e5e7eb',
        kpiBg: '#f9fafb',
        kpiBorder: '#d1d5db',
        bodyFont: "Georgia, 'Times New Roman', serif",
      },
      tecnico: {
        label: 'Técnico',
        primary: '#1e3a8a',
        accent: '#2563eb',
        headerBg: '#1e3a8a',
        headerColor: '#ffffff',
        tableHeaderBg: '#dbeafe',
        kpiBg: '#eff6ff',
        kpiBorder: '#2563eb',
        bodyFont: "'Segoe UI', Calibri, Arial, sans-serif",
      },
      comercial: {
        label: 'Comercial',
        primary: '#b91c1c',
        accent: '#f59e0b',
        headerBg: 'linear-gradient(135deg,#b91c1c,#f59e0b)',
        headerColor: '#ffffff',
        tableHeaderBg: '#fef3c7',
        kpiBg: '#fff7ed',
        kpiBorder: '#f59e0b',
        bodyFont: "'Segoe UI', Calibri, Arial, sans-serif",
      },
    }

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

      var logs = []
      try {
        logs = $app.findRecordsByFilter(
          'activity_logs',
          "recordId = '" + clientId + "'",
          'created',
          10000,
          0,
        )
      } catch (_) {}

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

      var funnelLogs = []
      try {
        funnelLogs = $app.findRecordsByFilter(
          'funnel_activity_log',
          "entity_id = '" + clientId + "' && (entity_type = 'client' || entity_type = 'factory')",
          '-created',
          5,
          0,
        )
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
      var nowStr = fmtDate(new Date().toISOString())

      var species = ''
      try {
        species = factory.getString('animalSpecies')
      } catch (_) {}
      var cidadeEstado = ''
      try {
        if (factory.getString('city')) cidadeEstado = factory.getString('city')
      } catch (_) {}
      try {
        if (factory.getString('state'))
          cidadeEstado += (cidadeEstado ? ' — ' : '') + factory.getString('state')
      } catch (_) {}
      var statusFunil = ''
      try {
        statusFunil = factory.getString('status_funil')
      } catch (_) {}

      var byTipo = {}
      for (var ti = 0; ti < logs.length; ti++) {
        var tKey = logs[ti].getString('tipo') || 'outro'
        byTipo[tKey] = (byTipo[tKey] || 0) + 1
      }

      var h = ''
      h += '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
      h += '<title>' + esc(titulo) + '</title>'
      h += '<style>'
      h +=
        'body{font-family:' +
        T.bodyFont +
        ';color:#1f2937;padding:40px;max-width:820px;margin:0 auto;line-height:1.5;}'
      h += 'h1{color:' + T.primary + ';font-size:24pt;margin:0 0 6px;}'
      h +=
        'h2{color:' +
        T.primary +
        ';font-size:14pt;margin:24px 0 10px;border-bottom:2px solid ' +
        T.accent +
        ';padding-bottom:4px;}'
      h += 'p{margin:4px 0;font-size:11pt;}'
      h +=
        '.cover{background:' +
        T.headerBg +
        ';color:' +
        T.headerColor +
        ';padding:30px;border-radius:8px;margin-bottom:20px;}'
      h += '.cover h1{color:#fff;border:none;}'
      h += '.cover .sub{color:#e5e7eb;font-size:11pt;margin-top:6px;}'
      h +=
        '.meta{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:16px;font-size:10pt;}'
      h +=
        '.kpi{background:' +
        T.kpiBg +
        ';border:1px solid ' +
        T.kpiBorder +
        ';border-radius:6px;padding:10px;display:inline-block;margin:6px;text-align:center;min-width:140px;}'
      h += '.kpi b{display:block;font-size:20pt;color:' + T.primary + ';}'
      h += '.kpi .lbl{font-size:9pt;color:#6b7280;}'
      h += 'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10pt;}'
      h +=
        'th{background:' +
        T.tableHeaderBg +
        ';color:' +
        T.primary +
        ';font-weight:bold;text-align:left;padding:6px;border:1px solid #d1d5db;}'
      h += 'td{padding:6px;border:1px solid #e5e7eb;vertical-align:top;}'
      h +=
        '.funnel-item{border-left:3px solid ' +
        T.accent +
        ';padding:6px 10px;margin:6px 0;font-size:10pt;}'
      h += '.action-row{border:1px solid #e5e7eb;border-radius:4px;padding:8px;margin:6px 0;}'
      h +=
        '.action-head{background:' +
        T.tableHeaderBg +
        ';padding:4px 6px;margin:-8px -8px 6px;font-size:9pt;font-weight:bold;color:' +
        T.primary +
        ';}'
      h += '.small{font-size:9pt;color:#6b7280;}'
      h +=
        '.footer{margin-top:30px;border-top:1px solid #e5e7eb;padding-top:10px;text-align:center;color:#9ca3af;font-size:9pt;}'
      h += '@media print{body{padding:20px;}}'
      h += '</style></head><body>'

      // cover
      h += '<div class="cover">'
      h += '<h1>' + esc(titulo) + '</h1>'
      h +=
        '<div class="sub">Blink Biotech • Inteligência Comercial • Relatório ' +
        esc(T.label) +
        '</div>'
      h += '</div>'

      // meta
      h += '<div class="meta">'
      h += '<p><b>Cliente:</b> ' + esc(clientName) + '</p>'
      h += '<p><b>Período:</b> ' + esc(periodoTxt || 'Todo o histórico') + '</p>'
      h += '<p><b>Total de ações registradas:</b> ' + logs.length + '</p>'
      h += '<p><b>Solicitado por:</b> ' + esc(userName || '—') + '</p>'
      h += '<p><b>Gerado em:</b> ' + nowStr + '</p>'
      h += '</div>'

      // 2. Dados do Cliente
      h += '<h2>Dados do Cliente</h2>'
      h += '<p><b>Nome:</b> ' + esc(clientName) + '</p>'
      h += '<p><b>CNPJ:</b> ' + esc(cnpj || '—') + '</p>'
      h += '<p><b>Espécie:</b> ' + esc(species || '—') + '</p>'
      h += '<p><b>Cidade/Estado:</b> ' + esc(cidadeEstado || '—') + '</p>'
      h += '<p><b>Gestor Técnico:</b> ' + esc(gestorTecnicoName) + '</p>'
      h += '<p><b>Vendedor:</b> ' + esc(vendedorName) + '</p>'

      // 3. Status do Funil
      h += '<h2>Status do Funil</h2>'
      h += '<p><b>Status:</b> ' + esc(statusFunil || '—') + '</p>'
      h += '<p><b>Valor Médio:</b> ' + esc(fmtBRL(valorMedio)) + '</p>'
      h += '<p><b>Valor Atual:</b> ' + esc(fmtBRL(valorAtual)) + '</p>'
      h += '<p><b>Último Pedido:</b> ' + esc(fmtDateOnly(ultimoPedidoRaw)) + '</p>'

      // 4. Próximos Passos e Ação
      h += '<h2>Próximos Passos e Ação</h2>'
      h += '<p><b>Próximos Passos:</b> ' + esc(proximosPassos || '—') + '</p>'
      h += '<p><b>Ação:</b> ' + esc(acao || '—') + '</p>'

      // 5. KPIs
      h += '<h2>Indicadores</h2>'
      h += '<div style="margin:10px 0;">'
      h += '<div class="kpi"><b>' + logs.length + '</b><span class="lbl">Ações</span></div>'
      h +=
        '<div class="kpi"><b>' +
        (byTipo['status'] || 0) +
        '</b><span class="lbl">Mudanças de Status</span></div>'
      h +=
        '<div class="kpi"><b>' +
        (byTipo['acao'] || 0) +
        '</b><span class="lbl">Ações Registradas</span></div>'
      h += '</div>'

      // 6. Últimas Atividades do Funil
      h += '<h2>Últimas Atividades do Funil</h2>'
      if (funnelLogs.length === 0) {
        h += '<p><i>Nenhuma atividade de funil registrada para este cliente.</i></p>'
      } else {
        h += '<div>'
        for (var fi = 0; fi < funnelLogs.length; fi++) {
          var fLog = funnelLogs[fi]
          var fActionType = fLog.getString('action_type') || ''
          var fDesc = fLog.getString('description') || ''
          var fOld = fLog.getString('old_value') || ''
          var fNew = fLog.getString('new_value') || ''
          h += '<div class="funnel-item">'
          h +=
            '<b>' +
            esc(funnelIcon(fActionType)) +
            '</b> <span class="small">' +
            esc(fmtDate(fLog.getString('created'))) +
            '</span><br/>' +
            esc(fDesc)
          if (fOld || fNew) {
            h +=
              '<br/><span class="small">Anterior: ' +
              esc(fOld || '—') +
              ' &rarr; Novo: ' +
              esc(fNew || '—') +
              '</span>'
          }
          h += '</div>'
        }
        h += '</div>'
      }

      // 7. Histórico de Ações
      if (logs.length === 0) {
        h += '<p><i>Nenhuma ação registrada para este cliente.</i></p>'
      } else {
        h += '<h2>Histórico de Ações</h2>'
        for (var li = 0; li < logs.length; li++) {
          var log = logs[li]
          var tipo = log.getString('tipo') || 'outro'
          var action = log.getString('action') || ''
          var details = log.getString('details') || ''
          var prox = log.getString('proximo_passo') || ''
          var stOld = log.getString('status_anterior') || ''
          var stNew = log.getString('status_novo') || ''
          h += '<div class="action-row">'
          h +=
            '<div class="action-head">' +
            esc(fmtDate(log.getString('created'))) +
            ' &nbsp; [' +
            esc(tipo) +
            ']</div>'
          h += '<p><b>Ação:</b> ' + esc(action) + '</p>'
          if (details) h += '<p class="small">' + esc(details) + '</p>'
          if (prox) h += '<p class="small"><b>Próximo passo:</b> ' + esc(prox) + '</p>'
          if (stOld || stNew) {
            h +=
              '<p class="small"><b>Status:</b> ' +
              esc(stOld || '—') +
              ' &rarr; ' +
              esc(stNew || '—') +
              '</p>'
          }
          h += '<p class="small"><b>Responsável:</b> ' + esc(userDisplay(log)) + '</p>'
          h += '</div>'
        }
      }

      // footer
      h += '<div class="footer">Blink Biotech — Inteligência Comercial</div>'
      h += '</body></html>'

      return e.html(200, h)
    } catch (err) {
      return e.json(500, { error: 'Erro ao gerar relatório Google Docs.' })
    }
  },
  $apis.requireAuth(),
)
