/**
 * Sincronização automática Vendas (historico_vendas) -> Cliente (factories)
 *
 * Atualiza SOMENTE os 4 campos:
 * - valor_medio (média aritmética dos totais das notas agrupadas, 2 casas)
 * - valor_atual (total da nota de ultimo_pedido)
 * - ultimo_pedido (maior data de compra)
 * - status_funil (dias_sem_comprar <= 90: 'Ativo', <= 180: 'Mensal', > 180: 'Inativo')
 *
 * Preserva integralmente todos os outros dados de factories.
 *
 * REGRAS DE MATCHING:
 * 1. Se normalize(cliente_factory) === 'animall' OU normalize(cliente_factory).length < 10:
 *    somente casamento EXATO (normFact === normClienteVenda). Nunca substring.
 * 2. Caso geral (>= 10 caracteres no factory e >= 6 na venda):
 *    substring bidirecional permitida (normFact contém normClienteVenda ou vice-versa).
 */

onRecordAfterCreateSuccess((e) => {
  e.next()
  try {
    var vendaRecord = e.record
    if (!vendaRecord) return

    function normalizeName(s) {
      if (!s) return ''
      return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim()
    }

    function matchFactorySale(normFact, normClienteVenda) {
      if (!normFact || !normClienteVenda) return false

      if (normFact === 'animall') {
        return normClienteVenda === 'animall'
      }

      if (normFact.length < 10) {
        return normFact === normClienteVenda
      }

      if (normFact === normClienteVenda) {
        return true
      }

      var minLen = Math.min(normFact.length, normClienteVenda.length)
      if (
        minLen >= 6 &&
        (normFact.indexOf(normClienteVenda) !== -1 || normClienteVenda.indexOf(normFact) !== -1)
      ) {
        return true
      }

      return false
    }

    var clienteVenda = ''
    if (typeof vendaRecord.getString === 'function') {
      clienteVenda = vendaRecord.getString('cliente') || ''
    } else if (vendaRecord.cliente) {
      clienteVenda = vendaRecord.cliente
    }

    var normClienteVenda = normalizeName(clienteVenda)
    if (!normClienteVenda) return

    // Buscar todas as factories para encontrar matches
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

    // Encontrar factories correspondentes
    var matchingFactories = []
    for (var f = 0; f < allFactories.length; f++) {
      var fact = allFactories[f]
      var factName = fact.getString ? fact.getString('name') : fact.name || ''
      var normFact = normalizeName(factName)
      if (!normFact) continue

      if (matchFactorySale(normFact, normClienteVenda)) {
        matchingFactories.push(fact)
      }
    }

    if (matchingFactories.length === 0) {
      return
    }

    // Carregar todas as vendas para recalcular
    var allSales = []
    offset = 0
    while (true) {
      var sBatch = $app.findRecordsByFilter('historico_vendas', '1=1', '-data', batchSize, offset)
      if (!sBatch || sBatch.length === 0) break
      for (var s = 0; s < sBatch.length; s++) {
        allSales.push(sBatch[s])
      }
      if (sBatch.length < batchSize) break
      offset += batchSize
    }

    var salesData = []
    for (var i = 0; i < allSales.length; i++) {
      var sale = allSales[i]
      var sCliente = sale.getString ? sale.getString('cliente') : sale.cliente || ''
      var sData = sale.getString ? sale.getString('data') : sale.data || ''
      var sNumDoc = (
        (sale.getString ? sale.getString('numero_documento') : sale.numero_documento) || ''
      ).trim()
      var sValor = sale.getFloat
        ? sale.getFloat('valor')
        : Number(sale.get ? sale.get('valor') : sale.valor) || 0
      var sValorTotalNota = sale.getFloat
        ? sale.getFloat('valor_total_nota')
        : Number(sale.get ? sale.get('valor_total_nota') : sale.valor_total_nota) || 0

      salesData.push({
        cliente: sCliente,
        normCliente: normalizeName(sCliente),
        data: sData,
        numero_documento: sNumDoc,
        valor: sValor,
        valor_total_nota: sValorTotalNota,
      })
    }

    var hoje = new Date()

    for (var m = 0; m < matchingFactories.length; m++) {
      var targetFactory = matchingFactories[m]
      var tName = targetFactory.getString
        ? targetFactory.getString('name')
        : targetFactory.name || ''
      var tId = targetFactory.getString ? targetFactory.getString('id') : targetFactory.id || ''
      var normTarget = normalizeName(tName)

      var matchedSales = []
      for (var si = 0; si < salesData.length; si++) {
        var sd = salesData[si]
        if (!sd.normCliente) continue

        if (matchFactorySale(normTarget, sd.normCliente)) {
          matchedSales.push(sd)
        }
      }

      if (matchedSales.length === 0) {
        if (normTarget === 'animall' || normTarget.length < 10) {
          $app
            .db()
            .newQuery(
              "UPDATE factories SET valor_medio = 0, valor_atual = 0, ultimo_pedido = '', status_funil = '' WHERE id = {:id}",
            )
            .bind({ id: tId })
            .execute()
        }
        continue
      }

      var gruposMap = {}
      for (var gi = 0; gi < matchedSales.length; gi++) {
        var ms = matchedSales[gi]
        var groupKey = ms.numero_documento
        if (!groupKey) {
          groupKey = String(ms.data) + '_' + String(ms.cliente) + '_' + String(ms.valor_total_nota)
        }
        if (!gruposMap[groupKey]) {
          gruposMap[groupKey] = []
        }
        gruposMap[groupKey].push(ms)
      }

      var notas = []
      var maxDataGeral = ''
      var keys = Object.keys(gruposMap)

      for (var ki = 0; ki < keys.length; ki++) {
        var k = keys[ki]
        var itens = gruposMap[k]

        var hasGtZero = false
        var maxTotalNota = 0
        var soma = 0
        var maxDataNota = ''

        for (var ii = 0; ii < itens.length; ii++) {
          var it = itens[ii]
          if (it.valor_total_nota > 0) {
            hasGtZero = true
            if (it.valor_total_nota > maxTotalNota) {
              maxTotalNota = it.valor_total_nota
            }
          }
          soma += it.valor

          var itData = String(it.data || '')
          if (itData && (!maxDataNota || itData > maxDataNota)) {
            maxDataNota = itData
          }
          if (itData && (!maxDataGeral || itData > maxDataGeral)) {
            maxDataGeral = itData
          }
        }

        var total_nota = hasGtZero ? maxTotalNota : soma
        notas.push({
          total_nota: total_nota,
          data: maxDataNota,
        })
      }

      if (notas.length === 0) continue

      var somaTotais = 0
      var notaMaisRecente = notas[0]

      for (var ni = 0; ni < notas.length; ni++) {
        var nota = notas[ni]
        somaTotais += nota.total_nota
        if (String(nota.data || '') >= String(notaMaisRecente.data || '')) {
          notaMaisRecente = nota
        }
      }

      var valor_medio = Math.round((somaTotais / notas.length) * 100) / 100
      var ultimo_pedido = maxDataGeral
      var valor_atual = Math.round(notaMaisRecente.total_nota * 100) / 100

      var status_funil = 'Inativo'
      if (ultimo_pedido) {
        var dataUltimo = new Date(ultimo_pedido)
        var diff = hoje.getTime() - dataUltimo.getTime()
        var dias = Math.floor(diff / (1000 * 60 * 60 * 24))
        if (dias <= 90) {
          status_funil = 'Ativo'
        } else if (dias <= 180) {
          status_funil = 'Mensal'
        } else {
          status_funil = 'Inativo'
        }
      }

      $app
        .db()
        .newQuery(
          'UPDATE factories SET valor_medio = {:valor_medio}, valor_atual = {:valor_atual}, ultimo_pedido = {:ultimo_pedido}, status_funil = {:status_funil} WHERE id = {:id}',
        )
        .bind({
          valor_medio: valor_medio,
          valor_atual: valor_atual,
          ultimo_pedido: ultimo_pedido,
          status_funil: status_funil,
          id: tId,
        })
        .execute()

      $app
        .logger()
        .info(
          '[syncVendaToFactory (create)] Factory atualizada: ' +
            tName +
            ' (id: ' +
            tId +
            ') -> valor_medio: ' +
            valor_medio +
            ', valor_atual: ' +
            valor_atual +
            ', status_funil: ' +
            status_funil,
        )
    }
  } catch (err) {
    $app.logger().error('[syncVendaToFactory (create)] Erro:', 'error', String(err))
  }
}, 'historico_vendas')

