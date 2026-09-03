migrate(
  (app) => {
    function normalize(s) {
      if (!s) return ''
      return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim()
    }

    function isDeniedPair(normClienteFactory, normClienteVenda) {
      if (
        (normClienteFactory === 'animall' && normClienteVenda === 'pecuarianutricaoanimalltda') ||
        (normClienteFactory === 'pecuarianutricaoanimalltda' && normClienteVenda === 'animall')
      ) {
        return true
      }
      return false
    }

    function fetchAllRecords(collectionName) {
      const records = []
      const batchSize = 500
      let offset = 0
      while (true) {
        const batch = app.findRecordsByFilter(collectionName, '', '', batchSize, offset)
        if (!batch || batch.length === 0) break
        for (let i = 0; i < batch.length; i++) {
          records.push(batch[i])
        }
        if (batch.length < batchSize) break
        offset += batchSize
      }
      return records
    }

    // Buscar especificamente os clientes com nome 'Animall'
    const factories = fetchAllRecords('factories')
    const vendas = fetchAllRecords('historico_vendas')

    const animallFactories = factories.filter((f) => {
      const name = f.getString ? f.getString('name') : f.name || ''
      return normalize(name) === 'animall'
    })

    if (animallFactories.length === 0) {
      console.log('[Migration 0080] Cliente Animall não encontrado.')
      return
    }

    // Pré-computar dados das vendas
    const vendasData = []
    for (let i = 0; i < vendas.length; i++) {
      const v = vendas[i]
      const clienteRaw = v.getString ? v.getString('cliente') : v.cliente || ''
      const dataRaw = v.getString ? v.getString('data') : v.data || ''
      const numDocRaw = v.getString ? v.getString('numero_documento') : v.numero_documento || ''
      const valorRaw = v.get ? v.get('valor') : v.valor || 0
      const valorTotalNotaRaw = v.get ? v.get('valor_total_nota') : v.valor_total_nota || 0

      vendasData.push({
        record: v,
        cliente: clienteRaw,
        normCliente: normalize(clienteRaw),
        data: dataRaw,
        numero_documento: (numDocRaw || '').trim(),
        valor: Number(valorRaw) || 0,
        valor_total_nota: Number(valorTotalNotaRaw) || 0,
      })
    }

    const hoje = new Date()

    for (let f = 0; f < animallFactories.length; f++) {
      const factory = animallFactories[f]
      const fName = factory.getString ? factory.getString('name') : factory.name || ''
      const fId = factory.getString ? factory.getString('id') : factory.id || ''
      const n = normalize(fName)

      // Casar com vendas respeitando a denylist
      const matchedVendas = []
      for (let i = 0; i < vendasData.length; i++) {
        const vd = vendasData[i]
        const cNorm = vd.normCliente
        if (!cNorm) continue

        // Checar denylist
        if (isDeniedPair(n, cNorm)) {
          continue
        }

        let isMatch = false
        if (cNorm === n) {
          isMatch = true
        } else {
          const minLen = Math.min(n.length, cNorm.length)
          if (minLen >= 6 && (cNorm.indexOf(n) !== -1 || n.indexOf(cNorm) !== -1)) {
            isMatch = true
          }
        }

        if (isMatch) {
          matchedVendas.push(vd)
        }
      }

      console.log(
        '[Migration 0080] Factory ' +
          fName +
          ' (id: ' +
          fId +
          ') casou com ' +
          matchedVendas.length +
          ' vendas legítimas (NF 324 excluída).',
      )

      if (matchedVendas.length === 0) {
        // Sem outras vendas: resetar os 4 campos calculados
        app
          .db()
          .newQuery(
            'UPDATE factories SET valor_medio = 0, valor_atual = 0, ultimo_pedido = null, status_funil = null WHERE id = {:id}',
          )
          .bind({ id: fId })
          .execute()
        console.log('[Migration 0080] Animall resetado para 0/null com sucesso.')
      } else {
        // Agrupar por nota e recalcular
        const gruposMap = {}
        for (let i = 0; i < matchedVendas.length; i++) {
          const v = matchedVendas[i]
          let groupKey = v.numero_documento
          if (!groupKey) {
            groupKey = String(v.data) + '_' + String(v.cliente) + '_' + String(v.valor_total_nota)
          }

          if (!gruposMap[groupKey]) {
            gruposMap[groupKey] = []
          }
          gruposMap[groupKey].push(v)
        }

        const notas = []
        let maxDataGeral = ''
        const groupKeys = Object.keys(gruposMap)
        for (let k = 0; k < groupKeys.length; k++) {
          const key = groupKeys[k]
          const itens = gruposMap[key]

          let hasTotalNotaGtZero = false
          let maxValorTotalNota = 0
          let somaValor = 0
          let maxDataNota = ''

          for (let j = 0; j < itens.length; j++) {
            const item = itens[j]
            if (item.valor_total_nota > 0) {
              hasTotalNotaGtZero = true
              if (item.valor_total_nota > maxValorTotalNota) {
                maxValorTotalNota = item.valor_total_nota
              }
            }
            somaValor += item.valor

            const itemDataStr = String(item.data || '')
            if (itemDataStr && (!maxDataNota || itemDataStr > maxDataNota)) {
              maxDataNota = itemDataStr
            }
            if (itemDataStr && (!maxDataGeral || itemDataStr > maxDataGeral)) {
              maxDataGeral = itemDataStr
            }
          }

          const total_nota = hasTotalNotaGtZero ? maxValorTotalNota : somaValor
          notas.push({
            key: key,
            total_nota: total_nota,
            data: maxDataNota,
          })
        }

        let somaTotalNotas = 0
        let notaMaisRecente = notas[0]

        for (let i = 0; i < notas.length; i++) {
          const nota = notas[i]
          somaTotalNotas += nota.total_nota
          if (String(nota.data || '') >= String(notaMaisRecente.data || '')) {
            notaMaisRecente = nota
          }
        }

        const valor_medio = Math.round((somaTotalNotas / notas.length) * 100) / 100
        const ultimo_pedido = maxDataGeral
        const valor_atual = Math.round(notaMaisRecente.total_nota * 100) / 100

        let status_funil = 'Inativo'
        if (ultimo_pedido) {
          const dataUltimoPedido = new Date(ultimo_pedido)
          const diffMs = hoje.getTime() - dataUltimoPedido.getTime()
          const diasSemComprar = Math.floor(diffMs / (1000 * 60 * 60 * 24))

          if (diasSemComprar <= 90) {
            status_funil = 'Ativo'
          } else if (diasSemComprar <= 180) {
            status_funil = 'Mensal'
          } else {
            status_funil = 'Inativo'
          }
        }

        app
          .db()
          .newQuery(
            'UPDATE factories SET valor_medio = {:valor_medio}, valor_atual = {:valor_atual}, ultimo_pedido = {:ultimo_pedido}, status_funil = {:status_funil} WHERE id = {:id}',
          )
          .bind({
            valor_medio: valor_medio,
            valor_atual: valor_atual,
            ultimo_pedido: ultimo_pedido,
            status_funil: status_funil,
            id: fId,
          })
          .execute()

        console.log(
          '[Migration 0080] Animall recalculado: valor_medio=' +
            valor_medio +
            ', valor_atual=' +
            valor_atual +
            ', ultimo_pedido=' +
            ultimo_pedido +
            ', status_funil=' +
            status_funil,
        )
      }
    }
  },
  (app) => {
    // Revert opcional
  },
)
