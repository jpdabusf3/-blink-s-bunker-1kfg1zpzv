routerAdd(
  'POST',
  '/backend/v1/gravar-atividade',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}

      if (body.precisa_confirmacao === true) {
        return e.json(200, {
          success: false,
          precisa_confirmacao: true,
          message: 'Confirmation required before saving',
        })
      }

      var cliente = body.cliente || {}
      var clienteNome = cliente.nome || ''
      var clienteCnpj = cliente.cnpj || ''
      var clienteCidade = cliente.cidade || ''
      var clienteEstado = cliente.estado || ''
      var vendedorNome = body.vendedor || ''
      var tipoAtividade = body.tipo_atividade || ''
      var etapaFunil = body.etapa_funil || ''
      var valorEstimado = typeof body.valor_estimado === 'number' ? body.valor_estimado : 0
      var descricao = body.descricao || ''
      var proximoPasso = body.proximo_passo || ''
      var dataProximaAcao = body.data_proxima_acao || ''
      var pendencias = body.pendencias
      var observacoes = body.observacoes || ''
      var confianca = typeof body.confianca === 'number' ? body.confianca : 0
      var audioTranscrito = body.audio_transcrito || ''

      if (!clienteNome && !clienteCnpj) {
        return e.badRequestError('cliente.nome or cliente.cnpj is required')
      }
      if (!vendedorNome) {
        return e.badRequestError('vendedor is required')
      }
      if (!tipoAtividade) {
        return e.badRequestError('tipo_atividade is required')
      }

      if (Array.isArray(pendencias)) {
        pendencias = pendencias.join('; ')
      } else if (pendencias == null) {
        pendencias = ''
      } else {
        pendencias = String(pendencias)
      }

      if (observacoes) {
        if (descricao) {
          descricao = descricao + ' | Observações: ' + observacoes
        } else {
          descricao = 'Observações: ' + observacoes
        }
      }

      var tipoAtividadeLower = String(tipoAtividade).toLowerCase().trim()
      var validTipos = ['visita', 'ligacao', 'proposta', 'follow_up', 'reuniao']
      if (validTipos.indexOf(tipoAtividadeLower) === -1) {
        tipoAtividadeLower = 'follow_up'
      }

      var factoriesCol, atividadesCol, metasCol

      try {
        factoriesCol = $app.findCollectionByNameOrId('factories')
        atividadesCol = $app.findCollectionByNameOrId('atividades')
        metasCol = $app.findCollectionByNameOrId('metas')
      } catch (colErr) {
        $app.logger().error('gravar-atividade: collection not found', 'error', String(colErr))
        return e.json(500, { success: false, error: 'required collection not found' })
      }

      var vendedorId = null
      var vendedorRecord = null

      try {
        vendedorRecord = $app.findFirstRecordByData('users', 'name', vendedorNome)
        vendedorId = vendedorRecord.id
      } catch (_) {
        $app.logger().error('gravar-atividade: vendedor not found', 'name', vendedorNome)
        return e.json(404, { success: false, error: 'vendedor not found: ' + vendedorNome })
      }

      var now = new Date()
      var currentPeriod = now.getFullYear() + '-Q' + (Math.floor(now.getMonth() / 3) + 1)

      var existingMeta = null
      try {
        var metasForVendedor = $app.findRecordsByFilter(
          'metas',
          'vendedor_id = {:vid}',
          '-created',
          100,
          0,
          { vid: vendedorId },
        )
        for (var mi = 0; mi < metasForVendedor.length; mi++) {
          var m = metasForVendedor[mi]
          var mPeriodo = m.getString('periodo') || ''
          if (mPeriodo === currentPeriod) {
            existingMeta = m
            break
          }
        }
      } catch (_) {}

      if (!existingMeta) {
        $app
          .logger()
          .error(
            'gravar-atividade: no meta found for vendedor in current period',
            'vendedor_id',
            vendedorId,
            'periodo',
            currentPeriod,
          )
        return e.json(404, {
          success: false,
          error: 'no meta found for vendedor in current period',
        })
      }

      var atividadeId = null
      var clienteId = null

      $app.runInTransaction(function (txApp) {
        var existingClient = null

        if (clienteCnpj) {
          try {
            existingClient = txApp.findFirstRecordByData('factories', 'cnpj', clienteCnpj)
          } catch (_) {}
        }

        if (!existingClient && clienteNome) {
          try {
            existingClient = txApp.findFirstRecordByData('factories', 'name', clienteNome)
          } catch (_) {}
        }

        if (existingClient) {
          existingClient.set('funnelStage', etapaFunil)
          if (valorEstimado > 0) {
            var currentPotential = existingClient.get('potentialValue') || 0
            existingClient.set('potentialValue', currentPotential + valorEstimado)
          }
          if (clienteCidade) existingClient.set('city', clienteCidade)
          if (clienteEstado) existingClient.set('state', clienteEstado)
          if (clienteCnpj) existingClient.set('cnpj', clienteCnpj)
          if (!existingClient.get('tipo')) {
            existingClient.set('tipo', 'Cliente')
          }
          txApp.save(existingClient)
          clienteId = existingClient.id
        } else {
          var newClient = new Record(factoriesCol)
          newClient.set('name', clienteNome || 'Sem nome')
          if (clienteCnpj) newClient.set('cnpj', clienteCnpj)
          if (clienteCidade) newClient.set('city', clienteCidade)
          if (clienteEstado) newClient.set('state', clienteEstado)
          newClient.set('funnelStage', etapaFunil)
          if (valorEstimado > 0) {
            newClient.set('potentialValue', valorEstimado)
          }
          newClient.set('tipo', 'Prospecto')
          txApp.save(newClient)
          clienteId = newClient.id
        }

        var atividade = new Record(atividadesCol)
        atividade.set('cliente_id', clienteId)
        atividade.set('vendedor_id', vendedorId)
        atividade.set('tipo_atividade', tipoAtividadeLower)
        atividade.set('etapa_funil', etapaFunil)
        atividade.set('valor_estimado', valorEstimado)
        atividade.set('descricao', descricao)
        atividade.set('proximo_passo', proximoPasso)
        if (dataProximaAcao) {
          atividade.set('data_proxima_acao', dataProximaAcao)
        }
        atividade.set('pendencias', pendencias)
        atividade.set('origem', 'audio')
        atividade.set('audio_transcrito', audioTranscrito)
        atividade.set('confianca', confianca)
        txApp.save(atividade)
        atividadeId = atividade.id

        var metaRecord = txApp.findRecordById('metas', existingMeta.id)
        var currentRealizado = metaRecord.get('valor_realizado') || 0
        metaRecord.set('valor_realizado', currentRealizado + valorEstimado)
        txApp.save(metaRecord)
      })

      $app
        .logger()
        .info(
          'gravar-atividade: activity saved',
          'atividade_id',
          atividadeId,
          'cliente_id',
          clienteId,
          'vendedor_id',
          vendedorId,
        )

      return e.json(200, {
        success: true,
        atividade_id: atividadeId,
        cliente_id: clienteId,
      })
    } catch (err) {
      $app.logger().error('gravar-atividade: unexpected error', 'error', String(err))
      return e.json(500, { success: false, error: 'unexpected error' })
    }
  },
  $apis.requireAuth(),
)
