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
        updated = 0,
        duplicatas = 0
      var errors = []

      function normalizeKey(str) {
        if (!str) return ''
        return String(str)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      }

      function canonicalEspecie(raw) {
        if (!raw) return null
        var norm = String(raw)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase()
        if (norm === 'aves' || norm === 'ave') return 'Aves'
        if (norm === 'suinos' || norm === 'suino') return 'Suinos'
        if (norm === 'ruminantes' || norm === 'ruminante') return 'Ruminantes'
        if (norm === 'pet' || norm === 'pets') return 'Pet'
        if (norm === 'multiespecies' || norm === 'multiespecie') return 'Multiespécies'
        return null
      }

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || {}
        var rowNum = i + 2

        // Build normalized lookup for row keys
        var normRow = {}
        var rowKeys = Object.keys(row)
        for (var k = 0; k < rowKeys.length; k++) {
          var origKey = rowKeys[k]
          var nk = normalizeKey(origKey)
          if (nk && normRow[nk] === undefined) {
            normRow[nk] = row[origKey]
          }
        }

        function getVal() {
          for (var a = 0; a < arguments.length; a++) {
            var rawArg = arguments[a]
            if (
              row[rawArg] !== undefined &&
              row[rawArg] !== null &&
              String(row[rawArg]).trim() !== ''
            ) {
              return row[rawArg]
            }
            var nArg = normalizeKey(rawArg)
            if (
              normRow[nArg] !== undefined &&
              normRow[nArg] !== null &&
              String(normRow[nArg]).trim() !== ''
            ) {
              return normRow[nArg]
            }
          }
          return ''
        }

        var nome = String(getVal('nome', 'name')).trim()
        var tipo = String(getVal('tipo', 'type')).trim().toLowerCase()
        var cnpjRaw = getVal('cnpj', 'CNPJ')
        var cnpj = cleanCnpj(cnpjRaw)
        var cidade = String(getVal('cidade', 'city')).trim()
        var estado = String(getVal('estado', 'state', 'uf')).trim()
        var telefone = String(getVal('contato', 'telefone', 'phone')).trim()
        var email = String(getVal('email')).trim()
        var etapaFunil = String(getVal('funil', 'etapa_funil', 'funnelStage', 'etapafunil')).trim()
        var valorPotencial = parseNumber(
          getVal('valor', 'valor_potencial', 'potentialValue', 'valorpotencial'),
        )
        var observacoes = String(getVal('observacoes', 'notes')).trim()
        var carteira = String(getVal('carteira')).trim()
        var grupoCliente = String(getVal('grupo_cliente', 'grupoCliente', 'grupocliente')).trim()
        var especieRaw = String(getVal('especie', 'Espécie', 'animalSpecies')).trim()
        var statusContato = String(
          getVal('status_contato', 'StatusContato', 'statuscontato'),
        ).trim()
        var gestorNome = String(getVal('gestor', 'gestor_tecnico', 'gestortecnico')).trim()
        var vendedorNome = String(getVal('vendedor', 'Vendedor')).trim()

        var especie = ''
        if (especieRaw) {
          var canon = canonicalEspecie(especieRaw)
          if (!canon) {
            errors.push({
              linha: rowNum,
              erro:
                'espécie inválida: ' +
                especieRaw +
                ' (aceitos: Aves, Suinos, Ruminantes, Pet, Multiespécies)',
            })
            continue
          }
          especie = canon
        }

        if (!nome) {
          errors.push({ linha: rowNum, erro: 'nome é obrigatório' })
          continue
        }
        // tipo defaults to "cliente" when omitted (template doesn't require it)
        if (!tipo) tipo = 'cliente'
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

        // duplicate (same CNPJ or name) -> skip, do not overwrite
        if (existing) {
          duplicatas++
          continue
        }

        try {
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
          if (especie) newRec.set('animalSpecies', especie)
          if (statusContato) newRec.set('status_contato', statusContato)
          if (telefone) newRec.set('contato', telefone)

          if (gestorNome) {
            try {
              var gtNew = $app.findFirstRecordByFilter(
                'gestao_tecnica',
                "nome = '" + gestorNome.replace(/'/g, "\\'") + "' && funcao = 'gestor_tecnico'",
              )
              newRec.set('gestor_tecnico_id', gtNew.id)
            } catch (_) {}
          }
          if (vendedorNome) {
            try {
              var vdNew = $app.findFirstRecordByFilter(
                'gestao_tecnica',
                "nome = '" + vendedorNome.replace(/'/g, "\\'") + "' && funcao = 'vendedor'",
              )
              newRec.set('vendedor_id', vdNew.id)
            } catch (_) {}
          }

          newRec.set('ultima_edicao_origem', 'excel')
          $app.save(newRec)
          created++
        } catch (saveErr) {
          errors.push({ linha: rowNum, erro: 'erro ao salvar: ' + String(saveErr) })
        }
      }

      return e.json(200, {
        success: true,
        criados: created,
        atualizados: updated,
        duplicatas: duplicatas,
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
