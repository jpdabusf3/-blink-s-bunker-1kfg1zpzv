routerAdd(
  'POST',
  '/backend/v1/importar-excel',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}
      var rows = body.rows
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return e.badRequestError('rows array is required')
      }

      function cleanCnpj(c) {
        return String(c || '').replace(/\D/g, '')
      }

      function validateCnpj(cnpj) {
        cnpj = cleanCnpj(cnpj)
        if (cnpj.length !== 14) return false
        if (/^(\d)\1+$/.test(cnpj)) return false
        var calc = function (len, weights) {
          var sum = 0
          for (var i = 0; i < len; i++) sum += parseInt(cnpj[i]) * weights[i]
          var rest = sum % 11
          return rest < 2 ? 0 : 11 - rest
        }
        var w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        var w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        return parseInt(cnpj[12]) === calc(12, w1) && parseInt(cnpj[13]) === calc(13, w2)
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

      var VALID_STAGES = [
        'prospeccao',
        'qualificacao',
        'proposta',
        'fechamento',
        'pos_venda',
        'pos-venda',
        'lead',
        'primeiro contato',
        'diagnostico tecnico',
        'apresentacao',
        'teste/trial',
        'negociacao',
        'perda',
      ]

      var factoriesCol = $app.findCollectionByNameOrId('factories')
      var created = 0,
        updated = 0
      var errors = []

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i]
        var rowNum = i + 2
        var nome = String(row.nome || row.name || '').trim()
        var tipo = String(row.tipo || '')
          .trim()
          .toLowerCase()
        var cnpj = cleanCnpj(row.cnpj)
        var cidade = String(row.cidade || row.city || '').trim()
        var estado = String(row.estado || row.state || '').trim()
        var telefone = String(row.telefone || row.phone || '').trim()
        var email = String(row.email || '').trim()
        var etapaFunil = String(row.etapa_funil || row.funnelStage || '').trim()
        var valorPotencial = parseNumber(row.valor_potencial || row.potentialValue)
        var observacoes = String(row.observacoes || row.notes || '').trim()
        var carteira = String(row.carteira || '').trim()
        var grupoCliente = String(row.grupo_cliente || row.grupoCliente || '').trim()

        if (!nome) {
          errors.push({ linha: rowNum, erro: 'nome é obrigatório' })
          continue
        }
        if (tipo !== 'cliente' && tipo !== 'prospecto') {
          errors.push({ linha: rowNum, erro: 'tipo deve ser "cliente" ou "prospecto"' })
          continue
        }
        if (cnpj && !validateCnpj(cnpj)) {
          errors.push({ linha: rowNum, erro: 'CNPJ inválido: ' + (row.cnpj || '') })
          continue
        }
        if (etapaFunil && VALID_STAGES.indexOf(etapaFunil.toLowerCase()) === -1) {
          errors.push({ linha: rowNum, erro: 'etapa_funil inválida: ' + etapaFunil })
          continue
        }
        var VALID_CARTEIRAS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']
        if (carteira && VALID_CARTEIRAS.indexOf(carteira.toUpperCase()) === -1) {
          errors.push({ linha: rowNum, erro: 'carteira inválida: ' + carteira })
          continue
        }

        var existing = null
        if (cnpj) {
          try {
            existing = $app.findFirstRecordByData('factories', 'cnpj', cnpj)
          } catch (_) {}
        }
        if (!existing) {
          try {
            existing = $app.findFirstRecordByData('factories', 'name', nome)
          } catch (_) {}
        }

        try {
          if (existing) {
            var rec = $app.findRecordById('factories', existing.id)
            rec.set('name', nome)
            if (cnpj) rec.set('cnpj', cnpj)
            rec.set('tipo', tipo === 'cliente' ? 'Cliente' : 'Prospecto')
            if (cidade) rec.set('city', cidade)
            if (estado) rec.set('state', estado)
            if (telefone) rec.set('contactPhone', telefone)
            if (email) rec.set('contact_email', email)
            if (etapaFunil) rec.set('funnelStage', etapaFunil)
            if (valorPotencial) rec.set('potentialValue', valorPotencial)
            if (observacoes) rec.set('notes', observacoes)
            if (carteira) rec.set('carteira', carteira.toUpperCase())
            if (grupoCliente) rec.set('grupo_cliente', grupoCliente)
            rec.set('ultima_edicao_origem', 'excel')
            $app.save(rec)
            updated++
          } else {
            var newRec = new Record(factoriesCol)
            newRec.set('name', nome)
            if (cnpj) newRec.set('cnpj', cnpj)
            newRec.set('tipo', tipo === 'cliente' ? 'Cliente' : 'Prospecto')
            if (cidade) newRec.set('city', cidade)
            if (estado) newRec.set('state', estado)
            if (telefone) newRec.set('contactPhone', telefone)
            if (email) newRec.set('contact_email', email)
            if (tipo === 'prospecto') {
              newRec.set('funnelStage', 'prospeccao')
            } else {
              newRec.set('funnelStage', etapaFunil || 'Lead')
            }
            if (valorPotencial) newRec.set('potentialValue', valorPotencial)
            if (observacoes) newRec.set('notes', observacoes)
            if (carteira) newRec.set('carteira', carteira.toUpperCase())
            if (grupoCliente) newRec.set('grupo_cliente', grupoCliente)
            newRec.set('ultima_edicao_origem', 'excel')
            $app.save(newRec)
            created++
          }
        } catch (saveErr) {
          errors.push({ linha: rowNum, erro: 'erro ao salvar: ' + String(saveErr) })
        }
      }

      return e.json(200, {
        success: true,
        criados: created,
        atualizados: updated,
        erros: errors,
        total: rows.length,
      })
    } catch (err) {
      $app.logger().error('importar-excel: error', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
