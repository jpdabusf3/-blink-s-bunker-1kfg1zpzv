routerAdd(
  'POST',
  '/backend/v1/upload-pedido',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}
      var rows = body.rows
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return e.badRequestError('rows array is required')
      }

      function pad(n) {
        return n < 10 ? '0' + n : '' + n
      }

      function parseDate(val) {
        if (val === undefined || val === null || val === '') return ''
        if (typeof val === 'number') {
          if (val > 10000 && val < 90000) {
            var dExcel = new Date(Math.round((val - 25569) * 86400 * 1000))
            if (!isNaN(dExcel.getTime())) {
              return (
                dExcel.getUTCFullYear() +
                '-' +
                pad(dExcel.getUTCMonth() + 1) +
                '-' +
                pad(dExcel.getUTCDate())
              )
            }
          }
        }
        var s = String(val).trim()
        if (!s) return ''
        var isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
        if (isoMatch) {
          return (
            isoMatch[1] +
            '-' +
            pad(parseInt(isoMatch[2], 10)) +
            '-' +
            pad(parseInt(isoMatch[3], 10))
          )
        }
        var ddmmyyyyMatch = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/)
        if (ddmmyyyyMatch) {
          var day = parseInt(ddmmyyyyMatch[1], 10)
          var month = parseInt(ddmmyyyyMatch[2], 10)
          var year = parseInt(ddmmyyyyMatch[3], 10)
          if (year < 100) year += 2000
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return year + '-' + pad(month) + '-' + pad(day)
          }
        }
        var parsed = new Date(s)
        if (!isNaN(parsed.getTime())) {
          return (
            parsed.getFullYear() + '-' + pad(parsed.getMonth() + 1) + '-' + pad(parsed.getDate())
          )
        }
        return ''
      }

      function parseNumber(val) {
        if (typeof val === 'number') return isNaN(val) ? 0 : val
        if (!val) return 0
        var s = String(val).trim()
        if (!s) return 0
        s = s.replace(/(?:R\$|US\$|U\$|\$|BRL|USD)/gi, '').trim()
        s = s.replace(/\s+/g, '')
        if (!s) return 0
        var hasDot = s.indexOf('.') !== -1
        var hasComma = s.indexOf(',') !== -1
        if (hasDot && hasComma) {
          var lastDot = s.lastIndexOf('.')
          var lastComma = s.lastIndexOf(',')
          if (lastComma > lastDot) {
            s = s.replace(/\./g, '').replace(',', '.')
          } else {
            s = s.replace(/,/g, '')
          }
        } else if (hasComma) {
          s = s.replace(',', '.')
        } else if (hasDot) {
          var lastDotIdx = s.lastIndexOf('.')
          var decimals = s.substring(lastDotIdx + 1)
          var intPart = s.substring(0, lastDotIdx)
          if (
            decimals.length === 3 &&
            /^\d{3}$/.test(decimals) &&
            intPart.length >= 1 &&
            intPart.indexOf('.') === -1 &&
            parseFloat(intPart) > 0 &&
            s.indexOf('-') === -1
          ) {
            if ((s.match(/\./g) || []).length > 1) {
              s = s.replace(/\./g, '')
            }
          }
        }
        var cleanNumeric = s.replace(/[^\d.-]/g, '')
        if (!cleanNumeric || cleanNumeric === '-' || cleanNumeric === '.') return 0
        var n = parseFloat(cleanNumeric)
        return isNaN(n) ? 0 : n
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

      function splitFirst(str, sep) {
        if (!str) return ['', '']
        var s = String(str).trim()
        var idx = s.indexOf(sep)
        if (idx === -1) {
          return [s, '']
        }
        return [s.substring(0, idx).trim(), s.substring(idx + sep.length).trim()]
      }

      // Detect if payload is CRM_Faturamento.xlsx
      var firstRow = rows[0] || {}
      var isCrmFaturamento =
        firstRow.cliente_cod_descricao !== undefined ||
        firstRow.item_codigo_descricao !== undefined ||
        firstRow.soma_de_vlr_total_usd !== undefined ||
        firstRow.soma_de_vlr_total_brl !== undefined ||
        firstRow.docdate !== undefined ||
        firstRow.familia_de_produtos !== undefined ||
        firstRow.country !== undefined

      if (isCrmFaturamento) {
        var fatCol = $app.findCollectionByNameOrId('faturamento')
        var totalRows = rows.length
        var importedCount = 0
        var dupCount = 0
        var errorCount = 0
        var fatErrors = []
        var batchDedupeKeys = {}

        for (var i = 0; i < rows.length; i++) {
          var row = rows[i] || {}
          var rowNum = i + 2

          var country = String(row.country || '').trim()
          var rawDocDate = row.docdate || row.data_documento || row.data
          var dataDoc = parseDate(rawDocDate)
          if (!dataDoc) {
            errorCount++
            fatErrors.push({
              linha: rowNum,
              erro: 'docdate inválida ou ausente: ' + String(rawDocDate || ''),
            })
            continue
          }

          var dateObj = new Date(dataDoc + 'T00:00:00Z')
          var ano = dateObj.getUTCFullYear()
          var mes = dateObj.getUTCMonth() + 1
          var semanaIso = getIsoWeek(dateObj)
          var semestre = ano + '-' + (mes <= 6 ? 'S1' : 'S2')

          var nfAno = parseInt(row.nf_ano, 10) || ano
          var nfAnoMes = String(row.nf_ano_mes || '').trim()
          if (!nfAnoMes) {
            nfAnoMes = ano + '.' + pad(mes)
          }

          var cliParts = splitFirst(row.cliente_cod_descricao || row.cliente || '', ' - ')
          var clienteCodigo = cliParts[0] || String(row.cliente_codigo || '').trim()
          var clienteNome = cliParts[1] || String(row.cliente_nome || '').trim()
          if (!clienteNome && cliParts[0]) {
            clienteNome = cliParts[0]
          }

          var itemParts = splitFirst(row.item_codigo_descricao || row.produto || '', ' - ')
          var produtoCodigo = itemParts[0] || String(row.produto_codigo || '').trim()
          var produtoDescricao = itemParts[1] || String(row.produto_descricao || '').trim()
          if (!produtoDescricao && itemParts[0]) {
            produtoDescricao = itemParts[0]
          }

          var rawFamilia = String(row.familia_de_produtos || row.familia_produto || '').trim()
          var familiaProduto =
            typeof familiaCompleta === 'function'
              ? familiaCompleta(produtoCodigo, rawFamilia)
              : rawFamilia || '—'

          var valorUsd = parseNumber(
            row.soma_de_vlr_total_usd !== undefined ? row.soma_de_vlr_total_usd : row.valor_usd,
          )
          var valorBrl = parseNumber(
            row.soma_de_vlr_total_brl !== undefined ? row.soma_de_vlr_total_brl : row.valor_brl,
          )

          // Dedupe por chave única (data_documento + cliente_codigo + produto_codigo + valor_brl)
          var dedupeKey = dataDoc + '__' + clienteCodigo + '__' + produtoCodigo + '__' + valorBrl

          if (batchDedupeKeys[dedupeKey]) {
            dupCount++
            continue
          }
          batchDedupeKeys[dedupeKey] = true

          // Dedupe no banco: pular se já existir linha com a mesma chave (idempotente)
          var filterDedupe =
            "data_documento ~ '" +
            dataDoc +
            "' && cliente_codigo = '" +
            clienteCodigo.replace(/'/g, "\\'") +
            "' && produto_codigo = '" +
            produtoCodigo.replace(/'/g, "\\'") +
            "' && valor_brl = " +
            valorBrl

          var alreadyExists = null
          try {
            alreadyExists = $app.findFirstRecordByFilter('faturamento', filterDedupe)
          } catch (_) {}

          if (alreadyExists) {
            dupCount++
            continue
          }

          try {
            var recFat = new Record(fatCol)
            recFat.set('country', country)
            recFat.set('nf_ano', nfAno)
            recFat.set('nf_ano_mes', nfAnoMes)
            recFat.set('cliente_codigo', clienteCodigo)
            recFat.set('cliente_nome', clienteNome)
            recFat.set('familia_produto', familiaProduto)
            recFat.set('data_documento', dataDoc + ' 00:00:00.000Z')
            recFat.set('produto_codigo', produtoCodigo)
            recFat.set('produto_descricao', produtoDescricao)
            recFat.set('valor_usd', valorUsd)
            recFat.set('valor_brl', valorBrl)
            recFat.set('semana_iso', semanaIso)
            recFat.set('mes', mes)
            recFat.set('ano', ano)
            recFat.set('semestre', semestre)
            recFat.set('user_id', userId)

            $app.save(recFat)
            importedCount++
          } catch (fatSaveErr) {
            errorCount++
            fatErrors.push({
              linha: rowNum,
              erro: 'Erro ao salvar faturamento: ' + String(fatSaveErr).substring(0, 120),
            })
          }
        }

        $app
          .logger()
          .info(
            'upload-pedido (CRM_Faturamento)',
            'total',
            totalRows,
            'importados',
            importedCount,
            'duplicatas',
            dupCount,
            'erros',
            errorCount,
          )

        return e.json(200, {
          success: true,
          total: totalRows,
          total_linhas: totalRows,
          importados: importedCount,
          duplicatas_ignoradas: dupCount,
          duplicadas: dupCount,
          erros_count: errorCount,
          erros: fatErrors,
        })
      }

      // Legacy fallback: import into historico_vendas
      var VALID_ESPECIES = ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA', 'OUTRO']
      var VALID_CANAIS = [
        'Direto',
        'Distribuidor',
        'Indústria',
        'Premixera',
        'Cooperativa',
        'Online',
      ]

      var col = $app.findCollectionByNameOrId('historico_vendas')
      var imported = 0
      var errors = []
      var now = new Date().toISOString()

      for (var j = 0; j < rows.length; j++) {
        var legacyRow = rows[j]
        var legacyRowNum = j + 2
        var data = parseDate(legacyRow.data)
        var cliente = String(legacyRow.cliente || '').trim()
        var especie = String(legacyRow.especie || '')
          .trim()
          .toUpperCase()
        var gestorNome = String(legacyRow.gestor_tecnico || '').trim()
        var vendedorNome = String(legacyRow.vendedor || '').trim()
        var canalVendas = String(legacyRow.canal_vendas || '').trim()
        var valor = parseNumber(legacyRow.valor)
        var observacoes = String(legacyRow.observacoes || '').trim()

        if (!data) {
          errors.push({ linha: legacyRowNum, erro: 'data inválida ou ausente' })
          continue
        }
        if (!cliente) {
          errors.push({ linha: legacyRowNum, erro: 'cliente é obrigatório' })
          continue
        }
        if (VALID_ESPECIES.indexOf(especie) === -1) {
          errors.push({
            linha: legacyRowNum,
            erro: 'especie inválida: ' + especie + '. Valores: ' + VALID_ESPECIES.join(', '),
          })
          continue
        }
        if (!valor || valor <= 0) {
          errors.push({ linha: legacyRowNum, erro: 'valor deve ser numérico e maior que zero' })
          continue
        }

        var gestorId = ''
        if (gestorNome) {
          try {
            gestorId = $app.findFirstRecordByFilter(
              'gestao_tecnica',
              "nome = '" + gestorNome.replace(/'/g, "\\'") + "' && funcao = 'gestor_tecnico'",
            ).id
          } catch (_) {
            errors.push({
              linha: legacyRowNum,
              erro: 'gestor_tecnico não encontrado: ' + gestorNome,
            })
            continue
          }
        }

        var vendedorId = ''
        if (vendedorNome) {
          try {
            vendedorId = $app.findFirstRecordByFilter(
              'gestao_tecnica',
              "nome = '" + vendedorNome.replace(/'/g, "\\'") + "' && funcao = 'vendedor'",
            ).id
          } catch (_) {
            errors.push({ linha: legacyRowNum, erro: 'vendedor não encontrado: ' + vendedorNome })
            continue
          }
        }

        if (canalVendas && VALID_CANAIS.indexOf(canalVendas) === -1) {
          errors.push({
            linha: legacyRowNum,
            erro: 'canal_vendas inválido: ' + canalVendas + '. Valores: ' + VALID_CANAIS.join(', '),
          })
          continue
        }

        var existing = null
        try {
          existing = $app.findFirstRecordByFilter(
            'historico_vendas',
            "data = '" +
              data +
              "' && cliente = '" +
              cliente.replace(/'/g, "\\'") +
              "' && valor = " +
              valor,
          )
        } catch (_) {}

        try {
          var rec
          if (existing) {
            rec = $app.findRecordById('historico_vendas', existing.id)
          } else {
            rec = new Record(col)
          }
          rec.set('data', data)
          rec.set('cliente', cliente)
          rec.set('especie', especie)
          if (gestorId) rec.set('gestor_tecnico_id', gestorId)
          if (vendedorId) rec.set('vendedor_id', vendedorId)
          if (canalVendas) rec.set('canal_vendas', canalVendas)
          rec.set('valor', valor)
          if (observacoes) rec.set('observacoes', observacoes)
          rec.set('origem', 'upload')
          rec.set('atualizado_em', now)
          $app.save(rec)
          imported++
        } catch (saveErr) {
          errors.push({
            linha: legacyRowNum,
            erro: 'erro ao salvar: ' + String(saveErr).substring(0, 120),
          })
        }
      }

      return e.json(200, {
        success: true,
        importados: imported,
        erros: errors,
        total: rows.length,
      })
    } catch (err) {
      $app.logger().error('upload-pedido: error', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
