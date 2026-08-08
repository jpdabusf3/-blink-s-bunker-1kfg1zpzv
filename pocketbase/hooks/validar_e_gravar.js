routerAdd(
  'POST',
  '/backend/v1/validar-e-gravar',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}

      var VALID_TIPOS = ['visita', 'ligacao', 'proposta', 'follow_up', 'reuniao']
      var VALID_ETAPAS = ['prospeccao', 'qualificacao', 'proposta', 'fechamento', 'pos_venda']
      var VALID_ORIGENS = ['audio', 'manual', 'excel']

      var origem = body.origem || ''
      if (VALID_ORIGENS.indexOf(origem) === -1)
        throw new BadRequestError('origem invalido', {
          origem: new ValidationError(
            'validation_invalid_value',
            'origem deve ser: audio, manual ou excel',
          ),
        })

      var tipoAtividade = String(body.tipo_atividade || '')
        .toLowerCase()
        .trim()
      if (!tipoAtividade)
        throw new BadRequestError('tipo_atividade obrigatorio', {
          tipo_atividade: new ValidationError(
            'validation_required',
            'tipo_atividade e obrigatorio',
          ),
        })
      if (VALID_TIPOS.indexOf(tipoAtividade) === -1)
        throw new BadRequestError('tipo_atividade invalido', {
          tipo_atividade: new ValidationError(
            'validation_invalid_value',
            'Valores: visita | ligacao | proposta | follow_up | reuniao',
          ),
        })

      var etapaFunil = String(body.etapa_funil || '')
        .toLowerCase()
        .trim()
      if (!etapaFunil)
        throw new BadRequestError('etapa_funil obrigatorio', {
          etapa_funil: new ValidationError('validation_required', 'etapa_funil e obrigatorio'),
        })
      if (VALID_ETAPAS.indexOf(etapaFunil) === -1)
        throw new BadRequestError('etapa_funil invalido', {
          etapa_funil: new ValidationError(
            'validation_invalid_value',
            'Valores: prospeccao | qualificacao | proposta | fechamento | pos_venda',
          ),
        })

      var cliente = body.cliente || {}
      var clienteNome = cliente.nome || ''
      var clienteCnpj = cliente.cnpj || ''
      if (!clienteNome && !clienteCnpj)
        throw new BadRequestError('cliente obrigatorio', {
          cliente: new ValidationError(
            'validation_required',
            'cliente.nome ou cliente.cnpj e obrigatorio',
          ),
        })

      var vendedorNome = body.vendedor || ''
      var vendedorId = body.vendedor_id || ''
      if (!vendedorNome && !vendedorId)
        throw new BadRequestError('vendedor obrigatorio', {
          vendedor: new ValidationError(
            'validation_required',
            'vendedor ou vendedor_id e obrigatorio',
          ),
        })

      if (!vendedorId && vendedorNome) {
        try {
          vendedorId = $app.findFirstRecordByData('users', 'name', vendedorNome).id
        } catch (_) {
          throw new BadRequestError('vendedor nao encontrado', {
            vendedor: new ValidationError(
              'validation_not_found',
              'Vendedor nao encontrado: ' + vendedorNome,
            ),
          })
        }
      }

      var valorEstimado = typeof body.valor_estimado === 'number' ? body.valor_estimado : 0
      var descricao = body.descricao || ''
      var proximoPasso = body.proximo_passo || ''
      var dataProximaAcao = body.data_proxima_acao || ''
      var pendencias = body.pendencias
      if (Array.isArray(pendencias)) pendencias = pendencias.join('; ')
      else if (pendencias == null) pendencias = ''
      else pendencias = String(pendencias)
      if (body.observacoes)
        descricao = descricao
          ? descricao + ' | Observacoes: ' + body.observacoes
          : 'Observacoes: ' + body.observacoes
      var confianca = typeof body.confianca === 'number' ? body.confianca : 0
      var audioTranscrito = body.audio_transcrito || ''
      var clienteCidade = cliente.cidade || ''
      var clienteEstado = cliente.estado || ''

      var existingClient = null
      if (clienteCnpj) {
        try {
          existingClient = $app.findFirstRecordByData('factories', 'cnpj', clienteCnpj)
        } catch (_) {}
      }
      if (!existingClient && clienteNome) {
        try {
          existingClient = $app.findFirstRecordByData('factories', 'name', clienteNome)
        } catch (_) {}
      }

      if (origem === 'audio' && existingClient) {
        var ultimaEdicao = existingClient.getString('ultima_edicao_origem') || ''
        var updatedStr = existingClient.getString('updated') || ''
        if (ultimaEdicao === 'manual' && updatedStr) {
          var diffMs = new Date().getTime() - new Date(updatedStr).getTime()
          if (diffMs < 300000) {
            var pendCol = $app.findCollectionByNameOrId('confirmacoes_pendentes')
            var pendRec = new Record(pendCol)
            pendRec.set('from', vendedorId)
            pendRec.set('json_interpretacao', JSON.stringify(body))
            pendRec.set('audio_transcrito', audioTranscrito)
            pendRec.set('status', 'pending')
            $app.save(pendRec)
            return e.json(200, { precisa_confirmacao: true, pending_id: pendRec.id })
          }
        }
      }

      var now = new Date()
      var currentPeriod = now.getFullYear() + '-Q' + (Math.floor(now.getMonth() / 3) + 1)
      var existingMeta = null
      try {
        var metas = $app.findRecordsByFilter('metas', 'vendedor_id = {:vid}', '-created', 100, 0, {
          vid: vendedorId,
        })
        for (var i = 0; i < metas.length; i++) {
          if ((metas[i].getString('periodo') || '') === currentPeriod) {
            existingMeta = metas[i]
            break
          }
        }
      } catch (_) {}

      var factoriesCol = $app.findCollectionByNameOrId('factories')
      var atividadesCol = $app.findCollectionByNameOrId('atividades')
      var atividadeId = null,
        clienteId = null

      $app.runInTransaction(function (txApp) {
        var client = null
        if (existingClient) {
          client = txApp.findRecordById('factories', existingClient.id)
          client.set('funnelStage', etapaFunil)
          if (valorEstimado > 0)
            client.set('potentialValue', (client.get('potentialValue') || 0) + valorEstimado)
          if (clienteCidade) client.set('city', clienteCidade)
          if (clienteEstado) client.set('state', clienteEstado)
          if (clienteCnpj) client.set('cnpj', clienteCnpj)
          if (!client.get('tipo')) client.set('tipo', 'Cliente')
        } else {
          client = new Record(factoriesCol)
          client.set('name', clienteNome || 'Sem nome')
          if (clienteCnpj) client.set('cnpj', clienteCnpj)
          if (clienteCidade) client.set('city', clienteCidade)
          if (clienteEstado) client.set('state', clienteEstado)
          client.set('funnelStage', etapaFunil)
          if (valorEstimado > 0) client.set('potentialValue', valorEstimado)
          client.set('tipo', 'Prospecto')
        }
        client.set('ultima_edicao_origem', origem)
        txApp.save(client)
        clienteId = client.id

        var atividade = new Record(atividadesCol)
        atividade.set('cliente_id', clienteId)
        atividade.set('vendedor_id', vendedorId)
        atividade.set('tipo_atividade', tipoAtividade)
        atividade.set('etapa_funil', etapaFunil)
        atividade.set('valor_estimado', valorEstimado)
        atividade.set('descricao', descricao)
        atividade.set('proximo_passo', proximoPasso)
        if (dataProximaAcao) atividade.set('data_proxima_acao', dataProximaAcao)
        atividade.set('pendencias', pendencias)
        atividade.set('origem', origem)
        atividade.set('audio_transcrito', audioTranscrito)
        atividade.set('confianca', confianca)
        txApp.save(atividade)
        atividadeId = atividade.id

        if (existingMeta) {
          var meta = txApp.findRecordById('metas', existingMeta.id)
          meta.set('valor_realizado', (meta.get('valor_realizado') || 0) + valorEstimado)
          txApp.save(meta)
        }
      })

      $app
        .logger()
        .info('validar-e-gravar: saved', 'id', atividadeId, 'cliente', clienteId, 'origem', origem)

      if (origem === 'audio') {
        try {
          var logCol2 = $app.findCollectionByNameOrId('activity_logs')
          var logRec2 = new Record(logCol2)
          logRec2.set('user', vendedorId)
          logRec2.set('action', 'audio_gravado')
          logRec2.set('details', 'Atividade gravada para cliente: ' + (clienteNome || ''))
          logRec2.set('recordId', atividadeId)
          logRec2.set('target_collection', 'atividades')
          $app.save(logRec2)
        } catch (_) {}
      }

      return e.json(200, { success: true, atividade_id: atividadeId, cliente_id: clienteId })
    } catch (err) {
      if (err instanceof BadRequestError) throw err
      $app.logger().error('validar-e-gravar: error', 'error', String(err))
      return e.json(500, { error: 'unexpected error' })
    }
  },
  $apis.requireAuth(),
)
