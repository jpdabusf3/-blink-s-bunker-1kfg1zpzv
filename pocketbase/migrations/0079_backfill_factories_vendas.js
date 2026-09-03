migrate(
  (app) => {
    // 2. Função de normalização de nome
    function normalize(s) {
      if (!s) return ''
      return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim()
    }

    // 1. Carregue todos os registros de factories e historico_vendas
    // Usamos paginação defensiva para garantir que carregamos TODOS os registros
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

    const factories = fetchAllRecords('factories')
    const vendas = fetchAllRecords('historico_vendas')

    console.log(
      '[Migration 0079] Registros carregados: factories = ' +
        factories.length +
        ', historico_vendas = ' +
        vendas.length,
    )

    // Pré-computar clientes normalizados em historico_vendas
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

    let totalProcessados = 0
    let totalComVendas = 0
    let totalAtualizados = 0
    let totalErros = 0
    const exemplos = []

    const hoje = new Date()

    // 3. Para cada factory, compute n = normalize(factory.name)
    for (let f = 0; f < factories.length; f++) {
      const factory = factories[f]
      totalProcessados++

      const fName = factory.getString ? factory.getString('name') : factory.name || ''
      const fId = factory.getString ? factory.getString('id') : factory.id || ''
      const n = normalize(fName)

      if (!n) {
        // Nome vazio ou sem alfanuméricos, pular
        continue
      }

      // Encontre as linhas de historico_vendas cujo normalize(cliente):
      // - seja EXATAMENTE igual a n; OU
      // - (fallback) contenha n como substring, OU n contenha o normalizado do cliente como substring —
      //   MAS somente quando o MENOR dos dois comprimentos for >= 6 caracteres.
      const matchedVendas = []
      for (let i = 0; i < vendasData.length; i++) {
        const vd = vendasData[i]
        const cNorm = vd.normCliente
        if (!cNorm) continue

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

      // Se não houver nenhuma linha casada, PULE esse cliente sem alterar nada
      if (matchedVendas.length === 0) {
        continue
      }

      totalComVendas++

      // 4. Agrupe as linhas casadas do cliente por numero_documento
      // (se vazio, agrupe por data + cliente + valor_total_nota)
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

      // Para cada grupo (nota), calcule:
      // total_nota = max(valor_total_nota) se houver algum valor_total_nota > 0; caso contrário sum(valor)
      // Guardar também a maior data associada a essa nota
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

      if (notas.length === 0) {
        continue
      }

      // 5. Calcule para o cliente:
      // - valor_medio = média aritmética dos total_nota de todas as notas, arredondada para 2 casas decimais.
      // - ultimo_pedido = o maior data entre todas as linhas casadas.
      // - valor_atual = o total_nota da nota cujo data seja o mais recente (maior data).
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

      // 6. Calcule dias_sem_comprar = (data de HOJE no momento da migration) − ultimo_pedido, em dias.
      // Defina status_funil:
      // - se dias_sem_comprar <= 90 → "Ativo"
      // - se dias_sem_comprar > 90 E dias_sem_comprar <= 180 → "Mensal"
      // - se dias_sem_comprar > 180 → "Inativo"
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

      // 7. Persista SOMENTE esses 4 campos no registro correspondente de factories
      // (valor_medio, valor_atual, ultimo_pedido, status_funil) via SQL bruto
      try {
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

        totalAtualizados++

        if (exemplos.length < 10) {
          exemplos.push({
            cliente: fName,
            valor_medio: valor_medio,
            valor_atual: valor_atual,
            ultimo_pedido: ultimo_pedido,
            status_funil: status_funil,
          })
        }
      } catch (err) {
        totalErros++
        console.error(
          '[Migration 0079] Erro ao atualizar factory id ' + fId + ' (' + fName + '):',
          err,
        )
        // Item 8: Se um UPDATE falhar, deixe a migration FALHAR (throw) para não ficar marcada como aplicada sem ter persistido.
        throw err
      }
    }

    // 9. Ao final, imprima via console.log um resumo
    console.log('[Migration 0079] === RESUMO DO BACKFILL FACTORIES ===')
    console.log('[Migration 0079] Total de clientes processados: ' + totalProcessados)
    console.log('[Migration 0079] Total com vendas casadas: ' + totalComVendas)
    console.log('[Migration 0079] Total atualizados com sucesso: ' + totalAtualizados)
    console.log('[Migration 0079] Total de erros: ' + totalErros)
    console.log('[Migration 0079] Exemplos de clientes atualizados:')
    for (let e = 0; e < exemplos.length; e++) {
      const ex = exemplos[e]
      console.log(
        '  - ' +
          ex.cliente +
          ' -> valor_medio: ' +
          ex.valor_medio +
          ', valor_atual: ' +
          ex.valor_atual +
          ', ultimo_pedido: ' +
          ex.ultimo_pedido +
          ', status_funil: ' +
          ex.status_funil,
      )
    }
    console.log('[Migration 0079] =====================================')
  },
  (app) => {
    // Revert opcional ou no-op para backfill de dados
  },
)