onRecordAfterUpdateSuccess((e) => {
  e.next()
  try {
    var vendaRecord = e.record
    if (!vendaRecord) return

    function normalizeName(s) {
      if (!s) return ''
      return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim()
    }

    function matchFactorySale(normFact, normClienteVenda) {
      if (!normFact || !normClienteVenda) return false

      if (normFact === 'animall') {
        return normClienteVenda === 'animall'
      }

      if (normFact.length < 10) {
        return normFact === normClienteVenda
      }

      if (normFact === normClienteVenda) {
        return true
      }

      var minLen = Math.min(normFact.length, normClienteVenda.length)
      if (
        minLen >= 6 &&
        (normFact.indexOf(normClienteVenda) !== -1 || normClienteVenda.indexOf(normFact) !== -1)
      ) {
        return true
      }

      return false
    }

    var clienteVenda = ''
    if (typeof vendaRecord.getString === 'function') {
      clienteVenda = vendaRecord.getString('cliente') || ''
    } else if (vendaRecord.cliente) {
      clienteVenda = vendaRecord.cliente
    }

    var normClienteVenda = normalizeName(clienteVenda)
    if (!normClienteVenda) return

    // Buscar todas as factories para encontrar matches
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

    // Encontrar factories correspondentes
    var matchingFactories = []
    for (var f = 0; f < allFactories.length; f++) {
      var fact = allFactories[f]
      var factName = fact.getString ? fact.getString('name') : fact.name || ''
      var normFact = normalizeName(factName)
      if (!normFact) continue

      if (matchFactorySale(normFact, normClienteVenda)) {
        matchingFactories.push(fact)
      }
    }

    if (matchingFactories.length === 0) {
      return
    }

    // Carregar todas as vendas para recalcular
    var allSales = []
    offset = 0
    while (true) {
      var sBatch = $app.findRecordsByFilter('historico_vendas', '1=1', '-data', batchSize, offset)
      if (!sBatch || sBatch.length === 0) break
      for (var s = 0; s < sBatch.length; s++) {
        allSales.push(sBatch[s])
      }
      if (sBatch.length < batchSize) break
      offset += batchSize
    }

    var salesData = []
    for (var i = 0; i < allSales.length; i++) {
      var sale = allSales[i]
      var sCliente = sale.getString ? sale.getString('cliente') : sale.cliente || ''
      var sData = sale.getString ? sale.getString('data') : sale.data || ''
      var sNumDoc = (
        (sale.getString ? sale.getString('numero_documento') : sale.numero_documento) || ''
      ).trim()
      var sValor = sale.getFloat
        ? sale.getFloat('valor')
        : Number(sale.get ? sale.get('valor') : sale.valor) || 0
      var sValorTotalNota = sale.getFloat
        ? sale.getFloat('valor_total_nota')
        : Number(sale.get ? sale.get('valor_total_nota') : sale.valor_total_nota) || 0

      salesData.push({
        cliente: sCliente,
        normCliente: normalizeName(sCliente),
        data: sData,
        numero_documento: sNumDoc,
        valor: sValor,
        valor_total_nota: sValorTotalNota,
      })
    }

    var hoje = new Date()

    for (var m = 0; m < matchingFactories.length; m++) {
      var targetFactory = matchingFactories[m]
      var tName = targetFactory.getString
        ? targetFactory.getString('name')
        : targetFactory.name || ''
      var tId = targetFactory.getString ? targetFactory.getString('id') : targetFactory.id || ''
      var normTarget = normalizeName(tName)

      var matchedSales = []
      for (var si = 0; si < salesData.length; si++) {
        var sd = salesData[si]
        if (!sd.normCliente) continue

        if (matchFactorySale(normTarget, sd.normCliente)) {
          matchedSales.push(sd)
        }
      }

      if (matchedSales.length === 0) {
        if (normTarget === 'animall' || normTarget.length < 10) {
          $app
            .db()
            .newQuery(
              "UPDATE factories SET valor_medio = 0, valor_atual = 0, ultimo_pedido = '', status_funil = '' WHERE id = {:id}",
            )
            .bind({ id: tId })
            .execute()
        }
        continue
      }

      var gruposMap = {}
      for (var gi = 0; gi < matchedSales.length; gi++) {
        var ms = matchedSales[gi]
        var groupKey = ms.numero_documento
        if (!groupKey) {
          groupKey = String(ms.data) + '_' + String(ms.cliente) + '_' + String(ms.valor_total_nota)
        }
        if (!gruposMap[groupKey]) {
          gruposMap[groupKey] = []
        }
        gruposMap[groupKey].push(ms)
      }

      var notas = []
      var maxDataGeral = ''
      var keys = Object.keys(gruposMap)

      for (var ki = 0; ki < keys.length; ki++) {
        var k = keys[ki]
        var itens = gruposMap[k]

        var hasGtZero = false
        var maxTotalNota = 0
        var soma = 0
        var maxDataNota = ''

        for (var ii = 0; ii < itens.length; ii++) {
          var it = itens[ii]
          if (it.valor_total_nota > 0) {
            hasGtZero = true
            if (it.valor_total_nota > maxTotalNota) {
              maxTotalNota = it.valor_total_nota
            }
          }
          soma += it.valor

          var itData = String(it.data || '')
          if (itData && (!maxDataNota || itData > maxDataNota)) {
            maxDataNota = itData
          }
          if (itData && (!maxDataGeral || itData > maxDataGeral)) {
            maxDataGeral = itData
          }
        }

        var total_nota = hasGtZero ? maxTotalNota : soma
        notas.push({
          total_nota: total_nota,
          data: maxDataNota,
        })
      }

      if (notas.length === 0) continue

      var somaTotais = 0
      var notaMaisRecente = notas[0]

      for (var ni = 0; ni < notas.length; ni++) {
        var nota = notas[ni]
        somaTotais += nota.total_nota
        if (String(nota.data || '') >= String(notaMaisRecente.data || '')) {
          notaMaisRecente = nota
        }
      }

      var valor_medio = Math.round((somaTotais / notas.length) * 100) / 100
      var ultimo_pedido = maxDataGeral
      var valor_atual = Math.round(notaMaisRecente.total_nota * 100) / 100

      var status_funil = 'Inativo'
      if (ultimo_pedido) {
        var dataUltimo = new Date(ultimo_pedido)
        var diff = hoje.getTime() - dataUltimo.getTime()
        var dias = Math.floor(diff / (1000 * 60 * 60 * 24))
        if (dias <= 90) {
          status_funil = 'Ativo'
        } else if (dias <= 180) {
          status_funil = 'Mensal'
        } else {
          status_funil = 'Inativo'
        }
      }

      $app
        .db()
        .newQuery(
          'UPDATE factories SET valor_medio = {:valor_medio}, valor_atual = {:valor_atual}, ultimo_pedido = {:ultimo_pedido}, status_funil = {:status_funil} WHERE id = {:id}',
        )
        .bind({
          valor_medio: valor_medio,
          valor_atual: valor_atual,
          ultimo_pedido: ultimo_pedido,
          status_funil: status_funil,
          id: tId,
        })
        .execute()

      $app
        .logger()
        .info(
          '[syncVendaToFactory (update)] Factory atualizada: ' +
            tName +
            ' (id: ' +
            tId +
            ') -> valor_medio: ' +
            valor_medio +
            ', valor_atual: ' +
            valor_atual +
            ', status_funil: ' +
            status_funil,
        )
    }
  } catch (err) {
    $app.logger().error('[syncVendaToFactory (update)] Erro:', 'error', String(err))
  }
}, 'historico_vendas')
