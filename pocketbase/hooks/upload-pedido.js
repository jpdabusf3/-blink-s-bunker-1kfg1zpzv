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

      var VALID_ESPECIES = ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA', 'OUTRO']
      var VALID_CANAIS = [
        'Direto',
        'Distribuidor',
        'Indústria',
        'Premixera',
        'Cooperativa',
        'Online',
      ]

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

      function parseNumber(val) {
        if (typeof val === 'number') return val
        if (!val) return 0
        var s = String(val).trim()
        if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1)
          s = s.replace(/\./g, '').replace(',', '.')
        else if (s.indexOf(',') !== -1) s = s.replace(',', '.')
        return parseFloat(s.replace(/[^\d.-]/g, '')) || 0
      }

      var col = $app.findCollectionByNameOrId('historico_vendas')
      var imported = 0
      var errors = []
      var now = new Date().toISOString()

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i]
        var rowNum = i + 2
        var data = parseDate(row.data)
        var cliente = String(row.cliente || '').trim()
        var especie = String(row.especie || '')
          .trim()
          .toUpperCase()
        var gestorNome = String(row.gestor_tecnico || '').trim()
        var vendedorNome = String(row.vendedor || '').trim()
        var canalVendas = String(row.canal_vendas || '').trim()
        var valor = parseNumber(row.valor)
        var observacoes = String(row.observacoes || '').trim()

        if (!data) {
          errors.push({ linha: rowNum, erro: 'data inválida ou ausente' })
          continue
        }
        if (!cliente) {
          errors.push({ linha: rowNum, erro: 'cliente é obrigatório' })
          continue
        }
        if (VALID_ESPECIES.indexOf(especie) === -1) {
          errors.push({
            linha: rowNum,
            erro: 'especie inválida: ' + especie + '. Valores: ' + VALID_ESPECIES.join(', '),
          })
          continue
        }
        if (!valor || valor <= 0) {
          errors.push({ linha: rowNum, erro: 'valor deve ser numérico e maior que zero' })
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
            errors.push({ linha: rowNum, erro: 'gestor_tecnico não encontrado: ' + gestorNome })
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
            errors.push({ linha: rowNum, erro: 'vendedor não encontrado: ' + vendedorNome })
            continue
          }
        }

        if (canalVendas && VALID_CANAIS.indexOf(canalVendas) === -1) {
          errors.push({
            linha: rowNum,
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
            linha: rowNum,
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
