// AI-powered parsing of a nota fiscal PDF (text extracted client-side via pdf.js)
// plus an optional Excel model rows payload. Creates historico_vendas records
// and triggers automatic recalculation of metas.valor_realizado (via the
// existing on_vendas_create_recalc_metas hook).
routerAdd(
  'POST',
  '/backend/v1/processar-pedido-pdf',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}
      var pdfText = body.pdfText || ''
      var excelRows = body.rows || []

      if (!pdfText && (!excelRows || !excelRows.length)) {
        return e.badRequestError('pdfText or rows is required')
      }

      var VALID_ESPECIES = ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA', 'OUTRO']
      var VALID_CANAIS = [
        'Direto',
        'Distribuidor',
        'Indústria',
        'Premixera',
        'Cooperativa',
        'Online',
      ]

      function parseNumber(v) {
        if (typeof v === 'number') return v
        if (!v) return 0
        var s = String(v).trim()
        if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1)
          s = s.replace(/\./g, '').replace(',', '.')
        else if (s.indexOf(',') !== -1) s = s.replace(',', '.')
        return parseFloat(s.replace(/[^\d.-]/g, '')) || 0
      }

      function pad(n) {
        return n < 10 ? '0' + n : '' + n
      }

      function parseDate(val) {
        if (!val) return ''
        if (typeof val === 'number') {
          var d = new Date(Math.round((val - 25569) * 86400 * 1000))
          if (isNaN(d.getTime())) return ''
          return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
        }
        var s = String(val).trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
        var parts = s.split('/')
        if (parts.length === 3) {
          return parts[2] + '-' + pad(parseInt(parts[1], 10)) + '-' + pad(parseInt(parts[0], 10))
        }
        var parsed = new Date(s)
        if (!isNaN(parsed.getTime())) {
          return (
            parsed.getFullYear() + '-' + pad(parsed.getMonth() + 1) + '-' + pad(parsed.getDate())
          )
        }
        return ''
      }

      // If pdfText provided, ask the AI to extract pedido data from it.
      var aiExtracted = null
      if (pdfText) {
        var prompt =
          'Você é um assistente de CRM da Blink Biotech (nutrição animal). ' +
          'Analise o texto extraído de uma Nota Fiscal (PDF) e extraia TODOS os ' +
          'pedidos/produtos contidos nela. Não invente dados. Se um campo não ' +
          'estiver presente, use null. Retorne SOMENTE um JSON válido.\n\n' +
          'SCHEMA de saída (objeto com a chave "pedidos" contendo um array):\n' +
          '{\n' +
          '  "pedidos": [\n' +
          '    {\n' +
          '      "data": "AAAA-MM-DD" (data de emissão da NF),\n' +
          '      "cliente": "nome/razão social do cliente",\n' +
          '      "especie": "BOVINO|SUINO|AVE|PET|AQUA|OUTRO|null",\n' +
          '      "canal_vendas": "Direto|Distribuidor|Indústria|Premixera|Cooperativa|Online|null",\n' +
          '      "valor": número (valor total em reais),\n' +
          '      "linhas_portfolio": ["produto 1","produto 2"],\n' +
          '      "observacoes": "texto livre"\n' +
          '    }\n' +
          '  ],\n' +
          '  "campos_ausentes": ["lista de campos esperados que não puderam ser extraídos"]\n' +
          '}\n\n' +
          'TEXTO DA NOTA FISCAL (PDF):\n' +
          pdfText.substring(0, 12000)

        try {
          var aiReply = $ai.chat({
            model: 'fast',
            messages: [
              {
                role: 'system',
                content:
                  'Setor: nutrição animal e biotech. Extração estruturada de notas fiscais. ' +
                  'Retorne apenas JSON válido, sem texto adicional.',
              },
              { role: 'user', content: prompt },
            ],
          })
          var rawContent = ''
          try {
            rawContent = aiReply.choices[0].message.content || ''
          } catch (_) {}

          if (rawContent) {
            var jsonStr = rawContent.trim()
            var firstBrace = jsonStr.indexOf('{')
            var lastBrace = jsonStr.lastIndexOf('}')
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
            }
            aiExtracted = JSON.parse(jsonStr)
          }
        } catch (aiErr) {
          $app.logger().error('processar-pedido-pdf: AI error', 'error', String(aiErr))
        }
      }

      var col = $app.findCollectionByNameOrId('historico_vendas')
      var now = new Date().toISOString()
      var imported = 0
      var errors = []
      var camposAusentes = []

      // Collect candidate pedido records to create.
      var candidates = []

      if (aiExtracted && Array.isArray(aiExtracted.pedidos)) {
        if (Array.isArray(aiExtracted.campos_ausentes)) {
          camposAusentes = aiExtracted.campos_ausentes
        }
        for (var k = 0; k < aiExtracted.pedidos.length; k++) {
          var p = aiExtracted.pedidos[k]
          candidates.push({
            data: parseDate(p.data),
            cliente: p.cliente ? String(p.cliente).trim() : '',
            especie: p.especie ? String(p.especie).trim().toUpperCase() : '',
            canal_vendas: p.canal_vendas ? String(p.canal_vendas).trim() : '',
            valor: parseNumber(p.valor),
            observacoes: p.observacoes ? String(p.observacoes) : '',
            linhas_portfolio: Array.isArray(p.linhas_portfolio)
              ? p.linhas_portfolio.join('; ')
              : '',
            origem: 'upload',
          })
        }
      }

      // Merge explicit Excel rows (these take precedence / fill missing data).
      if (excelRows && excelRows.length) {
        for (var i = 0; i < excelRows.length; i++) {
          var row = excelRows[i]
          candidates.push({
            data: parseDate(row.data),
            cliente: String(row.cliente || '').trim(),
            especie: String(row.especie || '')
              .trim()
              .toUpperCase(),
            canal_vendas: String(row.canal_vendas || '').trim(),
            valor: parseNumber(row.valor),
            observacoes: String(row.observacoes || '').trim(),
            linhas_portfolio: String(row.linhas_portfolio || '').trim(),
            gestorNome: String(row.gestor_tecnico || '').trim(),
            vendedorNome: String(row.vendedor || '').trim(),
            origem: 'upload',
          })
        }
      }

      for (var c = 0; c < candidates.length; c++) {
        var cand = candidates[c]
        var rowNum = c + 1

        if (!cand.data) {
          errors.push({ linha: rowNum, erro: 'data inválida ou ausente' })
          continue
        }
        if (!cand.cliente) {
          errors.push({ linha: rowNum, erro: 'cliente é obrigatório' })
          continue
        }
        if (cand.especie && VALID_ESPECIES.indexOf(cand.especie) === -1) {
          errors.push({
            linha: rowNum,
            erro: 'especie inválida: ' + cand.especie,
          })
          continue
        }
        if (!cand.valor || cand.valor <= 0) {
          errors.push({ linha: rowNum, erro: 'valor deve ser maior que zero' })
          continue
        }
        if (cand.canal_vendas && VALID_CANAIS.indexOf(cand.canal_vendas) === -1) {
          errors.push({ linha: rowNum, erro: 'canal_vendas inválido: ' + cand.canal_vendas })
          continue
        }

        // Resolve gestor_tecnico / vendedor by name when available.
        var gestorId = ''
        if (cand.gestorNome) {
          try {
            gestorId = $app.findFirstRecordByFilter(
              'gestao_tecnica',
              "nome = '" + cand.gestorNome.replace(/'/g, "\\'") + "'",
            ).id
          } catch (_) {
            errors.push({
              linha: rowNum,
              erro: 'gestor_tecnico não encontrado: ' + cand.gestorNome,
            })
            continue
          }
        }
        var vendedorId = ''
        if (cand.vendedorNome) {
          try {
            vendedorId = $app.findFirstRecordByFilter(
              'gestao_tecnica',
              "nome = '" + cand.vendedorNome.replace(/'/g, "\\'") + "'",
            ).id
          } catch (_) {
            errors.push({ linha: rowNum, erro: 'vendedor não encontrado: ' + cand.vendedorNome })
            continue
          }
        }

        // If no gestor/vendedor given explicitly, try to resolve from a
        // matching factory by name (factories.vendedor_id / gestor_tecnico_id).
        if (!vendedorId || !gestorId) {
          try {
            var factory = $app.findFirstRecordByFilter(
              'factories',
              "name = '" + cand.cliente.replace(/'/g, "\\'") + "'",
            )
            if (!vendedorId) {
              vendedorId = factory.getString('vendedor_id') || ''
            }
            if (!gestorId) {
              gestorId = factory.getString('gestor_tecnico_id') || ''
            }
            // Update factory's ultimo_pedido.
            factory.set('ultimo_pedido', cand.data)
            $app.save(factory)
          } catch (_) {}
        }

        var obs = cand.observacoes
        if (cand.linhas_portfolio) {
          obs = (obs ? obs + ' | ' : '') + 'Linhas portfólio: ' + cand.linhas_portfolio
        }

        try {
          var rec = new Record(col)
          rec.set('data', cand.data)
          rec.set('cliente', cand.cliente)
          if (cand.especie) rec.set('especie', cand.especie)
          if (gestorId) rec.set('gestor_tecnico_id', gestorId)
          if (vendedorId) rec.set('vendedor_id', vendedorId)
          if (cand.canal_vendas) rec.set('canal_vendas', cand.canal_vendas)
          rec.set('valor', cand.valor)
          if (obs) rec.set('observacoes', obs)
          rec.set('origem', 'upload')
          rec.set('atualizado_em', now)
          $app.save(rec)
          imported++
        } catch (saveErr) {
          errors.push({
            linha: rowNum,
            erro: 'erro ao salvar: ' + String(saveErr).substring(0, 120),
          })
        }
      }

      // Log activity
      try {
        var logCol = $app.findCollectionByNameOrId('activity_logs')
        var logRec = new Record(logCol)
        logRec.set('user', userId)
        logRec.set('action', 'implantacao_pedido')
        logRec.set('details', 'Importados: ' + imported + ' | Erros: ' + errors.length)
        $app.save(logRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        importados: imported,
        erros: errors,
        total: candidates.length,
        campos_ausentes: camposAusentes,
      })
    } catch (err) {
      $app.logger().error('processar-pedido-pdf: error', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
