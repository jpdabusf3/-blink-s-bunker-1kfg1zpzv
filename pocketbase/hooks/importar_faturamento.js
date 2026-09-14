// Hook de importação de faturamento
routerAdd(
  'POST',
  '/backend/v1/importar-faturamento',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}
      var rows = body.rows
      var options = body.options || {}
      // options: { criarClienteNaoEncontrado: boolean }
      var autoCreateClient = !!options.criarClienteNaoEncontrado

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return e.badRequestError('rows array is required')
      }

      function cleanCnpj(c) {
        return String(c || '').replace(/\D/g, '')
      }

      function pad(n) {
        return n < 10 ? '0' + n : '' + n
      }

      function parseDate(val) {
        if (!val) return ''
        if (typeof val === 'number') {
          // Excel serial date (days since 1899-12-30)
          var d = new Date(Math.round((val - 25569) * 86400 * 1000))
          if (isNaN(d.getTime())) return ''
          return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
        }
        var s = String(val).trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
        var parts = s.split('/')
        if (parts.length === 3) {
          // assume DD/MM/YYYY
          var day = parseInt(parts[0], 10)
          var month = parseInt(parts[1], 10)
          var year = parseInt(parts[2], 10)
          if (year < 100) year += 2000
          return year + '-' + pad(month) + '-' + pad(day)
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
        if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
          s = s.replace(/\./g, '').replace(',', '.')
        } else if (s.indexOf(',') !== -1) {
          s = s.replace(',', '.')
        }
        return parseFloat(s.replace(/[^\d.-]/g, '')) || 0
      }

      function normalizeName(s) {
        if (!s) return ''
        return String(s)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
          .trim()
      }

      var MESES_EXTENSO = [
        'janeiro',
        'fevereiro',
        'março',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro',
      ]

      function deriveDateParts(dataStr) {
        var d = new Date(dataStr)
        if (isNaN(d.getTime())) {
          d = new Date()
        }
        var mIdx = d.getUTCMonth()
        var mes = MESES_EXTENSO[mIdx] || 'janeiro'
        var ano = d.getUTCFullYear() || new Date().getFullYear()
        var qNum = Math.floor(mIdx / 3) + 1
        var trimestre = 'T' + qNum
        return { mes: mes, ano: ano, trimestre: trimestre }
      }

      function canonicalEspecie(raw) {
        if (!raw) return 'OUTRO'
        var norm = String(raw)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase()
        var clean = norm.replace(/[^a-z0-9]/g, '')

        if (clean === 'aves' || clean === 'ave') return 'AVE'
        if (clean.indexOf('suin') !== -1) return 'SUINO'
        if (clean.indexOf('bovin') !== -1 || clean.indexOf('rumin') !== -1) return 'BOVINO'
        if (clean.indexOf('pet') !== -1) return 'PET'
        if (clean.indexOf('aqua') !== -1 || clean.indexOf('pisci') !== -1) return 'AQUA'
        return 'OUTRO'
      }

      function canonicalAnimalSpeciesFactory(raw) {
        if (!raw) return 'Outros'
        var norm = String(raw)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase()
        var clean = norm.replace(/[^a-z0-9]/g, '')

        if (clean === 'aves' || clean === 'ave') return 'Aves'
        if (clean.indexOf('suin') !== -1) return 'Suinos'
        if (clean.indexOf('bovin') !== -1 || clean.indexOf('rumin') !== -1) return 'Ruminantes'
        if (clean.indexOf('pet') !== -1) return 'Pet'
        if (clean.indexOf('aqua') !== -1 || clean.indexOf('pisci') !== -1) return 'Aqua'
        if (clean.indexOf('equin') !== -1) return 'Equinos'
        if (clean.indexOf('multi') !== -1) return 'Multiespécies'
        return 'Outros'
      }

      // 1. Pré-carregar todas as factories para matching em memória rápido
      var allFactories = []
      var batchSize = 500
      var offset = 0
      while (true) {
        var batch = $app.findRecordsByFilter('factories', '1=1', '', batchSize, offset)
        if (!batch || batch.length === 0) break
        for (var b = 0; b < batch.length; b++) {
          allFactories.push(batch[b])
        }
        if (batch.length < batchSize) break
        offset += batchSize
      }

      // Mapas de indexação de factories
      var factoryByCnpj = {}
      var factoryByNameNorm = {}
      for (var f = 0; f < allFactories.length; f++) {
        var fact = allFactories[f]
        var fCnpj = cleanCnpj(fact.getString ? fact.getString('cnpj') : fact.cnpj)
        if (fCnpj && fCnpj.length === 14) {
          factoryByCnpj[fCnpj] = fact
        }
        var fName = fact.getString ? fact.getString('name') : fact.name || ''
        var fn = normalizeName(fName)
        if (fn && !factoryByNameNorm[fn]) {
          factoryByNameNorm[fn] = fact
        }
      }

      // Pré-carregar Gestão Técnica para vincular gestor/vendedor
      var gtRecords = []
      offset = 0
      while (true) {
        var gtBatch = $app.findRecordsByFilter(
          'gestao_tecnica',
          'ativo = true',
          '',
          batchSize,
          offset,
        )
        if (!gtBatch || gtBatch.length === 0) break
        for (var gb = 0; gb < gtBatch.length; gb++) {
          gtRecords.push(gtBatch[gb])
        }
        if (gtBatch.length < batchSize) break
        offset += batchSize
      }

      function findGestaoTecnica(nome, funcaoEsperada) {
        if (!nome) return null
        var norm = normalizeName(nome)
        for (var i = 0; i < gtRecords.length; i++) {
          var rec = gtRecords[i]
          var rName = rec.getString ? rec.getString('nome') : rec.nome || ''
          var rFuncao = rec.getString ? rec.getString('funcao') : rec.funcao || ''
          if (normalizeName(rName) === norm) {
            if (!funcaoEsperada || rFuncao === funcaoEsperada) return rec
          }
        }
        // Substring match
        for (var j = 0; j < gtRecords.length; j++) {
          var rec2 = gtRecords[j]
          var rName2 = rec2.getString ? rec2.getString('nome') : rec2.nome || ''
          var rFuncao2 = rec2.getString ? rec2.getString('funcao') : rec2.funcao || ''
          var rNorm2 = normalizeName(rName2)
          if (rNorm2 && norm && (rNorm2.indexOf(norm) !== -1 || norm.indexOf(rNorm2) !== -1)) {
            if (!funcaoEsperada || rFuncao2 === funcaoEsperada) return rec2
          }
        }
        return null
      }

      var hvCol = $app.findCollectionByNameOrId('historico_vendas')
      var factCol = $app.findCollectionByNameOrId('factories')

      var criados = 0
      var atualizados = 0
      var duplicatasIgnoradas = 0
      var clientesCriados = 0
      var clientesVinculados = 0
      var clientesNaoIdentificados = 0
      var erros = []

      // Rastrear pedidos importados por factory para atualização cirúrgica posterior
      // factoryId -> { maxData: string, somaValor: number, qtdNotas: number, ultimoValor: number, factoryRecord: Record }
      var factoriesAfetadas = {}

      for (var i = 0; i < rows.length; i++) {
        var rowNum = i + 2
        var item = rows[i] || {}

        var dataRaw = item.data || item.data_documento || item.data_pedido || item.data_faturamento
        var dataFaturamento = parseDate(dataRaw)
        if (!dataFaturamento) {
          erros.push({ linha: rowNum, erro: 'Data inválida ou ausente: ' + String(dataRaw || '') })
          continue
        }

        var clienteNome = String(
          item.cliente || item.cliente_nome || item.destinatario_nome || '',
        ).trim()
        var clienteCnpj = cleanCnpj(item.cnpj || item.cliente_cnpj || item.destinatario_cnpj)
        var numeroDoc = String(
          item.numero_documento || item.numero_nf || item.numero_pedido || item.nf || '',
        ).trim()
        var produtoDesc = String(
          item.produto || item.produto_descricao || item.descricao || '',
        ).trim()
        var produtoCod = String(item.produto_codigo || item.codigo || '').trim()
        var especieRaw = String(
          item.especie || item.especie_destino || item.animalSpecies || '',
        ).trim()
        var quantidade = parseNumber(item.quantidade || item.produto_quantidade || 1)
        var valorItem = parseNumber(
          item.valor || item.produto_valor_total || item.valor_total || item.total,
        )
        var valorUnitario = parseNumber(item.produto_valor_unitario || item.valor_unitario)
        var valorTotalNota = parseNumber(item.valor_total_nota) || valorItem
        var vendedorNome = String(item.vendedor || item.vendedor_nome || '').trim()
        var gestorNome = String(item.gestor || item.gestor_tecnico || '').trim()
        var unidadeFilial = String(item.unidade || item.filial || item.unidade_filial || '').trim()
        var canalVendas = String(item.canal_vendas || item.canal || 'Direto').trim()
        var statusPedido = String(item.status || 'realizado')
          .trim()
          .toLowerCase()
        if (statusPedido !== 'projetado') statusPedido = 'realizado'

        if (!clienteNome && !clienteCnpj) {
          erros.push({ linha: rowNum, erro: 'Cliente (nome ou CNPJ) é obrigatório' })
          continue
        }

        if (valorItem <= 0 && valorTotalNota <= 0) {
          erros.push({ linha: rowNum, erro: 'Valor do pedido/item deve ser maior que zero' })
          continue
        }

        if (valorUnitario <= 0 && quantidade > 0 && valorItem > 0) {
          valorUnitario = Math.round((valorItem / quantidade) * 100) / 100
        }

        // 2. VINCULAÇÃO INTELIGENTE DO CLIENTE (factories)
        var matchedFactory = null
        if (clienteCnpj && clienteCnpj.length === 14) {
          matchedFactory = factoryByCnpj[clienteCnpj] || null
        }
        if (!matchedFactory && clienteNome) {
          var cNorm = normalizeName(clienteNome)
          if (factoryByNameNorm[cNorm]) {
            matchedFactory = factoryByNameNorm[cNorm]
          } else {
            // Tentativa de correspondência parcial tolerante
            for (var fnKey in factoryByNameNorm) {
              if (
                (fnKey.length >= 8 && cNorm.indexOf(fnKey) !== -1) ||
                (cNorm.length >= 8 && fnKey.indexOf(cNorm) !== -1)
              ) {
                matchedFactory = factoryByNameNorm[fnKey]
                break
              }
            }
          }
        }

        if (matchedFactory) {
          clientesVinculados++
          if (!clienteNome) {
            clienteNome = matchedFactory.getString
              ? matchedFactory.getString('name')
              : matchedFactory.name
          }
        } else {
          // Cliente não encontrado nas factories
          if (autoCreateClient && clienteNome) {
            try {
              var newFact = new Record(factCol)
              newFact.set('name', clienteNome)
              if (clienteCnpj && clienteCnpj.length === 14) {
                newFact.set('cnpj', clienteCnpj)
              }
              newFact.set('tipo', 'Cliente')
              newFact.set('funnelStage', 'Fechamento')
              newFact.set('status_funil', 'Ativo')
              newFact.set('ultimo_pedido', dataFaturamento)
              newFact.set('valor_atual', valorTotalNota || valorItem)
              newFact.set('valor_medio', valorTotalNota || valorItem)
              newFact.set('animalSpecies', canonicalAnimalSpeciesFactory(especieRaw))
              newFact.set('ultima_edicao_origem', 'excel')

              var vdMatch = findGestaoTecnica(vendedorNome, 'vendedor')
              if (vdMatch) newFact.set('vendedor_id', vdMatch.id)
              var gtMatch = findGestaoTecnica(gestorNome, 'gestor_tecnico')
              if (gtMatch) newFact.set('gestor_tecnico_id', gtMatch.id)

              $app.save(newFact)
              matchedFactory = newFact
              clientesCriados++

              // Atualizar caches em memória
              var nNorm = normalizeName(clienteNome)
              factoryByNameNorm[nNorm] = newFact
              if (clienteCnpj && clienteCnpj.length === 14) {
                factoryByCnpj[clienteCnpj] = newFact
              }
              allFactories.push(newFact)
            } catch (createClientErr) {
              $app.logger().warn('Erro ao auto-criar factory: ' + String(createClientErr))
            }
          } else {
            clientesNaoIdentificados++
          }
        }

        // 3. IDEMPOTÊNCIA E DETECÇÃO DE DUPLICATAS
        // Chave primária natural:
        // Se houver numeroDoc: numero_documento + clienteNome + (produtoCod || produtoDesc)
        // Se NÃO houver numeroDoc: dataFaturamento + clienteNome + valorItem + (produtoCod || produtoDesc)
        var existingHv = null
        try {
          if (numeroDoc) {
            var filterNum =
              "numero_documento = '" +
              numeroDoc.replace(/'/g, "\\'") +
              "' && (cliente = '" +
              clienteNome.replace(/'/g, "\\'") +
              "' || destinatario_nome = '" +
              clienteNome.replace(/'/g, "\\'") +
              "')"
            if (produtoCod) {
              filterNum += " && produto_codigo = '" + produtoCod.replace(/'/g, "\\'") + "'"
            }
            existingHv = $app.findFirstRecordByFilter('historico_vendas', filterNum)
          } else {
            var filterFallback =
              "data_documento = '" +
              dataFaturamento +
              "' && (cliente = '" +
              clienteNome.replace(/'/g, "\\'") +
              "' || destinatario_nome = '" +
              clienteNome.replace(/'/g, "\\'") +
              "') && (valor = " +
              valorItem +
              ' || produto_valor_total = ' +
              valorItem +
              ')'
            existingHv = $app.findFirstRecordByFilter('historico_vendas', filterFallback)
          }
        } catch (_) {}

        var dateParts = deriveDateParts(dataFaturamento)
        var especieCanon = canonicalEspecie(especieRaw)

        var gtRec = findGestaoTecnica(gestorNome, 'gestor_tecnico')
        var vdRec = findGestaoTecnica(vendedorNome, 'vendedor')

        try {
          var hvRecord
          var isUpdate = false
          if (existingHv) {
            hvRecord = $app.findRecordById('historico_vendas', existingHv.id)
            isUpdate = true
          } else {
            hvRecord = new Record(hvCol)
          }

          hvRecord.set('origem', 'upload')
          hvRecord.set('numero_documento', numeroDoc)
          hvRecord.set('data', dataFaturamento)
          hvRecord.set('data_documento', dataFaturamento)
          hvRecord.set('mes', dateParts.mes)
          hvRecord.set('ano', dateParts.ano)
          hvRecord.set('trimestre', dateParts.trimestre)
          hvRecord.set('cliente', clienteNome)
          hvRecord.set('destinatario_nome', clienteNome)
          if (clienteCnpj) hvRecord.set('cliente_cnpj', clienteCnpj)
          if (unidadeFilial) hvRecord.set('filial_unidade', unidadeFilial)
          hvRecord.set('especie', especieCanon)
          hvRecord.set(
            'especie_destino',
            especieCanon === 'BOVINO'
              ? 'RUMINANTES'
              : especieCanon === 'AVE'
                ? 'AVES'
                : especieCanon === 'SUINO'
                  ? 'SUINOS'
                  : especieCanon,
          )
          hvRecord.set('canal_vendas', canalVendas)
          hvRecord.set('valor', valorItem)
          hvRecord.set('produto_quantidade', quantidade)
          hvRecord.set('produto_valor_unitario', valorUnitario)
          hvRecord.set('produto_valor_total', valorItem)
          hvRecord.set('valor_total_nota', valorTotalNota || valorItem)
          if (produtoCod) hvRecord.set('produto_codigo', produtoCod)
          if (produtoDesc) hvRecord.set('produto_descricao', produtoDesc)
          hvRecord.set('status', statusPedido)
          hvRecord.set('user_id', userId)
          hvRecord.set('atualizado_em', new Date().toISOString())

          if (matchedFactory) {
            hvRecord.set('factory_id', matchedFactory.id)
          }
          if (gtRec) {
            hvRecord.set('gestor_tecnico_id', gtRec.id)
            hvRecord.set('gestor_tecnico', gtRec.getString ? gtRec.getString('nome') : gtRec.nome)
          } else if (gestorNome) {
            hvRecord.set('gestor_tecnico', gestorNome)
          }
          if (vdRec) {
            hvRecord.set('vendedor_id', vdRec.id)
            hvRecord.set('vendedor', vdRec.getString ? vdRec.getString('nome') : vdRec.nome)
          } else if (vendedorNome) {
            hvRecord.set('vendedor', vendedorNome)
          }

          $app.save(hvRecord)

          if (isUpdate) {
            atualizados++
          } else {
            criados++
          }

          // Se vinculado a cliente, computar efeito nos dados do CRM
          if (matchedFactory) {
            var fId = matchedFactory.id
            if (!factoriesAfetadas[fId]) {
              factoriesAfetadas[fId] = {
                factoryId: fId,
                factoryName: matchedFactory.getString
                  ? matchedFactory.getString('name')
                  : matchedFactory.name,
                factoryRecord: matchedFactory,
                maxData: dataFaturamento,
                ultimoValor: valorTotalNota || valorItem,
                itens: [],
              }
            }
            var fa = factoriesAfetadas[fId]
            if (dataFaturamento >= fa.maxData) {
              fa.maxData = dataFaturamento
              fa.ultimoValor = valorTotalNota || valorItem
            }
            fa.itens.push({
              valor: valorItem,
              totalNota: valorTotalNota || valorItem,
              data: dataFaturamento,
              doc: numeroDoc,
            })
          }
        } catch (saveErr) {
          erros.push({
            linha: rowNum,
            erro: 'Erro ao salvar histórico de venda: ' + String(saveErr),
          })
        }
      }

      // 4. ATUALIZAR DADOS DO CRM PARA CLIENTES AFETADOS (em lote cirúrgico)
      var hoje = new Date()
      var totalClientesAtualizados = 0

      var affectedKeys = Object.keys(factoriesAfetadas)
      for (var k = 0; k < affectedKeys.length; k++) {
        var aKey = affectedKeys[k]
        var afData = factoriesAfetadas[aKey]
        var factRec = afData.factoryRecord

        var currentUltimo = factRec.getString
          ? factRec.getString('ultimo_pedido')
          : factRec.ultimo_pedido
        var newUltimo = afData.maxData
        if (currentUltimo && currentUltimo > newUltimo) {
          newUltimo = currentUltimo
        }

        // Regra unificada do funil (funnel-status.ts):
        // Se o estágio do funil for anterior a Fechamento / Pós-venda (ex: Lead, Primeiro Contato, Proposta, etc.)
        // avança para 'Fechamento'
        var currentStage =
          (factRec.getString ? factRec.getString('funnelStage') : factRec.funnelStage) || 'Lead'
        var STAGES_ANTERIORES = [
          'Lead',
          'Primeiro Contato',
          'Diagnóstico Técnico',
          'Apresentação',
          'Teste/Trial',
          'Proposta',
          'Negociação',
          'Prospecção',
          'Prospeção',
          'Qualificação',
        ]
        var newStage = currentStage
        if (STAGES_ANTERIORES.indexOf(currentStage) !== -1) {
          newStage = 'Fechamento'
        }

        // Calcular status_funil com base no ultimo_pedido (regras unificadas)
        var newStatusFunil = 'Ativo'
        if (newUltimo) {
          var dUltimo = new Date(newUltimo)
          var diffMs = hoje.getTime() - dUltimo.getTime()
          var diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          if (diffDias > 180) {
            newStatusFunil = 'Inativo'
          } else if (diffDias > 90) {
            newStatusFunil = 'Mensal'
          } else {
            newStatusFunil = 'Ativo'
          }
        }

        // Recalcular valor_atual e valor_medio
        var valAtual = afData.ultimoValor || 0
        var somaTotais = 0
        for (var itIdx = 0; itIdx < afData.itens.length; itIdx++) {
          somaTotais += afData.itens[itIdx].valor
        }
        var valMedio =
          afData.itens.length > 0
            ? Math.round((somaTotais / afData.itens.length) * 100) / 100
            : valAtual

        try {
          $app
            .db()
            .newQuery(
              "UPDATE factories SET ultimo_pedido = {:ultimo_pedido}, funnelStage = {:funnelStage}, status_funil = {:status_funil}, valor_atual = {:valor_atual}, valor_medio = {:valor_medio}, tipo = 'Cliente', ultima_edicao_origem = 'excel' WHERE id = {:id}",
            )
            .bind({
              ultimo_pedido: newUltimo,
              funnelStage: newStage,
              status_funil: newStatusFunil,
              valor_atual: valAtual,
              valor_medio: valMedio,
              id: aKey,
            })
            .execute()
          totalClientesAtualizados++
        } catch (updateFactErr) {
          $app.logger().warn('Erro ao atualizar factory ' + aKey + ': ' + String(updateFactErr))
        }
      }

      // 5. REGISTRAR LOG DE ATIVIDADE CONSOLIDADO (1 SÓ LOG para toda a importação)
      try {
        var actCol = $app.findCollectionByNameOrId('activity_logs')
        var actRec = new Record(actCol)
        actRec.set('user', userId)
        actRec.set('action', 'Importação de Faturamento')
        actRec.set(
          'details',
          'Importação consolidada de faturamento: ' +
            criados +
            ' pedidos criados, ' +
            atualizados +
            ' atualizados, ' +
            clientesVinculados +
            ' clientes vinculados, ' +
            clientesCriados +
            ' clientes novos cadastrados e ' +
            totalClientesAtualizados +
            ' clientes atualizados no CRM.',
        )
        actRec.set('target_collection', 'historico_vendas')
        actRec.set('origem', 'painel')
        actRec.set('tipo', 'outro')
        $app.save(actRec)
      } catch (logErr) {
        $app.logger().warn('Erro ao gravar log consolidado: ' + String(logErr))
      }

      // Registrar também no funnel_activity_log consolidado
      try {
        var falCol = $app.findCollectionByNameOrId('funnel_activity_log')
        var falRec = new Record(falCol)
        falRec.set('user', userId)
        falRec.set('action_type', 'create')
        falRec.set('entity_type', 'deal')
        falRec.set('entity_name', 'Planilha de Faturamento')
        falRec.set(
          'description',
          'Importou faturamento com ' +
            criados +
            ' pedidos criados e atualizou ' +
            totalClientesAtualizados +
            ' clientes.',
        )
        $app.save(falRec)
      } catch (_) {}

      return e.json(200, {
        success: true,
        criados: criados,
        atualizados: atualizados,
        duplicatasIgnoradas: duplicatasIgnoradas,
        clientesVinculados: clientesVinculados,
        clientesCriados: clientesCriados,
        clientesNaoIdentificados: clientesNaoIdentificados,
        clientesAtualizadosNoCRM: totalClientesAtualizados,
        totalLinhas: rows.length,
        erros: erros,
      })
    } catch (err) {
      $app.logger().error('importar-faturamento: error', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
