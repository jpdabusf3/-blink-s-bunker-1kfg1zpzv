// pocketbase/hooks/nfe_processar_pdf.js
// Handles PDF text extraction (AI-powered parsing), Excel row import into nfe_pedidos review queue,
// and approval/rejection endpoints for the NF-e review workflow.

routerAdd(
  'POST',
  '/backend/v1/nfe/processar-pdf',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var body = e.requestInfo().body || {}
      var arquivos = body.arquivos || []
      var excelRows = body.excelRows || body.rows || []

      if ((!arquivos || !arquivos.length) && (!excelRows || !excelRows.length)) {
        return e.badRequestError('Nenhum arquivo ou linha enviado para processamento.')
      }

      function parseNumber(v) {
        if (typeof v === 'number') return v
        if (!v) return 0
        var s = String(v).trim()
        if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
          s = s.replace(/\./g, '').replace(',', '.')
        } else if (s.indexOf(',') !== -1) {
          s = s.replace(',', '.')
        }
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
        if (parts.length === 3) {
          return parts[2] + '-' + pad(parseInt(parts[1], 10)) + '-' + pad(parseInt(parts[0], 10))
        }
        var parsed = new Date(s)
        if (!isNaN(parsed.getTime())) {
          return (
            parsed.getFullYear() + '-' + pad(parsed.getMonth() + 1) + '-' + pad(parsed.getDate())
          )
        }
        return ''
      }

      function cleanCnpj(c) {
        if (!c) return ''
        return String(c).replace(/[^\d]/g, '')
      }

      // Load products catalog for matching
      var catalogList = []
      try {
        catalogList = $app.findRecordsByFilter('produtos', 'ativo = true', 'nome', 500, 0)
      } catch (errCat) {
        $app.logger().warn('nfe: aviso ao carregar catalogo', 'error', String(errCat))
      }

      var colNfe = $app.findCollectionByNameOrId('nfe_pedidos')
      var resultados = []
      var importados = 0
      var pendentesRevisao = 0
      var pendenciasProduto = 0
      var duplicadasIgnoradas = 0

      // Helper to match a product item against the catalog
      function matchCatalog(itemCode, itemName) {
        var cleanCode = String(itemCode || '')
          .trim()
          .toUpperCase()
        var cleanName = String(itemName || '')
          .trim()
          .toLowerCase()

        if (cleanCode) {
          for (var i = 0; i < catalogList.length; i++) {
            var cat = catalogList[i]
            var catCode = String(cat.getString('codigo') || '')
              .trim()
              .toUpperCase()
            if (
              catCode &&
              (catCode === cleanCode ||
                cleanCode.indexOf(catCode) !== -1 ||
                catCode.indexOf(cleanCode) !== -1)
            ) {
              return {
                id: cat.id,
                nome: cat.getString('nome'),
                linha: cat.getString('linha'),
                unidade: cat.getString('unidade_medida'),
                preco: cat.getInt('preco_base'),
              }
            }
          }
        }

        if (cleanName) {
          for (var j = 0; j < catalogList.length; j++) {
            var cat2 = catalogList[j]
            var catName = String(cat2.getString('nome') || '')
              .trim()
              .toLowerCase()
            if (
              catName &&
              (catName.indexOf(cleanName) !== -1 || cleanName.indexOf(catName) !== -1)
            ) {
              return {
                id: cat2.id,
                nome: cat2.getString('nome'),
                linha: cat2.getString('linha'),
                unidade: cat2.getString('unidade_medida'),
                preco: cat2.getInt('preco_base'),
              }
            }
          }
        }

        return null
      }

      // Helper to match factory/client in CRM
      function matchFactory(clienteNome, clienteCnpj) {
        var cleanC = cleanCnpj(clienteCnpj)
        if (cleanC) {
          try {
            var recs = $app.findRecordsByFilter('factories', "cnpj != ''", '', 200, 0)
            for (var f = 0; f < recs.length; f++) {
              var fCnpj = cleanCnpj(recs[f].getString('cnpj'))
              if (fCnpj && fCnpj === cleanC) {
                return recs[f]
              }
            }
          } catch (_) {}
        }
        if (clienteNome) {
          try {
            return $app.findFirstRecordByFilter(
              'factories',
              "name ~ '" + String(clienteNome).trim().replace(/'/g, "\\'") + "'",
            )
          } catch (_) {}
        }
        return null
      }

      // Helper to check for duplicate NF
      function isDuplicateNf(numeroNf, dataEmissao) {
        if (!numeroNf) return null
        try {
          var filter = "numero_nf = '" + String(numeroNf).trim().replace(/'/g, "\\'") + "'"
          if (dataEmissao) {
            filter += " && data_emissao ~ '" + dataEmissao.substring(0, 10) + "'"
          }
          return $app.findFirstRecordByFilter('nfe_pedidos', filter)
        } catch (_) {
          return null
        }
      }

      // 1. PROCESS PDF FILES WITH SKIP AI
      if (arquivos && arquivos.length) {
        for (var a = 0; a < arquivos.length; a++) {
          var arq = arquivos[a]
          var nomeArq = arq.nome || 'arquivo.pdf'
          var rawText = arq.texto || ''

          if (!rawText || rawText.trim().length < 20) {
            resultados.push({
              arquivo: nomeArq,
              status: 'erro',
              mensagem:
                'Não foi possível extrair texto legível do PDF. Utilize a importação via planilha Excel.',
            })
            continue
          }

          var aiData = null
          var aiPrompt =
            'Você é um especialista em DANFE / Nota Fiscal Eletrônica brasileira para a empresa Blink Bioscience Brasil Ltda. ' +
            'Analise minuciosamente o texto extraído da DANFE e extraia TODOS os campos no formato JSON estruturado conforme o schema abaixo. ' +
            'Não invente dados. Para campos não encontrados, use null ou string vazia. Formate valores numéricos como números decimais (ex: 9000.00, 28.50). ' +
            'Datas devem ser no formato AAAA-MM-DD. ' +
            'Retorne SOMENTE o JSON válido, sem comentários ou texto adicional.\n\n' +
            'SCHEMA EXATO:\n' +
            '{\n' +
            '  "chave_acesso": "string com a chave de 44 dígitos",\n' +
            '  "numero_nf": "número da NF ex: 322",\n' +
            '  "serie": "série da NF ex: 1",\n' +
            '  "natureza_operacao": "natureza da operação ex: S-Venda Mercadoria",\n' +
            '  "protocolo_autorizacao": "protocolo e data/hora ex: 141260348963840 - 31/08/2026 19:09:42",\n' +
            '  "data_emissao": "AAAA-MM-DD",\n' +
            '  "data_entrada_saida": "AAAA-MM-DD",\n' +
            '  "hora_saida": "HH:MM:SS",\n' +
            '  "emitente": {\n' +
            '    "razao_social": "BLINK BIOSCIENCE BRASIL LTDA.",\n' +
            '    "cnpj": "38.348.638/0004-33",\n' +
            '    "inscricao_estadual": "9118131816",\n' +
            '    "endereco": "Avenida Melvim Jones, 440..."\n' +
            '  },\n' +
            '  "cliente": {\n' +
            '    "razao_social": "Nuttria Nutricao Animal Ltda.",\n' +
            '    "cnpj": "29.133.749/0001-99",\n' +
            '    "municipio": "Mirassol",\n' +
            '    "uf": "SP",\n' +
            '    "endereco": "RUA Feliciano Sales Cunha, Km 455",\n' +
            '    "bairro_distrito": "Zona Rural",\n' +
            '    "cep": "15.138-899",\n' +
            '    "inscricao_estadual": "1735200800",\n' +
            '    "fone": "451086290112"\n' +
            '  },\n' +
            '  "valores": {\n' +
            '    "base_calculo_icms": 9000.00,\n' +
            '    "valor_icms": 360.00,\n' +
            '    "aliquota_icms": 4.00,\n' +
            '    "base_calculo_icms_st": 0.00,\n' +
            '    "valor_icms_st": 0.00,\n' +
            '    "valor_total_produtos": 8550.00,\n' +
            '    "valor_frete": 450.00,\n' +
            '    "valor_seguro": 0.00,\n' +
            '    "desconto": 0.00,\n' +
            '    "outras_despesas": 0.00,\n' +
            '    "valor_ipi": 0.00,\n' +
            '    "valor_total_nota": 9000.00,\n' +
            '    "valor_aproximado_tributos": 360.00\n' +
            '  },\n' +
            '  "fatura": {\n' +
            '    "numero": "001",\n' +
            '    "vencimento": "AAAA-MM-DD",\n' +
            '    "valor": 9000.00\n' +
            '  },\n' +
            '  "transporte": {\n' +
            '    "modalidade_frete": "CIF",\n' +
            '    "volumes": "1 palete",\n' +
            '    "peso_bruto": 335.00,\n' +
            '    "peso_liquido": 300.00\n' +
            '  },\n' +
            '  "itens": [\n' +
            '    {\n' +
            '      "codigo_produto": "BPMI.OR015",\n' +
            '      "descricao": "Blink Copper 22 - SC",\n' +
            '      "ncm": "2309.90.90",\n' +
            '      "cst": "100",\n' +
            '      "cfop": "6102",\n' +
            '      "unidade": "KG",\n' +
            '      "quantidade": 300.00,\n' +
            '      "valor_unitario": 28.50,\n' +
            '      "valor_total_item": 8550.00,\n' +
            '      "lote": "B2026012002MIOR.Cu22 Qtde: 300,00",\n' +
            '      "aliquota_icms": 4.00,\n' +
            '      "valor_icms": 360.00\n' +
            '    }\n' +
            '  ],\n' +
            '  "observacoes": {\n' +
            '    "ordem_compra": "ORDEM DE COMPRA 15040",\n' +
            '    "texto_complementar": "texto completo dos dados adicionais"\n' +
            '  },\n' +
            '  "classificacao_sugerida": {\n' +
            '    "especie": "BOVINO|SUINO|AVE|PET|AQUA|OUTRO",\n' +
            '    "canal_vendas": "Direto|Distribuidor|Indústria|Premixera|Cooperativa|Online"\n' +
            '  }\n' +
            '}\n\n' +
            'TEXTO DA NOTA FISCAL (DANFE):\n' +
            rawText.substring(0, 16000)

          try {
            var aiReply = $ai.chat({
              model: 'fast',
              messages: [
                {
                  role: 'system',
                  content:
                    'Você é um extrator de dados de notas fiscais DANFE e faturas da Blink Bioscience. ' +
                    'Responda exclusivamente com JSON puro e bem estruturado.',
                },
                { role: 'user', content: aiPrompt },
              ],
            })

            var rawReply = ''
            if (aiReply && aiReply.choices && aiReply.choices[0] && aiReply.choices[0].message) {
              rawReply = aiReply.choices[0].message.content || ''
            }

            if (rawReply) {
              var jsonStr = rawReply.trim()
              var firstBrace = jsonStr.indexOf('{')
              var lastBrace = jsonStr.lastIndexOf('}')
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
              }
              aiData = JSON.parse(jsonStr)
            }
          } catch (errAi) {
            $app.logger().error('nfe: erro na chamada de IA', 'error', String(errAi))
          }

          if (!aiData) {
            resultados.push({
              arquivo: nomeArq,
              status: 'erro',
              mensagem: 'Falha ao analisar a estrutura da nota fiscal com IA.',
            })
            continue
          }

          // Extraction fallback from regex if AI missed essential fields
          var numeroNf = aiData.numero_nf ? String(aiData.numero_nf).trim() : ''
          if (!numeroNf) {
            var matchNum = rawText.match(/N[º°\.\s]+([0-9]{1,9})/i)
            if (matchNum) numeroNf = matchNum[1]
          }

          var dataEmissao = parseDate(aiData.data_emissao)
          if (!dataEmissao) {
            var matchDate = rawText.match(/EMISS[ÃA]O:?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i)
            if (matchDate) dataEmissao = parseDate(matchDate[1])
          }
          if (!dataEmissao) {
            dataEmissao = new Date().toISOString().substring(0, 10)
          }

          var clienteNome =
            aiData.cliente && aiData.cliente.razao_social
              ? String(aiData.cliente.razao_social).trim()
              : ''
          if (!clienteNome) {
            clienteNome = 'Cliente não identificado'
          }

          var clienteCnpj =
            aiData.cliente && aiData.cliente.cnpj ? String(aiData.cliente.cnpj).trim() : ''
          var valorTotal = parseNumber(aiData.valores && aiData.valores.valor_total_nota)
          if (!valorTotal || valorTotal <= 0) {
            valorTotal = parseNumber(aiData.valores && aiData.valores.valor_total_produtos)
          }
          if (!valorTotal || valorTotal <= 0) {
            var matchVal = rawText.match(/VALOR TOTAL(?:\s+DA NOTA)?\s*:?\s*R?\$?\s*([\d\.,]+)/i)
            if (matchVal) valorTotal = parseNumber(matchVal[1])
          }

          // Check for duplicate
          var dup = isDuplicateNf(numeroNf, dataEmissao)
          if (dup) {
            duplicadasIgnoradas++
            resultados.push({
              id: dup.id,
              arquivo: nomeArq,
              numero_nf: numeroNf,
              cliente: clienteNome,
              cnpj: clienteCnpj,
              valor: valorTotal,
              status: 'duplicada_ignorada',
              mensagem:
                'Nota fiscal já importada anteriormente (' +
                (dup.getString('status') || 'registrada') +
                ').',
            })
            continue
          }

          // Process and validate items
          var itemsRaw = Array.isArray(aiData.itens) ? aiData.itens : []
          var itemsProcessed = []
          var hasUnmatchedItem = false

          for (var it = 0; it < itemsRaw.length; it++) {
            var itemRaw = itemsRaw[it]
            var itemCodigo = itemRaw.codigo_produto || itemRaw.codigo || ''
            var itemNome = itemRaw.descricao || itemRaw.nome || 'Produto sem descrição'
            var itemQtd = parseNumber(itemRaw.quantidade) || 1
            var itemUnit = parseNumber(itemRaw.valor_unitario) || 0
            var itemTotal =
              parseNumber(itemRaw.valor_total_item || itemRaw.valor_total) || itemQtd * itemUnit

            var catMatch = matchCatalog(itemCodigo, itemNome)
            if (!catMatch) {
              hasUnmatchedItem = true
            }

            itemsProcessed.push({
              codigo: itemCodigo,
              nome: itemNome,
              ncm: itemRaw.ncm || '',
              cst: itemRaw.cst || '',
              cfop: itemRaw.cfop || '',
              unidade: itemRaw.unidade || 'KG',
              quantidade: itemQtd,
              preco_unitario: itemUnit,
              valor_total: itemTotal,
              lote: itemRaw.lote || '',
              produto_catalogo_id: catMatch ? catMatch.id : null,
              produto_catalogo_nome: catMatch ? catMatch.nome : null,
              linha_produto: catMatch ? catMatch.linha : '',
              reconhecido: !!catMatch,
              aliquota_icms: parseNumber(itemRaw.aliquota_icms),
              valor_icms: parseNumber(itemRaw.valor_icms),
            })
          }

          if (itemsProcessed.length === 0) {
            hasUnmatchedItem = true
            itemsProcessed.push({
              codigo: 'ND',
              nome: 'Produtos da NF ' + (numeroNf || ''),
              unidade: 'UN',
              quantidade: 1,
              preco_unitario: valorTotal,
              valor_total: valorTotal,
              reconhecido: false,
            })
          }

          // Determine status & pending motive
          var status = hasUnmatchedItem ? 'pendencia_produto' : 'pendente'
          var motivoPendencia = ''
          if (hasUnmatchedItem) {
            motivoPendencia =
              'Um ou mais itens não foram localizados automaticamente no catálogo da Blink.'
          }

          // Match factory in CRM
          var factory = matchFactory(clienteNome, clienteCnpj)
          var gestorId = ''
          var vendedorId = ''
          var especie = 'BOVINO'
          var canalVendas = 'Direto'

          if (factory) {
            gestorId = factory.getString('gestor_tecnico_id') || ''
            vendedorId = factory.getString('vendedor_id') || ''
            var factoryEspecie = factory.getString('animalSpecies') || factory.getString('carteira')
            if (factoryEspecie) {
              var fEspUp = factoryEspecie.toUpperCase()
              if (fEspUp.indexOf('SUIN') !== -1) especie = 'SUINO'
              else if (fEspUp.indexOf('AVE') !== -1) especie = 'AVE'
              else if (fEspUp.indexOf('PET') !== -1) especie = 'PET'
              else if (fEspUp.indexOf('AQUA') !== -1) especie = 'AQUA'
              else if (fEspUp.indexOf('RUM') !== -1 || fEspUp.indexOf('BOV') !== -1)
                especie = 'BOVINO'
            }
            var ch = factory.getString('salesChannel')
            if (ch === 'Indirect') canalVendas = 'Distribuidor'
          }

          if (aiData.classificacao_sugerida) {
            if (aiData.classificacao_sugerida.especie) {
              var sEsp = String(aiData.classificacao_sugerida.especie).toUpperCase()
              if (['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA', 'OUTRO'].indexOf(sEsp) !== -1) {
                especie = sEsp
              }
            }
            if (aiData.classificacao_sugerida.canal_vendas) {
              canalVendas = String(aiData.classificacao_sugerida.canal_vendas)
            }
          }

          // Build record for nfe_pedidos
          try {
            var rec = new Record(colNfe)
            rec.set('numero_nf', numeroNf || 'S/N-' + Math.floor(Math.random() * 10000))
            rec.set('serie_nf', aiData.serie ? String(aiData.serie) : '1')
            rec.set('chave_acesso', aiData.chave_acesso ? String(aiData.chave_acesso) : '')
            rec.set(
              'natureza_operacao',
              aiData.natureza_operacao ? String(aiData.natureza_operacao) : '',
            )
            rec.set(
              'protocolo_autorizacao',
              aiData.protocolo_autorizacao ? String(aiData.protocolo_autorizacao) : '',
            )
            rec.set('data_emissao', dataEmissao)
            if (aiData.data_entrada_saida) {
              rec.set('data_entrada_saida', parseDate(aiData.data_entrada_saida))
            }
            if (aiData.hora_saida) {
              rec.set('hora_saida', String(aiData.hora_saida))
            }

            // Emitente
            if (aiData.emitente) {
              rec.set(
                'emitente_nome',
                aiData.emitente.razao_social || 'BLINK BIOSCIENCE BRASIL LTDA.',
              )
              rec.set('emitente_cnpj', aiData.emitente.cnpj || '38.348.638/0004-33')
              rec.set('emitente_inscricao_estadual', aiData.emitente.inscricao_estadual || '')
              rec.set('emitente_endereco', aiData.emitente.endereco || '')
            }

            // Destinatário
            rec.set('cliente_nome', clienteNome)
            rec.set('cliente_cnpj', clienteCnpj)
            if (aiData.cliente) {
              rec.set('cliente_endereco', aiData.cliente.endereco || '')
              rec.set('cliente_cidade', aiData.cliente.municipio || '')
              rec.set(
                'cliente_uf',
                aiData.cliente.uf ? String(aiData.cliente.uf).toUpperCase() : '',
              )
              rec.set('cliente_bairro_distrito', aiData.cliente.bairro_distrito || '')
              rec.set('cliente_cep', aiData.cliente.cep || '')
              rec.set('cliente_inscricao_estadual', aiData.cliente.inscricao_estadual || '')
              rec.set('cliente_fone', aiData.cliente.fone || '')
            }

            if (factory) rec.set('factory_id', factory.id)
            rec.set('especie', especie)
            rec.set('canal_vendas', canalVendas)
            if (gestorId) rec.set('gestor_tecnico_id', gestorId)
            if (vendedorId) rec.set('vendedor_id', vendedorId)

            rec.set('itens', itemsProcessed)

            // Valores e Impostos
            if (aiData.valores) {
              rec.set('valor_produtos', parseNumber(aiData.valores.valor_total_produtos))
              rec.set('impostos_icms_base', parseNumber(aiData.valores.base_calculo_icms))
              rec.set('impostos_icms_aliquota', parseNumber(aiData.valores.aliquota_icms))
              rec.set('impostos_icms_valor', parseNumber(aiData.valores.valor_icms))
              rec.set('impostos_icms_st_base', parseNumber(aiData.valores.base_calculo_icms_st))
              rec.set('impostos_icms_st_valor', parseNumber(aiData.valores.valor_icms_st))
              rec.set('frete_valor', parseNumber(aiData.valores.valor_frete))
              rec.set('valor_seguro', parseNumber(aiData.valores.valor_seguro))
              rec.set('desconto', parseNumber(aiData.valores.desconto))
              rec.set('outras_despesas', parseNumber(aiData.valores.outras_despesas))
              rec.set('impostos_ipi_valor', parseNumber(aiData.valores.valor_ipi))
              rec.set(
                'valor_aproximado_tributos',
                parseNumber(aiData.valores.valor_aproximado_tributos),
              )
            }

            // Fatura
            if (aiData.fatura) {
              rec.set('fatura_numero', aiData.fatura.numero ? String(aiData.fatura.numero) : '')
              if (aiData.fatura.vencimento) {
                rec.set('fatura_vencimento', parseDate(aiData.fatura.vencimento))
              }
              rec.set('fatura_valor', parseNumber(aiData.fatura.valor))
            }

            // Frete / Transporte
            if (aiData.transporte) {
              rec.set('frete_modalidade', aiData.transporte.modalidade_frete || 'CIF')
              rec.set('volumes', aiData.transporte.volumes || '')
              rec.set('peso_bruto', parseNumber(aiData.transporte.peso_bruto))
              rec.set('peso_liquido', parseNumber(aiData.transporte.peso_liquido))
            } else {
              rec.set('frete_modalidade', 'CIF')
            }

            rec.set('valor_total', valorTotal)
            rec.set('status', status)
            if (motivoPendencia) rec.set('motivo_pendencia', motivoPendencia)
            rec.set('arquivo_nome', nomeArq)
            rec.set('raw_text', rawText.substring(0, 10000))

            // Observações
            var obsFinal = ''
            if (aiData.observacoes) {
              if (aiData.observacoes.ordem_compra) {
                rec.set('ordem_compra', String(aiData.observacoes.ordem_compra))
                obsFinal += aiData.observacoes.ordem_compra + ' '
              }
              if (aiData.observacoes.texto_complementar) {
                obsFinal += aiData.observacoes.texto_complementar
              }
            }
            rec.set('observacoes', obsFinal.trim())

            $app.save(rec)
            importados++
            if (status === 'pendente') pendentesRevisao++
            if (status === 'pendencia_produto') pendenciasProduto++

            resultados.push({
              id: rec.id,
              arquivo: nomeArq,
              numero_nf: numeroNf,
              cliente: clienteNome,
              cnpj: clienteCnpj,
              valor: valorTotal,
              itens_count: itemsProcessed.length,
              status: status,
              motivo_pendencia: motivoPendencia,
              mensagem:
                status === 'pendencia_produto'
                  ? 'Importada para revisão com pendência de produto do catálogo.'
                  : 'Importada com sucesso para a fila de revisão.',
            })
          } catch (errSave) {
            $app.logger().error('nfe: erro ao salvar nfe_pedidos', 'error', String(errSave))
            resultados.push({
              arquivo: nomeArq,
              status: 'erro',
              mensagem: 'Erro ao gravar no banco de dados: ' + String(errSave).substring(0, 150),
            })
          }
        }
      }

      // 2. PROCESS EXCEL ROWS PAYLOAD (Grouping items per NF)
      if (excelRows && excelRows.length) {
        // Group rows by numero_nf (or single order if no NF number)
        var groupedNfs = {}
        for (var r = 0; r < excelRows.length; r++) {
          var row = excelRows[r]
          var numNf = String(row.numero_nf || row.nf || 'EXCEL-' + (r + 1)).trim()
          if (!groupedNfs[numNf]) {
            groupedNfs[numNf] = {
              header: row,
              items: [],
            }
          }
          groupedNfs[numNf].items.push(row)
        }

        var nfKeys = Object.keys(groupedNfs)
        for (var k = 0; k < nfKeys.length; k++) {
          var kNumNf = nfKeys[k]
          var group = groupedNfs[kNumNf]
          var h = group.header
          var hData =
            parseDate(h.data_emissao || h.data) || new Date().toISOString().substring(0, 10)
          var hCliente =
            String(h.cliente_razao_social || h.cliente || h.razao_social || '').trim() ||
            'Cliente sem nome'
          var hCnpj = String(h.cliente_cnpj || h.cnpj || '').trim()

          // Check duplicate
          var dupEx = isDuplicateNf(kNumNf, hData)
          if (dupEx) {
            duplicadasIgnoradas++
            resultados.push({
              id: dupEx.id,
              arquivo: 'Planilha Excel',
              numero_nf: kNumNf,
              cliente: hCliente,
              cnpj: hCnpj,
              status: 'duplicada_ignorada',
              mensagem: 'Nota fiscal já importada anteriormente.',
            })
            continue
          }

          var excelItems = []
          var hasUnmatchedEx = false
          var totalItensSoma = 0

          for (var itemIdx = 0; itemIdx < group.items.length; itemIdx++) {
            var itemRow = group.items[itemIdx]
            var itCod = String(itemRow.codigo_produto || itemRow.codigo || '').trim()
            var itNome = String(
              itemRow.descricao_produto ||
                itemRow.descricao ||
                itemRow.nome ||
                itemRow.linhas_portfolio ||
                'Item ' + (itemIdx + 1),
            ).trim()
            var itQtd = parseNumber(itemRow.quantidade) || 1
            var itUnit = parseNumber(itemRow.valor_unitario) || 0
            var itTot =
              parseNumber(itemRow.valor_total_item || itemRow.valor_total || itemRow.valor) ||
              itQtd * itUnit
            totalItensSoma += itTot

            var itMatch = matchCatalog(itCod, itNome)
            if (!itMatch) hasUnmatchedEx = true

            excelItems.push({
              codigo: itCod,
              nome: itNome,
              ncm: String(itemRow.ncm || ''),
              cst: String(itemRow.cst || ''),
              cfop: String(itemRow.cfop || ''),
              unidade: String(itemRow.unidade || 'KG'),
              quantidade: itQtd,
              preco_unitario: itUnit,
              valor_total: itTot,
              lote: String(itemRow.lote || ''),
              produto_catalogo_id: itMatch ? itMatch.id : null,
              produto_catalogo_nome: itMatch ? itMatch.nome : null,
              linha_produto: itMatch ? itMatch.linha : '',
              reconhecido: !!itMatch,
              aliquota_icms: parseNumber(itemRow.aliquota_icms),
              valor_icms: parseNumber(itemRow.valor_icms),
            })
          }

          var exValTotal =
            parseNumber(h.valor_total_nota || h.valor_total || h.valor) || totalItensSoma
          var exStatus = hasUnmatchedEx ? 'pendencia_produto' : 'pendente'
          var exMotivo = hasUnmatchedEx ? 'Item da planilha não encontrado no catálogo.' : ''

          // Match factory
          var exFactory = matchFactory(hCliente, hCnpj)
          var exGestorId = ''
          var exVendedorId = ''
          var exEspecie = 'BOVINO'
          var exCanal = 'Direto'

          if (h.gestor_tecnico || h.gestor) {
            try {
              exGestorId = $app.findFirstRecordByFilter(
                'gestao_tecnica',
                "nome ~ '" +
                  String(h.gestor_tecnico || h.gestor)
                    .trim()
                    .replace(/'/g, "\\'") +
                  "'",
              ).id
            } catch (_) {}
          }
          if (h.vendedor) {
            try {
              exVendedorId = $app.findFirstRecordByFilter(
                'gestao_tecnica',
                "nome ~ '" + String(h.vendedor).trim().replace(/'/g, "\\'") + "'",
              ).id
            } catch (_) {}
          }

          if (exFactory) {
            if (!exGestorId) exGestorId = exFactory.getString('gestor_tecnico_id') || ''
            if (!exVendedorId) exVendedorId = exFactory.getString('vendedor_id') || ''
          }

          if (h.especie) {
            var espU = String(h.especie).trim().toUpperCase()
            if (['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA', 'OUTRO'].indexOf(espU) !== -1) {
              exEspecie = espU
            }
          }
          if (h.canal_vendas) {
            exCanal = String(h.canal_vendas).trim()
          }

          try {
            var exRec = new Record(colNfe)
            exRec.set('numero_nf', kNumNf)
            exRec.set('serie_nf', String(h.serie || '1'))
            exRec.set('chave_acesso', String(h.chave_acesso || ''))
            exRec.set('natureza_operacao', String(h.natureza_operacao || ''))
            exRec.set('protocolo_autorizacao', String(h.protocolo_autorizacao || ''))
            exRec.set('data_emissao', hData)
            if (h.data_entrada_saida)
              exRec.set('data_entrada_saida', parseDate(h.data_entrada_saida))
            if (h.hora_saida) exRec.set('hora_saida', String(h.hora_saida))

            // Emitente
            exRec.set(
              'emitente_nome',
              String(h.emitente_razao_social || 'BLINK BIOSCIENCE BRASIL LTDA.'),
            )
            exRec.set('emitente_cnpj', String(h.emitente_cnpj || '38.348.638/0004-33'))
            exRec.set('emitente_inscricao_estadual', String(h.emitente_inscricao_estadual || ''))
            exRec.set('emitente_endereco', String(h.emitente_endereco || ''))

            // Destinatário
            exRec.set('cliente_nome', hCliente)
            exRec.set('cliente_cnpj', hCnpj)
            exRec.set('cliente_cidade', String(h.cliente_municipio || h.cidade || ''))
            exRec.set('cliente_uf', String(h.cliente_uf || h.uf || '').toUpperCase())
            exRec.set('cliente_endereco', String(h.cliente_endereco || ''))
            exRec.set('cliente_bairro_distrito', String(h.cliente_bairro_distrito || ''))
            exRec.set('cliente_cep', String(h.cliente_cep || ''))
            exRec.set('cliente_inscricao_estadual', String(h.cliente_inscricao_estadual || ''))
            exRec.set('cliente_fone', String(h.cliente_fone || ''))

            if (exFactory) exRec.set('factory_id', exFactory.id)
            exRec.set('especie', exEspecie)
            exRec.set('canal_vendas', exCanal)
            if (exGestorId) exRec.set('gestor_tecnico_id', exGestorId)
            if (exVendedorId) exRec.set('vendedor_id', exVendedorId)

            exRec.set('itens', excelItems)
            exRec.set('valor_produtos', parseNumber(h.valor_total_produtos) || totalItensSoma)

            // Impostos & Totais
            exRec.set('impostos_icms_base', parseNumber(h.base_calculo_icms))
            exRec.set('impostos_icms_aliquota', parseNumber(h.aliquota_icms))
            exRec.set('impostos_icms_valor', parseNumber(h.valor_icms))
            exRec.set('impostos_icms_st_base', parseNumber(h.base_calculo_icms_st))
            exRec.set('impostos_icms_st_valor', parseNumber(h.valor_icms_st))
            exRec.set('frete_valor', parseNumber(h.valor_frete))
            exRec.set('valor_seguro', parseNumber(h.valor_seguro))
            exRec.set('desconto', parseNumber(h.desconto))
            exRec.set('outras_despesas', parseNumber(h.outras_despesas))
            exRec.set('impostos_ipi_valor', parseNumber(h.valor_ipi))
            exRec.set('valor_total', exValTotal)
            exRec.set('valor_aproximado_tributos', parseNumber(h.valor_aproximado_tributos))

            // Fatura
            exRec.set('fatura_numero', String(h.fatura_numero || ''))
            if (h.fatura_vencimento) exRec.set('fatura_vencimento', parseDate(h.fatura_vencimento))
            exRec.set('fatura_valor', parseNumber(h.fatura_valor))

            // Transporte
            exRec.set('frete_modalidade', String(h.modalidade_frete || 'CIF'))
            exRec.set('volumes', String(h.volumes || ''))
            exRec.set('peso_bruto', parseNumber(h.peso_bruto))
            exRec.set('peso_liquido', parseNumber(h.peso_liquido))

            exRec.set('status', exStatus)
            if (exMotivo) exRec.set('motivo_pendencia', exMotivo)
            exRec.set('arquivo_nome', 'Planilha Excel')
            exRec.set('ordem_compra', String(h.ordem_compra || ''))
            exRec.set('observacoes', String(h.observacoes || h.ordem_compra || ''))

            $app.save(exRec)
            importados++
            if (exStatus === 'pendente') pendentesRevisao++
            if (exStatus === 'pendencia_produto') pendenciasProduto++

            resultados.push({
              id: exRec.id,
              arquivo: 'Planilha Excel',
              numero_nf: kNumNf,
              cliente: hCliente,
              cnpj: hCnpj,
              valor: exValTotal,
              itens_count: excelItems.length,
              status: exStatus,
              motivo_pendencia: exMotivo,
              mensagem: 'Importada via planilha para a fila de revisão.',
            })
          } catch (errSaveEx) {
            $app
              .logger()
              .error('nfe: erro ao salvar excel em nfe_pedidos', 'error', String(errSaveEx))
            resultados.push({
              arquivo: 'Planilha Excel',
              numero_nf: kNumNf,
              status: 'erro',
              mensagem: 'Erro ao salvar linha da planilha: ' + String(errSaveEx).substring(0, 150),
            })
          }
        }
      }

      return e.json(200, {
        success: true,
        importados: importados,
        pendentes_revisao: pendentesRevisao,
        pendencias_produto: pendenciasProduto,
        duplicadas_ignoradas: duplicadasIgnoradas,
        total: (arquivos ? arquivos.length : 0) + (excelRows ? excelRows.length : 0),
        resultados: resultados,
      })
    } catch (err) {
      $app.logger().error('nfe: erro fatal no processamento', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

// APPROVAL ENDPOINT: Efetiva o pedido na historico_vendas e atualiza nfe_pedidos para aprovado
routerAdd(
  'POST',
  '/backend/v1/nfe/aprovar',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var body = e.requestInfo().body || {}
      var nfeId = body.id
      var editData = body.dados || {}

      if (!nfeId) return e.badRequestError('ID da nota fiscal é obrigatório')

      var nfeRecord = $app.findRecordById('nfe_pedidos', nfeId)
      if (!nfeRecord) return e.notFoundError('Nota fiscal não encontrada')

      // Apply any user edits sent during review
      if (editData.numero_nf) nfeRecord.set('numero_nf', editData.numero_nf)
      if (editData.cliente_nome) nfeRecord.set('cliente_nome', editData.cliente_nome)
      if (editData.cliente_cnpj) nfeRecord.set('cliente_cnpj', editData.cliente_cnpj)
      if (editData.cliente_cidade) nfeRecord.set('cliente_cidade', editData.cliente_cidade)
      if (editData.cliente_uf) nfeRecord.set('cliente_uf', editData.cliente_uf)
      if (editData.data_emissao) nfeRecord.set('data_emissao', editData.data_emissao)
      if (editData.especie) nfeRecord.set('especie', editData.especie)
      if (editData.canal_vendas) nfeRecord.set('canal_vendas', editData.canal_vendas)
      if (editData.gestor_tecnico_id !== undefined)
        nfeRecord.set('gestor_tecnico_id', editData.gestor_tecnico_id || '')
      if (editData.vendedor_id !== undefined)
        nfeRecord.set('vendedor_id', editData.vendedor_id || '')
      if (editData.valor_total !== undefined) nfeRecord.set('valor_total', editData.valor_total)
      if (editData.itens) nfeRecord.set('itens', editData.itens)
      if (editData.observacoes !== undefined) nfeRecord.set('observacoes', editData.observacoes)

      // Create record in historico_vendas
      var colVendas = $app.findCollectionByNameOrId('historico_vendas')
      var recVenda = new Record(colVendas)

      var dataFinal =
        nfeRecord.getString('data_emissao') || new Date().toISOString().substring(0, 10)
      if (dataFinal.length > 10) dataFinal = dataFinal.substring(0, 10)

      var clienteFinal = nfeRecord.getString('cliente_nome')
      var especieFinal = nfeRecord.getString('especie') || 'BOVINO'
      var canalFinal = nfeRecord.getString('canal_vendas') || 'Direto'
      var valorFinal = nfeRecord.getInt('valor_total') || 0
      var gestorFinal = nfeRecord.getString('gestor_tecnico_id') || ''
      var vendedorFinal = nfeRecord.getString('vendedor_id') || ''

      var numNf = nfeRecord.getString('numero_nf')
      var obs = 'NF #' + numNf
      var extraObs = nfeRecord.getString('observacoes')
      if (extraObs) obs += ' | ' + extraObs

      recVenda.set('data', dataFinal)
      recVenda.set('cliente', clienteFinal)
      recVenda.set('especie', especieFinal)
      if (gestorFinal) recVenda.set('gestor_tecnico_id', gestorFinal)
      if (vendedorFinal) recVenda.set('vendedor_id', vendedorFinal)
      recVenda.set('canal_vendas', canalFinal)
      recVenda.set('valor', valorFinal)
      recVenda.set('observacoes', obs)
      recVenda.set('origem', 'upload')
      recVenda.set('atualizado_em', new Date().toISOString())

      $app.save(recVenda)

      // Update factory's ultimo_pedido if factory exists
      var factoryId = nfeRecord.getString('factory_id')
      if (factoryId) {
        try {
          var fact = $app.findRecordById('factories', factoryId)
          fact.set('ultimo_pedido', dataFinal)
          $app.save(fact)
        } catch (_) {}
      }

      // Mark nfe_pedidos as aprovado
      nfeRecord.set('status', 'aprovado')
      nfeRecord.set('motivo_pendencia', '')
      nfeRecord.set('aprovado_por', userId)
      nfeRecord.set('aprovado_em', new Date().toISOString())
      $app.save(nfeRecord)

      // Log activity
      try {
        var colLogs = $app.findCollectionByNameOrId('activity_logs')
        var recLog = new Record(colLogs)
        recLog.set('user', userId)
        recLog.set('action', 'nfe_aprovada')
        recLog.set(
          'details',
          'Aprovada NF #' + numNf + ' do cliente ' + clienteFinal + ' no valor de R$ ' + valorFinal,
        )
        recLog.set('target_collection', 'nfe_pedidos')
        recLog.set('recordId', nfeId)
        $app.save(recLog)
      } catch (_) {}

      return e.json(200, {
        success: true,
        nfe_id: nfeId,
        venda_id: recVenda.id,
        mensagem: 'Nota fiscal aprovada e pedido implantado com sucesso!',
      })
    } catch (err) {
      $app.logger().error('nfe: erro ao aprovar', 'error', String(err))
      return e.json(500, { error: 'Erro ao aprovar nota fiscal: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

// REJECTION ENDPOINT: Rejeita a nota fiscal na fila
routerAdd(
  'POST',
  '/backend/v1/nfe/rejeitar',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var body = e.requestInfo().body || {}
      var nfeId = body.id
      var motivo = body.motivo || 'Rejeitada pelo usuário na fila de revisão.'

      if (!nfeId) return e.badRequestError('ID da nota fiscal é obrigatório')

      var nfeRecord = $app.findRecordById('nfe_pedidos', nfeId)
      if (!nfeRecord) return e.notFoundError('Nota fiscal não encontrada')

      nfeRecord.set('status', 'rejeitado')
      nfeRecord.set('motivo_pendencia', motivo)
      $app.save(nfeRecord)

      return e.json(200, {
        success: true,
        nfe_id: nfeId,
        mensagem: 'Nota fiscal rejeitada.',
      })
    } catch (err) {
      $app.logger().error('nfe: erro ao rejeitar', 'error', String(err))
      return e.json(500, { error: 'Erro ao rejeitar nota fiscal: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
