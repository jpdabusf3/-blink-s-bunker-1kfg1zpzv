/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de análise de arquivos para o assistente operacional MAESTRO.
 * Endpoint: POST /backend/v1/maestro/analyze
 *
 * Detecta o tipo de documento:
 *  - "invoice_pdf": Nota Fiscal / DANFE (extrai número, data, emitente, destinatário, CNPJ, itens com produto, família, qtd, valor unitário, total)
 *  - "client_spreadsheet": Cadastro de Clientes (extrai razão social, CNPJ, email, telefone, estado, cidade)
 *  - "sales_spreadsheet": Planilha de Faturamento/Vendas (extrai data, cliente, produto, família, quantidade, valor)
 *  - "unknown": Tipo desconhecido (para o Maestro sugerir as opções de ação)
 */

routerAdd('OPTIONS', '/backend/v1/maestro/analyze', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  return e.noContent(204)
})

routerAdd(
  'POST',
  '/backend/v1/maestro/analyze',
  (e) => {
    e.response.header().set('Access-Control-Allow-Origin', '*')
    e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    e.response
      .header()
      .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')

    try {
      var userId = e.auth && e.auth.id
      if (!userId) {
        return e.json(401, { error: 'Nao autorizado' })
      }

      var body = e.requestInfo().body || {}
      var fileId = body.file_id || body.fileId || ''
      var filePath = body.file_path || body.filePath || ''
      var mimeType = body.mime_type || body.mimeType || ''
      var clientExtractedText = body.extracted_text || body.raw_text || ''
      var clientRows = body.rows || []

      // Se passou fileId de maestro_uploads, carregar registro para validação
      var uploadRecord = null
      if (fileId) {
        try {
          uploadRecord = $app.findRecordById('maestro_uploads', fileId)
        } catch (_) {}
      }

      // Se temos o registro e o $documents estiver disponível, tentar $documents.toMarkdown
      var serverMarkdown = ''
      if (
        uploadRecord &&
        typeof $documents !== 'undefined' &&
        typeof $documents.toMarkdown === 'function'
      ) {
        try {
          var docRes = $documents.toMarkdown({ record: uploadRecord, field: 'arquivo' })
          if (docRes && docRes.markdown) {
            serverMarkdown = docRes.markdown
          }
        } catch (docErr) {
          $app
            .logger()
            .warn(
              'maestro_analyze: $documents.toMarkdown failed or not applicable',
              'error',
              String(docErr),
            )
        }
      }

      // Texto unificado para análise
      var textForAnalysis = serverMarkdown || clientExtractedText || ''

      // Se temos planilhas enviadas com rows já preparadas
      var hasRows = Array.isArray(clientRows) && clientRows.length > 0

      // Se não temos nem texto legível nem linhas da planilha, erro 400 amigável
      if (!textForAnalysis && !hasRows) {
        return e.json(400, {
          error:
            'Não foi possível extrair conteúdo do arquivo. Envie um arquivo com texto selecionável ou dados válidos.',
        })
      }

      // Função de detecção determinística inicial
      var lowerText = textForAnalysis.toLowerCase()
      var isDanfe =
        lowerText.indexOf('danfe') !== -1 ||
        lowerText.indexOf('documento auxiliar') !== -1 ||
        lowerText.indexOf('chave de acesso') !== -1 ||
        lowerText.indexOf('nota fiscal eletr') !== -1 ||
        lowerText.indexOf('dados do produto') !== -1 ||
        lowerText.indexOf('valor total da nota') !== -1

      var isMatrizVenda =
        (lowerText.indexOf('realizado 20') !== -1 || lowerText.indexOf('matriz de venda') !== -1) &&
        (lowerText.indexOf('janeiro') !== -1 || lowerText.indexOf('fevereiro') !== -1) &&
        (lowerText.indexOf('carteira') !== -1 || lowerText.indexOf('pais') !== -1)

      var isPedidosCarteira =
        lowerText.indexOf('pedidos em carteira') !== -1 ||
        ((lowerText.indexOf('pet') !== -1 || lowerText.indexOf('ruminantes') !== -1) &&
          lowerText.indexOf('total geral') !== -1 &&
          (lowerText.indexOf('setembro') !== -1 || lowerText.indexOf('outubro') !== -1))

      var isRelatorioSemanal =
        (lowerText.indexOf('blink geral') !== -1 || lowerText.indexOf('geral br') !== -1) &&
        lowerText.indexOf('planejado') !== -1 &&
        lowerText.indexOf('realizado') !== -1 &&
        (lowerText.indexOf('resultado') !== -1 || lowerText.indexOf('novos clientes') !== -1)

      var isAtendimentoPedidos =
        lowerText.indexOf('atendimento a pedidos') !== -1 ||
        lowerText.indexOf('atendimento pedidos') !== -1 ||
        ((lowerText.indexOf('pedido') !== -1 || lowerText.indexOf('nº pedido') !== -1) &&
          (lowerText.indexOf('fob') !== -1 || lowerText.indexOf('cif') !== -1) &&
          (lowerText.indexOf('data solicitada') !== -1 ||
            lowerText.indexOf('entrega confirmada') !== -1))

      // Prompt para estruturação de alta precisão via IA
      var aiPrompt =
        'Você é o motor de classificação e extração de documentos corporativos do assistente MAESTRO da Blink Biotech.\n' +
        'Analise os dados extraídos do documento fornecido e classifique-o em EXATAMENTE um dos 8 tipos:\n' +
        '1. "invoice_pdf": Nota Fiscal ou DANFE brasileira (faturamento emitido ou recebido).\n' +
        '2. "client_spreadsheet": Planilha de cadastro de clientes / parceiros (contém colunas como Razão Social/Nome, CNPJ, Email, Telefone, Estado, Cidade).\n' +
        '3. "sales_spreadsheet": Planilha de faturamento ou histórico de vendas de pedidos (contém datas de vendas, clientes, códigos/descrição de produto, família de produtos, quantidades e valores).\n' +
        '4. "matriz_venda": Relatório PDF oficial "Matriz de venda" da Blink Biotech (contém colunas País, Carteira, Grupo Cliente, Razão Social, meses JANEIRO a SETEMBRO/DEZEMBRO e rodapé REALIZADO AAAA).\n' +
        '5. "pedidos_carteira": Relatório PDF oficial "Pedidos em carteira" da Blink Biotech (contém janela de 6 meses MÊS | SETEMBRO OUTUBRO... e segmentos Pet, Ruminantes, Suínos e Total Geral).\n' +
        '6. "relatorio_vendas_semanal": Relatório PDF oficial "Relatório de vendas semanal" da Blink Biotech (blocos RESULTADO SETEMBRO/Q3/YTD, BLINK GERAL | BR | INDUSTRIA | PREMIXEIRAS | DISTRIBUIDORAS | LATAM, linhas PLANEJADO e REALIZADO, vendedores e contagens de novos clientes).\n' +
        '7. "atendimento_pedidos": Tabela ou relatório "Atendimento a pedidos - carteira" da Blink Biotech (colunas Nº Pedido, Cliente, Envio FOB/CIF, Data Solicitada, Entrega Confirmada, Obs).\n' +
        '8. "unknown": Qualquer outro formato não reconhecido.\n\n' +
        'ESTRUTURA DE RETORNO OBRIGATÓRIA (JSON PURO):\n' +
        '{\n' +
        '  "document_type": "invoice_pdf" | "client_spreadsheet" | "sales_spreadsheet" | "matriz_venda" | "pedidos_carteira" | "relatorio_vendas_semanal" | "atendimento_pedidos" | "unknown",\n' +
        '  "confidence": number (0 a 1),\n' +
        '  "summary": string (resumo em português, ex: "42 clientes e 168 valores mensais encontrados"),\n' +
        '  "preview_rows": array com até 5 objetos representando as primeiras linhas estruturadas para exibição no chat,\n' +
        '  "data": {\n' +
        '    // Se invoice_pdf: "invoices": [...]\n' +
        '    // Se client_spreadsheet: "clients": [...]\n' +
        '    // Se sales_spreadsheet: "sales": [...]\n' +
        '    // Se matriz_venda: "matriz_venda": [{ "cliente": string, "pais": string, "carteira": string, "grupo": string, "mes": string, "ano": number, "valor": number }]\n' +
        '    // Se pedidos_carteira: "pedidos_carteira": [{ "cliente": string, "segmento": string, "mes": string, "ano": number, "valor": number }]\n' +
        '    // Se relatorio_vendas_semanal: "relatorio_vendas_semanal": [{ "periodo_rotulo": string, "periodo": string, "tipo_bloco": string, "canal": string, "vendedor": string, "carteira": string, "planejado": number, "realizado": number }]\n' +
        '  }\n' +
        '}\n\n' +
        'DADOS PARA ANÁLISE:\n'

      var payloadForAi = ''
      if (hasRows) {
        // Enviar amostra de linhas e cabeçalhos
        payloadForAi +=
          'FORMATO: PLANILHA ESTRUTURADA (' + clientRows.length + ' linhas no total)\n'
        payloadForAi +=
          'AMOSTRA DAS PRIMEIRAS LINHAS:\n' + JSON.stringify(clientRows.slice(0, 30), null, 2)
      } else {
        payloadForAi += 'FORMATO: DOCUMENTO TEXTO / PDF:\n' + textForAnalysis.slice(0, 15000)
      }

      var parsedResult = null

      try {
        var aiRes = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um assistente de inteligência de dados corporativos da Blink Biotech. Retorne EXCLUSIVAMENTE JSON válido sem formatação markdown ou explicações.',
            },
            {
              role: 'user',
              content: aiPrompt + '\n\n' + payloadForAi,
            },
          ],
        })

        var content = ''
        if (aiRes && aiRes.choices && aiRes.choices[0] && aiRes.choices[0].message) {
          content = (aiRes.choices[0].message.content || '').trim()
        }

        if (content) {
          var str = content
          var firstBrace = str.indexOf('{')
          var lastBrace = str.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            str = str.substring(firstBrace, lastBrace + 1)
          }
          parsedResult = JSON.parse(str)
        }
      } catch (aiErr) {
        $app.logger().error('maestro_analyze: ai.chat error', 'error', String(aiErr))
      }

      // Fallback determinístico caso a IA falhe
      if (!parsedResult) {
        if (isAtendimentoPedidos) {
          parsedResult = {
            document_type: 'atendimento_pedidos',
            confidence: 0.95,
            summary: 'Relatório Atendimento a Pedidos identificado',
            preview_rows: [],
            data: { atendimento_pedidos: [] },
          }
        } else if (isMatrizVenda) {
          parsedResult = {
            document_type: 'matriz_venda',
            confidence: 0.9,
            summary: 'Relatório Matriz de Venda identificado',
            preview_rows: [],
            data: { matriz_venda: [] },
          }
        } else if (isPedidosCarteira) {
          parsedResult = {
            document_type: 'pedidos_carteira',
            confidence: 0.9,
            summary: 'Relatório Pedidos em Carteira identificado',
            preview_rows: [],
            data: { pedidos_carteira: [] },
          }
        } else if (isRelatorioSemanal) {
          parsedResult = {
            document_type: 'relatorio_vendas_semanal',
            confidence: 0.9,
            summary: 'Relatório de Vendas Semanal identificado',
            preview_rows: [],
            data: { relatorio_vendas_semanal: [] },
          }
        } else if (isDanfe) {
          parsedResult = {
            document_type: 'invoice_pdf',
            confidence: 0.85,
            summary: '1 nota fiscal identificada',
            preview_rows: [],
            data: { invoices: [] },
          }
        } else if (hasRows) {
          // Detectar colunas para inferir entre client_spreadsheet e sales_spreadsheet
          var firstRow = clientRows[0] || {}
          var rowKeysNorm = Object.keys(firstRow).map(function (k) {
            return String(k).toLowerCase()
          })
          var hasCnpj = rowKeysNorm.some(function (k) {
            return k.indexOf('cnpj') !== -1
          })
          var hasEmail = rowKeysNorm.some(function (k) {
            return k.indexOf('email') !== -1 || k.indexOf('e-mail') !== -1
          })
          var hasValor = rowKeysNorm.some(function (k) {
            return (
              k.indexOf('valor') !== -1 || k.indexOf('faturam') !== -1 || k.indexOf('total') !== -1
            )
          })
          var hasData = rowKeysNorm.some(function (k) {
            return (
              k.indexOf('data') !== -1 || k.indexOf('date') !== -1 || k.indexOf('period') !== -1
            )
          })

          if (hasData && hasValor) {
            parsedResult = {
              document_type: 'sales_spreadsheet',
              confidence: 0.8,
              summary: clientRows.length + ' linhas de vendas encontradas',
              preview_rows: clientRows.slice(0, 5),
              data: { sales: clientRows },
            }
          } else if (hasCnpj || hasEmail) {
            parsedResult = {
              document_type: 'client_spreadsheet',
              confidence: 0.8,
              summary: clientRows.length + ' clientes encontrados',
              preview_rows: clientRows.slice(0, 5),
              data: { clients: clientRows },
            }
          } else {
            parsedResult = {
              document_type: 'unknown',
              confidence: 0.4,
              summary: 'Planilha com colunas não categorizadas automaticamente',
              preview_rows: clientRows.slice(0, 5),
              data: {},
            }
          }
        } else {
          parsedResult = {
            document_type: 'unknown',
            confidence: 0.3,
            summary: 'Documento não identificado automaticamente',
            preview_rows: [],
            data: {},
          }
        }
      }

      // Assegurar campos obrigatórios e preview_rows consistentes
      var docType = parsedResult.document_type || 'unknown'
      var dataObj = parsedResult.data || {}
      var preview = parsedResult.preview_rows || []

      if (!Array.isArray(preview) || preview.length === 0) {
        if (
          docType === 'invoice_pdf' &&
          Array.isArray(dataObj.invoices) &&
          dataObj.invoices.length > 0
        ) {
          preview = dataObj.invoices.slice(0, 5)
        } else if (
          docType === 'client_spreadsheet' &&
          Array.isArray(dataObj.clients) &&
          dataObj.clients.length > 0
        ) {
          preview = dataObj.clients.slice(0, 5)
        } else if (
          docType === 'sales_spreadsheet' &&
          Array.isArray(dataObj.sales) &&
          dataObj.sales.length > 0
        ) {
          preview = dataObj.sales.slice(0, 5)
        } else if (
          docType === 'matriz_venda' &&
          Array.isArray(dataObj.matriz_venda) &&
          dataObj.matriz_venda.length > 0
        ) {
          preview = dataObj.matriz_venda.slice(0, 5)
        } else if (
          docType === 'pedidos_carteira' &&
          Array.isArray(dataObj.pedidos_carteira) &&
          dataObj.pedidos_carteira.length > 0
        ) {
          preview = dataObj.pedidos_carteira.slice(0, 5)
        } else if (
          docType === 'relatorio_vendas_semanal' &&
          Array.isArray(dataObj.relatorio_vendas_semanal) &&
          dataObj.relatorio_vendas_semanal.length > 0
        ) {
          preview = dataObj.relatorio_vendas_semanal.slice(0, 5)
        } else if (
          docType === 'atendimento_pedidos' &&
          Array.isArray(dataObj.atendimento_pedidos) &&
          dataObj.atendimento_pedidos.length > 0
        ) {
          preview = dataObj.atendimento_pedidos.slice(0, 5)
        }
      }

      return e.json(200, {
        success: true,
        file_id: fileId,
        mime_type: mimeType,
        document_type: docType,
        confidence: parsedResult.confidence || 0.9,
        summary: parsedResult.summary || '',
        preview_rows: preview,
        data: dataObj,
      })
    } catch (err) {
      $app.logger().error('maestro_analyze: fatal error', 'error', String(err))
      return e.json(500, { error: 'Erro inesperado ao analisar arquivo: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
