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

      var MESES_MAP = {
        janeiro: 1,
        jan: 1,
        fevereiro: 2,
        fev: 2,
        marco: 3,
        mar: 3,
        abril: 4,
        abr: 4,
        maio: 5,
        mai: 5,
        junho: 6,
        jun: 6,
        julho: 7,
        jul: 7,
        agosto: 8,
        ago: 8,
        setembro: 9,
        set: 9,
        outubro: 10,
        out: 10,
        novembro: 11,
        nov: 11,
        dezembro: 12,
        dez: 12,
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

      function normalizeMonthStr(s) {
        return String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z]/g, '')
          .trim()
      }

      function getIsoWeek(dateObj) {
        var d = new Date(
          Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()),
        )
        var dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      }

      function splitFirst(str, sep) {
        if (!str) return ['', '']
        var s = String(str).trim()
        var idx = s.indexOf(sep)
        if (idx === -1) {
          return [s, '']
        }
        return [s.substring(0, idx).trim(), s.substring(idx + sep.length).trim()]
      }

      /**
       * Parser de data dinâmico e tolerante:
       * - Serial numérico do Excel
       * - YYYY-MM-DD
       * - DD/MM/YYYY ou DD-MM-YYYY
       * - MM/YYYY ou MM-YYYY
       * - Mês por extenso/abreviado em PT: "Janeiro/2025", "jan/2025", "Janeiro 2025", "jan 2025", "2025/01", "2025-01"
       * Usa o 1º dia do mês quando não houver dia.
       */
      function parseDate(val) {
        if (val === undefined || val === null || val === '') return ''

        // 1. Número serial do Excel
        if (typeof val === 'number') {
          if (val > 10000 && val < 90000) {
            var dExcel = new Date(Math.round((val - 25569) * 86400 * 1000))
            if (!isNaN(dExcel.getTime())) {
              return (
                dExcel.getUTCFullYear() +
                '-' +
                pad(dExcel.getUTCMonth() + 1) +
                '-' +
                pad(dExcel.getUTCDate())
              )
            }
          }
        }

        var s = String(val).trim()
        if (!s) return ''

        // 2. YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
        var isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
        if (isoMatch) {
          return (
            isoMatch[1] +
            '-' +
            pad(parseInt(isoMatch[2], 10)) +
            '-' +
            pad(parseInt(isoMatch[3], 10))
          )
        }

        // 3. DD/MM/YYYY ou DD.MM.YYYY ou DD-MM-YYYY
        var ddmmyyyyMatch = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/)
        if (ddmmyyyyMatch) {
          var day = parseInt(ddmmyyyyMatch[1], 10)
          var month = parseInt(ddmmyyyyMatch[2], 10)
          var year = parseInt(ddmmyyyyMatch[3], 10)
          if (year < 100) year += 2000
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return year + '-' + pad(month) + '-' + pad(day)
          }
        }

        // 4. MM/YYYY ou MM-YYYY
        var mmyyyyMatch = s.match(/^(\d{1,2})[\/\.\-](\d{4})$/)
        if (mmyyyyMatch) {
          var m = parseInt(mmyyyyMatch[1], 10)
          var y = parseInt(mmyyyyMatch[2], 10)
          if (m >= 1 && m <= 12) {
            return y + '-' + pad(m) + '-01'
          }
        }

        // 5. YYYY/MM ou YYYY-MM
        var yyyymmMatch = s.match(/^(\d{4})[\/\.\-](\d{1,2})$/)
        if (yyyymmMatch) {
          var y2 = parseInt(yyyymmMatch[1], 10)
          var m2 = parseInt(yyyymmMatch[2], 10)
          if (m2 >= 1 && m2 <= 12) {
            return y2 + '-' + pad(m2) + '-01'
          }
        }

        // 6. Mês por extenso/abreviado com/sem barra/espaço/hífen:
        // ex.: "Janeiro/2025", "jan/2025", "Janeiro 2025", "jan 2025", "Janeiro - 2025", "2025/Janeiro"
        var textMonthMatch = s.match(/([a-zA-ZçÇáÁéÉíÍóÓúÚãÃõÕâÂêÊôÔ]+)[\s\/\-_]+(\d{2,4})/)
        if (textMonthMatch) {
          var mName = normalizeMonthStr(textMonthMatch[1])
          var mNum = MESES_MAP[mName]
          var yNum = parseInt(textMonthMatch[2], 10)
          if (yNum < 100) yNum += 2000
          if (mNum && yNum >= 1990 && yNum <= 2100) {
            return yNum + '-' + pad(mNum) + '-01'
          }
        }

        // Invertido: "2025 - Janeiro"
        var textYearMatch = s.match(/(\d{4})[\s\/\-_]+([a-zA-ZçÇáÁéÉíÍóÓúÚãÃõÕâÂêÊôÔ]+)/)
        if (textYearMatch) {
          var yNum2 = parseInt(textYearMatch[1], 10)
          var mName2 = normalizeMonthStr(textYearMatch[2])
          var mNum2 = MESES_MAP[mName2]
          if (mNum2 && yNum2 >= 1990 && yNum2 <= 2100) {
            return yNum2 + '-' + pad(mNum2) + '-01'
          }
        }

        // 7. Fallback: Date() nativo
        var parsed = new Date(s)
        if (!isNaN(parsed.getTime())) {
          return (
            parsed.getFullYear() + '-' + pad(parsed.getMonth() + 1) + '-' + pad(parsed.getDate())
          )
        }

        return ''
      }

      function parseNumber(val) {
        if (typeof val === 'number') return isNaN(val) ? 0 : val
        if (!val) return 0
        var s = String(val).trim()
        if (!s) return 0

        // Remover símbolos de moeda e espaços: R$, US$, U$, $, etc.
        s = s.replace(/(?:R\$|US\$|U\$|\$|BRL|USD)/gi, '').trim()
        s = s.replace(/\s+/g, '')
        if (!s) return 0

        var hasDot = s.indexOf('.') !== -1
        var hasComma = s.indexOf(',') !== -1

        if (hasDot && hasComma) {
          // Ex: 1.234,56 ou 1,234.56
          // Descobre qual separador aparece por último
          var lastDot = s.lastIndexOf('.')
          var lastComma = s.lastIndexOf(',')
          if (lastComma > lastDot) {
            // Formato brasileiro: 1.234,56
            s = s.replace(/\./g, '').replace(',', '.')
          } else {
            // Formato americano: 1,234.56
            s = s.replace(/,/g, '')
          }
        } else if (hasComma) {
          // Só vírgula: se tiver 3 dígitos após a vírgula e nada mais (ex: 1,000) pode ser milhar americano,
          // porém no contexto brasileiro vírgula é decimal (ex: 15,50 ou 1500,00)
          s = s.replace(',', '.')
        } else if (hasDot) {
          // Só ponto: verificar se é milhar brasileiro (ex: 1.000 ou 15.420 ou 100.000)
          // Se tiver 3 dígitos decimais exatos após o último ponto e o número for grande (ex: 15.420)
          var lastDotIdx = s.lastIndexOf('.')
          var decimals = s.substring(lastDotIdx + 1)
          var intPart = s.substring(0, lastDotIdx)
          if (
            decimals.length === 3 &&
            /^\d{3}$/.test(decimals) &&
            intPart.length >= 1 &&
            intPart.indexOf('.') === -1 &&
            parseFloat(intPart) > 0 &&
            s.indexOf('-') === -1
          ) {
            // Se tiver múltiplos pontos (ex: 1.234.567) é milhar com certeza
            if ((s.match(/\./g) || []).length > 1) {
              s = s.replace(/\./g, '')
            }
          }
        }
        var cleanNumeric = s.replace(/[^\d.-]/g, '')
        if (!cleanNumeric || cleanNumeric === '-' || cleanNumeric === '.') return 0
        var n = parseFloat(cleanNumeric)
        return isNaN(n) ? 0 : n
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

      /**
       * Parser dinâmico de cliente:
       * Separa código do cliente do nome (ex: "1234 - MASTER PREMIX NUTRIÇÃO LTDA" -> codigo="1234", nome="MASTER PREMIX NUTRIÇÃO LTDA")
       * Suporta múltiplos hífens (-, –, —, -), " - ", " : ", " / "
       * Preserva nomes legítimos com hífen quando não há código na frente.
       */
      function parseClientField(raw) {
        if (!raw) return { codigo: '', nome: '' }
        var s = String(raw).trim()
        if (!s) return { codigo: '', nome: '' }

        // Padrão 1: Código numérico ou alfanumérico curto (ex: 1 a 10 dígitos) no início
        // seguido por separador (-, –, —, :, |) e o nome do cliente
        var codePrefixMatch = s.match(
          /^([0-9]{1,10}|[A-Za-z]{1,4}[0-9]{1,8})\s*[\-\–\—\:\|]\s*(.+)$/,
        )
        if (codePrefixMatch) {
          var candCode = codePrefixMatch[1].trim()
          var candName = codePrefixMatch[2].trim()
          if (candName.length >= 2) {
            return { codigo: candCode, nome: candName }
          }
        }

        // Padrão 2: Formato com parênteses ou colchetes: "[1234] MASTER PREMIX" ou "(1234) MASTER PREMIX"
        var bracketMatch = s.match(/^[\(\[]([0-9A-Za-z]+)[\)\]]\s*[\-\–\—\:\s]?\s*(.+)$/)
        if (bracketMatch) {
          var bCode = bracketMatch[1].trim()
          var bName = bracketMatch[2].trim()
          if (bName.length >= 2) {
            return { codigo: bCode, nome: bName }
          }
        }

        // Padrão 3: Nome do cliente seguido pelo código no final: "MASTER PREMIX - COD 1234" ou "MASTER PREMIX (1234)"
        var suffixCodeMatch = s.match(
          /^(.+?)\s*[\-\–\—\:\/]\s*(?:c[oó]d\.?|c[oó]digo)?\s*([0-9]{1,10})$/i,
        )
        if (suffixCodeMatch) {
          var sName = suffixCodeMatch[1].trim()
          var sCode = suffixCodeMatch[2].trim()
          if (sName.length >= 2) {
            return { codigo: sCode, nome: sName }
          }
        }

        return { codigo: '', nome: s }
      }

      function deriveDateParts(dataStr) {
        var d = new Date(dataStr + 'T00:00:00Z')
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
      var factoryByCodigo = {}

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
        var fCodigo = fact.getString ? fact.getString('codigo_cliente') : fact.codigo_cliente
        if (fCodigo) {
          var fcClean = String(fCodigo).trim().toLowerCase()
          if (fcClean && !factoryByCodigo[fcClean]) {
            factoryByCodigo[fcClean] = fact
          }
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
      var fatCol = null
      try {
        fatCol = $app.findCollectionByNameOrId('faturamento')
      } catch (colFatErr) {
        $app.logger().warn('Colecao faturamento nao encontrada: ' + String(colFatErr))
      }

      var criados = 0
      var atualizados = 0
      var duplicatasIgnoradas = 0
      var clientesCriados = 0
      var clientesVinculados = 0
      var clientesVinculadosPorCodigo = 0
      var clientesVinculadosPorNome = 0
      var clientesVinculadosPorCnpj = 0
      var clientesNaoIdentificados = 0
      var erros = []

      // Contadores específicos da coleção faturamento
      var faturamentoImportados = 0
      var faturamentoDuplicatas = 0
      var faturamentoErrosCount = 0
      var faturamentoBatchDedupeKeys = {}

      // Rastrear pedidos importados por factory para atualização cirúrgica posterior
      var factoriesAfetadas = {}

      for (var i = 0; i < rows.length; i++) {
        var rowNum = i + 2
        var item = rows[i] || {}

        var dataRaw =
          item.data ||
          item.data_documento ||
          item.data_pedido ||
          item.data_faturamento ||
          item.mes_ano ||
          item.periodo
        var dataFaturamento = parseDate(dataRaw)
        if (!dataFaturamento) {
          erros.push({
            linha: rowNum,
            erro: 'Data inválida ou não reconhecida: ' + String(dataRaw || ''),
          })
          continue
        }

        var clienteRaw = String(
          item.cliente || item.cliente_nome || item.destinatario_nome || '',
        ).trim()

        // Executar parsing inteligente de código e nome do cliente
        var parsedCli = parseClientField(clienteRaw)
        var clienteNome = parsedCli.nome || clienteRaw
        var clienteCodigoExtraido = parsedCli.codigo || String(item.codigo_cliente || '').trim()

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

        // Capturar valores em Dólar (USD) e Real (R$)
        var valorUsd = parseNumber(
          item.valor_usd ||
            item.faturamento_usd ||
            item.amount_usd ||
            item.amount ||
            item.total_usd,
        )
        var valorUnitarioUsd = parseNumber(
          item.valor_unitario_usd || item.preco_unitario_usd || item.unit_price_usd,
        )
        var valorTotalNotaUsd =
          parseNumber(item.valor_total_nota_usd || item.total_nota_usd || item.invoice_total_usd) ||
          valorUsd

        var valorItem = parseNumber(
          item.valor ||
            item.produto_valor_total ||
            item.valor_total ||
            item.total ||
            item.valor_r$ ||
            item.faturamento_r$ ||
            item.total_r$,
        )
        var valorUnitario = parseNumber(item.produto_valor_unitario || item.valor_unitario)
        var valorTotalNota = parseNumber(item.valor_total_nota) || valorItem

        if (valorUsd > 0 && valorUnitarioUsd <= 0 && quantidade > 0) {
          valorUnitarioUsd = Math.round((valorUsd / quantidade) * 100) / 100
        }
        var vendedorNome = String(item.vendedor || item.vendedor_nome || '').trim()
        var gestorNome = String(item.gestor || item.gestor_tecnico || '').trim()
        var unidadeFilial = String(item.unidade || item.filial || item.unidade_filial || '').trim()
        var canalVendas = String(item.canal_vendas || item.canal || 'Direto').trim()
        var statusPedido = String(item.status || 'realizado')
          .trim()
          .toLowerCase()
        if (statusPedido !== 'projetado') statusPedido = 'realizado'

        if (!clienteNome && !clienteCnpj && !clienteCodigoExtraido) {
          erros.push({ linha: rowNum, erro: 'Cliente (nome, código ou CNPJ) é obrigatório' })
          continue
        }

        if (valorItem <= 0 && valorTotalNota <= 0 && valorUsd <= 0 && valorTotalNotaUsd <= 0) {
          erros.push({
            linha: rowNum,
            erro: 'Valor do pedido/item deve ser maior que zero (em USD ou R$)',
          })
          continue
        }

        if (valorUnitario <= 0 && quantidade > 0 && valorItem > 0) {
          valorUnitario = Math.round((valorItem / quantidade) * 100) / 100
        }

        // 2. VINCULAÇÃO INTELIGENTE DO CLIENTE (factories)
        // Prioridade de matching:
        // (a) CNPJ prioritário se disponível (14 dígitos)
        // (b) Código de cliente se disponível e já cadastrado
        // (c) Razão Social / Nome normalizado exato
        // (d) Razão Social / Nome normalizado substring/tolerante
        var matchedFactory = null
        var matchMethod = ''

        if (clienteCnpj && clienteCnpj.length === 14) {
          matchedFactory = factoryByCnpj[clienteCnpj] || null
          if (matchedFactory) matchMethod = 'cnpj'
        }

        if (!matchedFactory && clienteCodigoExtraido) {
          var cKey = clienteCodigoExtraido.toLowerCase()
          matchedFactory = factoryByCodigo[cKey] || null
          if (matchedFactory) matchMethod = 'codigo'
        }

        if (!matchedFactory && clienteNome) {
          var cNorm = normalizeName(clienteNome)
          if (factoryByNameNorm[cNorm]) {
            matchedFactory = factoryByNameNorm[cNorm]
            matchMethod = 'nome'
          } else {
            // Tentativa de correspondência parcial tolerante (ex: "Master Premix" casa com "Master Premix Nutrição")
            for (var fnKey in factoryByNameNorm) {
              if (
                (fnKey.length >= 6 && cNorm.indexOf(fnKey) !== -1) ||
                (cNorm.length >= 6 && fnKey.indexOf(cNorm) !== -1)
              ) {
                matchedFactory = factoryByNameNorm[fnKey]
                matchMethod = 'nome'
                break
              }
            }
          }
        }

        if (matchedFactory) {
          clientesVinculados++
          if (matchMethod === 'codigo') {
            clientesVinculadosPorCodigo++
          } else if (matchMethod === 'cnpj') {
            clientesVinculadosPorCnpj++
          } else {
            clientesVinculadosPorNome++
          }

          // Se a factory ainda não tinha o código e agora encontramos o código na planilha, registrar na factory
          if (clienteCodigoExtraido) {
            var curFacCod = matchedFactory.getString
              ? matchedFactory.getString('codigo_cliente')
              : matchedFactory.codigo_cliente
            if (!curFacCod) {
              try {
                $app
                  .db()
                  .newQuery('UPDATE factories SET codigo_cliente = {:cod} WHERE id = {:id}')
                  .bind({ cod: clienteCodigoExtraido, id: matchedFactory.id })
                  .execute()
                factoryByCodigo[clienteCodigoExtraido.toLowerCase()] = matchedFactory
              } catch (_) {}
            }
          }

          // Usar o nome canônico limpo
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
              // NUNCA salvar com código embutido no nome: salva o NOME limpo
              newFact.set('name', clienteNome)
              if (clienteCodigoExtraido) {
                newFact.set('codigo_cliente', clienteCodigoExtraido)
              }
              if (clienteCnpj && clienteCnpj.length === 14) {
                newFact.set('cnpj', clienteCnpj)
              }
              newFact.set('tipo', 'Cliente')
              newFact.set('funnelStage', 'Fechamento')
              newFact.set('status_funil', 'Ativo')
              newFact.set('ultimo_pedido', dataFaturamento)
              // No CRM Blink, a base de faturamento é em Dólar.
              // Usar valor em USD quando existir, caindo para Real caso não haja dólar.
              var valBaseCrmNovo =
                (valorTotalNotaUsd || valorUsd) > 0
                  ? valorTotalNotaUsd || valorUsd
                  : valorTotalNota || valorItem
              newFact.set('valor_atual', valBaseCrmNovo)
              newFact.set('valor_medio', valBaseCrmNovo)
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
              if (clienteCodigoExtraido) {
                factoryByCodigo[clienteCodigoExtraido.toLowerCase()] = newFact
              }
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
          // Gravação dos valores em Real e Dólar (se informados)
          hvRecord.set('valor', valorItem)
          hvRecord.set('produto_quantidade', quantidade)
          hvRecord.set('produto_valor_unitario', valorUnitario)
          hvRecord.set('produto_valor_total', valorItem)
          hvRecord.set('valor_total_nota', valorTotalNota || valorItem)

          if (valorUsd > 0) {
            hvRecord.set('valor_usd', valorUsd)
          }
          if (valorUnitarioUsd > 0) {
            hvRecord.set('valor_unitario_usd', valorUnitarioUsd)
          }
          if (valorTotalNotaUsd > 0) {
            hvRecord.set('valor_total_nota_usd', valorTotalNotaUsd)
          }

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

          // 3.1. GRAVAÇÃO NA COLEÇÃO `faturamento` COM REGRAS ESPECÍFICAS
          if (fatCol) {
            try {
              var fatDateObj = new Date(dataFaturamento + 'T00:00:00Z')
              var fatAno = fatDateObj.getUTCFullYear()
              var fatMes = fatDateObj.getUTCMonth() + 1
              var fatSemanaIso = getIsoWeek(fatDateObj)
              var fatSemestre = fatAno + '-' + (fatMes <= 6 ? 'S1' : 'S2')

              var fatNfAno = parseInt(item.nf_ano, 10) || fatAno
              var fatNfAnoMes = String(item.nf_ano_mes || '').trim()
              if (!fatNfAnoMes) {
                fatNfAnoMes = fatAno + '.' + pad(fatMes)
              }

              var rawCountry = String(
                item.country || item.pais || item.destinatario_pais || '',
              ).trim()
              if (!rawCountry && matchedFactory) {
                rawCountry = String(
                  matchedFactory.getString
                    ? matchedFactory.getString('country')
                    : matchedFactory.country || '',
                ).trim()
              }
              if (!rawCountry) rawCountry = 'Brasil'

              // Split no primeiro " - " para cliente e produto caso venham concatenados
              var fatCliParts = splitFirst(
                item.cliente_cod_descricao || item.cliente || clienteRaw || '',
                ' - ',
              )
              var fatClienteCodigo =
                fatCliParts[0] ||
                clienteCodigoExtraido ||
                String(item.cliente_codigo || item.codigo_cliente || '').trim()
              var fatClienteNome =
                fatCliParts[1] || clienteNome || String(item.cliente_nome || '').trim()
              if (!fatClienteNome && fatCliParts[0]) {
                fatClienteNome = fatCliParts[0]
              }

              var fatFamilia = String(
                item.familia_de_produtos ||
                  item.familia_produto ||
                  item.familia ||
                  item.produto_familia ||
                  '',
              ).trim()

              var fatItemParts = splitFirst(
                item.item_codigo_descricao || item.produto || produtoDesc || '',
                ' - ',
              )
              var fatProdutoCodigo =
                fatItemParts[0] ||
                produtoCod ||
                String(item.produto_codigo || item.codigo || '').trim()
              var fatProdutoDesc =
                fatItemParts[1] ||
                produtoDesc ||
                String(item.produto_descricao || item.descricao || '').trim()
              if (!fatProdutoDesc && fatItemParts[0]) {
                fatProdutoDesc = fatItemParts[0]
              }

              var fatValorUsd = parseNumber(
                item.soma_de_vlr_total_usd !== undefined
                  ? item.soma_de_vlr_total_usd
                  : item.valor_usd !== undefined
                    ? item.valor_usd
                    : valorUsd,
              )
              var fatValorBrl = parseNumber(
                item.soma_de_vlr_total_brl !== undefined
                  ? item.soma_de_vlr_total_brl
                  : item.valor_brl !== undefined
                    ? item.valor_brl
                    : item.valor !== undefined
                      ? item.valor
                      : valorItem,
              )

              // Dedupe por chave única: data_documento + cliente_codigo + produto_codigo + valor_brl
              var fatDedupeKey =
                dataFaturamento +
                '__' +
                fatClienteCodigo +
                '__' +
                fatProdutoCodigo +
                '__' +
                fatValorBrl

              if (faturamentoBatchDedupeKeys[fatDedupeKey]) {
                faturamentoDuplicatas++
                duplicatasIgnoradas++
              } else {
                faturamentoBatchDedupeKeys[fatDedupeKey] = true

                // Dedupe no banco: pular se já existir registro com a mesma chave (idempotente)
                var filterFatDedupe =
                  "data_documento ~ '" +
                  dataFaturamento +
                  "' && cliente_codigo = '" +
                  fatClienteCodigo.replace(/'/g, "\\'") +
                  "' && produto_codigo = '" +
                  fatProdutoCodigo.replace(/'/g, "\\'") +
                  "' && valor_brl = " +
                  fatValorBrl

                var alreadyFat = null
                try {
                  alreadyFat = $app.findFirstRecordByFilter('faturamento', filterFatDedupe)
                } catch (_) {}

                if (alreadyFat) {
                  faturamentoDuplicatas++
                  duplicatasIgnoradas++
                } else {
                  var recFat = new Record(fatCol)
                  recFat.set('country', rawCountry)
                  recFat.set('nf_ano', fatNfAno)
                  recFat.set('nf_ano_mes', fatNfAnoMes)
                  recFat.set('cliente_codigo', fatClienteCodigo)
                  recFat.set('cliente_nome', fatClienteNome)
                  recFat.set('familia_produto', fatFamilia)
                  recFat.set('data_documento', dataFaturamento + ' 00:00:00.000Z')
                  recFat.set('produto_codigo', fatProdutoCodigo)
                  recFat.set('produto_descricao', fatProdutoDesc)
                  recFat.set('valor_usd', fatValorUsd)
                  recFat.set('valor_brl', fatValorBrl)
                  recFat.set('semana_iso', fatSemanaIso)
                  recFat.set('mes', fatMes)
                  recFat.set('ano', fatAno)
                  recFat.set('semestre', fatSemestre)
                  recFat.set('user_id', userId)

                  $app.save(recFat)
                  faturamentoImportados++
                }
              }
            } catch (errFatSave) {
              faturamentoErrosCount++
              $app.logger().warn('Erro ao salvar em faturamento: ' + String(errFatSave))
            }
          }

          // Se vinculado a cliente, computar efeito nos dados do CRM
          // Prioridade da moeda: usar USD quando informado (base de faturamento Blink), senão Real
          var valEfetivoLinha =
            (valorTotalNotaUsd || valorUsd) > 0
              ? valorTotalNotaUsd || valorUsd
              : valorTotalNota || valorItem

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
                ultimoValor: valEfetivoLinha,
                itens: [],
              }
            }
            var fa = factoriesAfetadas[fId]
            if (dataFaturamento >= fa.maxData) {
              fa.maxData = dataFaturamento
              fa.ultimoValor = valEfetivoLinha
            }
            fa.itens.push({
              valor: valEfetivoLinha,
              totalNota: valEfetivoLinha,
              valor_usd: valorUsd,
              valor_brl: valorItem,
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
            ' pedidos criados em histórico, ' +
            faturamentoImportados +
            ' registros gravados em faturamento (' +
            faturamentoDuplicatas +
            ' duplicatas ignoradas), ' +
            atualizados +
            ' atualizados, ' +
            clientesVinculados +
            ' clientes vinculados (' +
            clientesVinculadosPorCodigo +
            ' por código, ' +
            clientesVinculadosPorNome +
            ' por nome, ' +
            clientesVinculadosPorCnpj +
            ' por CNPJ), ' +
            clientesCriados +
            ' clientes novos cadastrados e ' +
            totalClientesAtualizados +
            ' clientes atualizados no CRM.',
        )
        actRec.set('target_collection', 'faturamento')
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
            ' pedidos criados, ' +
            faturamentoImportados +
            ' registros em faturamento e atualizou ' +
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
        clientesVinculadosPorCodigo: clientesVinculadosPorCodigo,
        clientesVinculadosPorNome: clientesVinculadosPorNome,
        clientesVinculadosPorCnpj: clientesVinculadosPorCnpj,
        clientesCriados: clientesCriados,
        clientesNaoIdentificados: clientesNaoIdentificados,
        clientesAtualizadosNoCRM: totalClientesAtualizados,
        // Métricas da coleção faturamento
        faturamentoImportados: faturamentoImportados,
        faturamentoDuplicatas: faturamentoDuplicatas,
        faturamentoErrosCount: faturamentoErrosCount,
        total: rows.length,
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
