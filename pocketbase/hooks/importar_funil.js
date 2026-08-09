routerAdd(
  'POST',
  '/backend/v1/importar-funil',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}
      var rows = body.rows
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return e.badRequestError('rows array is required')
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
        if (parts.length === 3)
          return parts[2] + '-' + pad(parseInt(parts[1], 10)) + '-' + pad(parseInt(parts[0], 10))
        var parsed = new Date(s)
        if (!isNaN(parsed.getTime()))
          return (
            parsed.getFullYear() + '-' + pad(parsed.getMonth() + 1) + '-' + pad(parsed.getDate())
          )
        return ''
      }

      function mapEspecie(val) {
        var s = String(val || '')
          .trim()
          .toLowerCase()
        if (!s) return ''
        if (s === 'pet') return 'Pet'
        if (s === 'aves' || s === 'ave') return 'Aves'
        if (s.indexOf('suin') !== -1) return 'Suinos'
        if (s.indexOf('bovin') !== -1 || s.indexOf('rumin') !== -1) return 'Ruminantes'
        if (s === 'aqua' || s.indexOf('pisci') !== -1) return 'Aqua'
        if (s.indexOf('equin') !== -1) return 'Equinos'
        return 'Outros'
      }

      function getField(row, names) {
        for (var i = 0; i < names.length; i++) {
          var v = row[names[i]]
          if (v !== undefined && v !== null && String(v).trim() !== '') return v
        }
        return ''
      }

      function rowHasData(row) {
        return !!(
          getField(row, ['Valor M\u00e9dio', 'Valor Medio']) ||
          getField(row, ['Status do Funil', 'Status']) ||
          getField(row, ['Valor Atual', 'Valor Actual']) ||
          getField(row, ['Pr\u00f3ximos Passos', 'Proximos Passos']) ||
          getField(row, ['A\u00e7\u00e3o', 'Acao']) ||
          getField(row, ['Data do \u00daltimo Pedido', 'Data do Ultimo Pedido']) ||
          getField(row, ['Vendedor']) ||
          getField(row, ['Esp\u00e9cie', 'Especie'])
        )
      }

      var clientMap = {}
      var descartados = 0

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i]
        var cliente = String(getField(row, ['Cliente', 'cliente', 'CLIENTE'])).trim()
        if (!cliente) {
          descartados++
          continue
        }
        var dataPresent = rowHasData(row)
        if (clientMap[cliente]) {
          if (!clientMap[cliente].hasData && dataPresent) {
            clientMap[cliente] = { row: row, hasData: true }
          }
          descartados++
        } else {
          clientMap[cliente] = { row: row, hasData: dataPresent }
        }
      }

      var existingMap = {}
      try {
        var existingRecords = $app.findRecordsByFilter('factories', 'id != ""', 'name', 100000, 0)
        for (var k = 0; k < existingRecords.length; k++) {
          existingMap[existingRecords[k].getString('name')] = existingRecords[k].id
        }
      } catch (_) {}

      var vendedorMap = {}
      try {
        var vendedores = $app.findRecordsByFilter(
          'gestao_tecnica',
          "funcao = 'vendedor'",
          'nome',
          100000,
          0,
        )
        for (var m = 0; m < vendedores.length; m++) {
          vendedorMap[vendedores[m].getString('nome').toLowerCase()] = vendedores[m].id
        }
      } catch (_) {}

      var factoriesCol = $app.findCollectionByNameOrId('factories')
      var created = 0,
        updated = 0
      var errors = []
      var importDate = '2026-08-08'

      var clientes = Object.keys(clientMap)
      for (var j = 0; j < clientes.length; j++) {
        var nome = clientes[j]
        var data = clientMap[nome].row

        var valorMedio = parseNumber(getField(data, ['Valor M\u00e9dio', 'Valor Medio']))
        var valorAtual = parseNumber(getField(data, ['Valor Atual', 'Valor Actual']))
        var statusFunilRaw = String(getField(data, ['Status do Funil', 'Status'])).trim()
        var ultimoPedido = parseDate(
          getField(data, ['Data do \u00daltimo Pedido', 'Data do Ultimo Pedido']),
        )
        var proximosPassos = String(
          getField(data, ['Pr\u00f3ximos Passos', 'Proximos Passos']),
        ).trim()
        var acao = String(getField(data, ['A\u00e7\u00e3o', 'Acao'])).trim()
        var vendedorNome = String(getField(data, ['Vendedor'])).trim()
        var especie = mapEspecie(getField(data, ['Esp\u00e9cie', 'Especie']))

        var statusFunil = ''
        if (statusFunilRaw) {
          var ls = statusFunilRaw.toLowerCase()
          if (ls === 'inativo') statusFunil = 'Inativo'
          else if (ls === 'mensal') statusFunil = 'Mensal'
          else if (ls === 'ativo') statusFunil = 'Ativo'
        }

        var vendedorId = vendedorNome ? vendedorMap[vendedorNome.toLowerCase()] || '' : ''
        var existingId = existingMap[nome] || ''

        try {
          var rec
          if (existingId) {
            rec = $app.findRecordById('factories', existingId)
          } else {
            rec = new Record(factoriesCol)
            rec.set('name', nome)
            rec.set('tipo', 'Cliente')
          }
          rec.set('valor_medio', valorMedio)
          rec.set('valor_atual', valorAtual)
          if (statusFunil) rec.set('status_funil', statusFunil)
          if (ultimoPedido) rec.set('ultimo_pedido', ultimoPedido)
          rec.set('proximos_passos', proximosPassos)
          rec.set('acao', acao)
          if (especie) rec.set('animalSpecies', especie)
          if (vendedorId) rec.set('vendedor_id', vendedorId)
          rec.set('ultima_edicao_origem', 'excel')
          rec.set('data_importacao', importDate)
          $app.save(rec)
          if (existingId) updated++
          else created++
          existingMap[nome] = rec.id
        } catch (saveErr) {
          errors.push({ cliente: nome, erro: String(saveErr).substring(0, 120) })
        }
      }

      return e.json(200, {
        success: true,
        criados: created,
        atualizados: updated,
        descartados: descartados,
        erros: errors,
        total: rows.length,
      })
    } catch (err) {
      $app.logger().error('importar-funil: error', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
