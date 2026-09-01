// pocketbase/hooks/parse_nf_pdf.js
// Endpoint: POST /backend/v1/parse-nf-pdf and OPTIONS handler
// Contract:
// Input: JSON { "pdf_url": "..." } or { "pdf_url": "...", "raw_text": "..." }
// Output: JSON structured DANFE representation with items and lots arrays.

routerAdd('OPTIONS', '/backend/v1/parse-nf-pdf', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  return e.noContent(204)
})

routerAdd(
  'POST',
  '/backend/v1/parse-nf-pdf',
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
      var pdfUrl = body.pdf_url || body.pdfUrl || ''
      var providedText = body.raw_text || body.text || ''

      if (!pdfUrl && !providedText) {
        return e.json(400, { error: 'URL do PDF e obrigatoria' })
      }

      var pdfText = providedText || ''

      // If PDF text was not provided directly in the request, attempt to fetch from pdfUrl
      if (!pdfText && pdfUrl) {
        try {
          // Check URL validity
          var lowerUrl = pdfUrl.toLowerCase()
          if (
            lowerUrl.indexOf('.pdf') === -1 &&
            lowerUrl.indexOf('application/pdf') === -1 &&
            lowerUrl.indexOf('/api/files/') === -1
          ) {
            return e.json(400, { error: 'Arquivo nao e um PDF valido' })
          }

          var res = $http.send({
            url: pdfUrl,
            method: 'GET',
            headers: {
              'User-Agent': 'Blink-CRM-NFParser/1.0',
            },
            timeout: 30,
          })

          if (res.statusCode >= 400) {
            $app
              .logger()
              .warn('parse-nf-pdf: download failed', 'status', res.statusCode, 'url', pdfUrl)
            return e.json(503, { error: 'Erro ao processar PDF. Tente novamente.' })
          }

          var rawBody = res.raw || ''
          // Basic extract of ASCII printable characters & parenthesis text
          var matches = rawBody.match(/\(([^()]{2,})\)/g) || []
          if (matches.length > 5) {
            var extracted = []
            for (var m = 0; m < matches.length; m++) {
              extracted.push(matches[m].slice(1, -1))
            }
            pdfText = extracted.join(' ')
          } else {
            // Filter printable chars
            var filtered = ''
            for (var c = 0; c < rawBody.length; c++) {
              var code = rawBody.charCodeAt(c)
              if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
                filtered += rawBody.charAt(c)
              }
            }
            pdfText = filtered
          }
        } catch (fetchErr) {
          $app.logger().error('parse-nf-pdf: fetch error', 'error', String(fetchErr))
          return e.json(503, { error: 'Erro ao processar PDF. Tente novamente.' })
        }
      }

      if (!pdfText || pdfText.trim().length < 10) {
        return e.json(503, { error: 'Erro ao processar PDF. Tente novamente.' })
      }

      // Helper parsing functions inside callback
      function parseNum(v) {
        if (typeof v === 'number') return isNaN(v) ? 0 : v
        if (!v) return 0
        var s = String(v).trim()
        // Remove currency symbols, non-numeric noise except dots and commas and minus
        s = s.replace(/R\$/gi, '').replace(/\s+/g, '')
        if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
          s = s.replace(/\./g, '').replace(',', '.')
        } else if (s.indexOf(',') !== -1) {
          s = s.replace(',', '.')
        }
        var n = parseFloat(s.replace(/[^\d.-]/g, ''))
        return isNaN(n) ? 0 : n
      }

      function cleanStr(s) {
        return s == null ? '' : String(s).trim()
      }

      function normalizeDate(val) {
        if (!val) return ''
        var s = String(val).trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
        var dmMatch = s.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/)
        if (dmMatch) {
          var day = dmMatch[1].padStart(2, '0')
          var month = dmMatch[2].padStart(2, '0')
          var year = dmMatch[3]
          if (year.length === 2) year = '20' + year
          return year + '-' + month + '-' + day
        }
        var parsed = new Date(s)
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().substring(0, 10)
        }
        return ''
      }

      // Call AI to parse DANFE with high precision
      var aiData = null
      var aiPrompt =
        'Você é um especialista em parsing e extração de Nota Fiscal Eletrônica DANFE brasileira.\n' +
        'Analise o texto extraído da DANFE e extraia TODOS os campos no formato JSON estruturado rigorosamente.\n' +
        'Regras essenciais:\n' +
        '- numero_nf: número da NF após N ou N° ou próximo ao topo direito\n' +
        '- serie: série da NF (ex: 1)\n' +
        '- chave_acesso: 44 dígitos numéricos\n' +
        '- data_emissao: data no formato AAAA-MM-DD\n' +
        '- natureza_operacao: texto da natureza de operação\n' +
        '- protocolo_autorizacao: protocolo de autorização de uso\n' +
        '- destinatario_nome: Razão Social / Nome do Destinatário\n' +
        '- destinatario_cnpj: CNPJ do Destinatário (XX.XXX.XXX/XXXX-XX)\n' +
        '- destinatario_ie: Inscrição Estadual do Destinatário\n' +
        '- destinatario_endereco: Endereço (logradouro e número)\n' +
        '- destinatario_bairro: Bairro / Distrito\n' +
        '- destinatario_cep: CEP do Destinatário (XX.XXX-XXX)\n' +
        '- destinatario_municipio: Município / Cidade do Destinatário\n' +
        '- destinatario_uf: UF (2 letras, ex: PR, SP, SC, MG, RS, GO, MT, MS)\n' +
        '- destinatario_fone: Telefone com DDD se presente\n' +
        '- bc_icms: base de cálculo do ICMS (número)\n' +
        '- valor_icms: valor do ICMS (número)\n' +
        '- valor_frete: valor do frete (número)\n' +
        '- valor_seguro: valor do seguro (número)\n' +
        '- desconto: valor do desconto (número)\n' +
        '- outras_despesas: outras despesas acessórias (número)\n' +
        '- valor_ipi: valor total de IPI (número)\n' +
        '- valor_total_produtos: valor total dos produtos (número)\n' +
        '- valor_total_nota: valor total da nota fiscal (número)\n' +
        '- frete_modalidade: CIF ou FOB\n' +
        '- volumes_quantidade: quantidade de volumes / paletes (número)\n' +
        '- volumes_especie: espécie dos volumes (ex: palete, Paletes, caixas, volumes, SC)\n' +
        '- peso_bruto: peso bruto em Kg (número)\n' +
        '- peso_liquido: peso líquido em Kg (número)\n' +
        '- fatura_numero: número da fatura/duplicata\n' +
        '- fatura_vencimento: data de vencimento (AAAA-MM-DD)\n' +
        '- fatura_valor: valor da fatura (número)\n' +
        '- ordem_compra: número/texto da ordem de compra se presente em informações complementares\n' +
        '- valor_aproximado_tributos: valor aproximado dos tributos (número)\n' +
        '- itens: array de produtos com:\n' +
        '  produto_codigo (código do produto, frequentemente começando com BPM ou similar),\n' +
        '  produto_descricao (descrição do produto),\n' +
        '  produto_ncm (código NCM),\n' +
        '  produto_cst (código CST),\n' +
        '  produto_cfop (código CFOP),\n' +
        '  produto_unidade (unidade de medida ex: KG, UN, SC),\n' +
        '  produto_quantidade (número),\n' +
        '  produto_valor_unitario (número),\n' +
        '  produto_valor_total (número),\n' +
        '  bc_icms (número),\n' +
        '  valor_icms (número),\n' +
        '  aliq_icms (número),\n' +
        '  valor_ipi (número),\n' +
        '  aliq_ipi (número),\n' +
        '  lotes: array de objetos { lote_codigo: string, lote_quantidade: number }\n' +
        'Retorne SOMENTE JSON puro, sem markdown nem explicações.\n\n' +
        'TEXTO DA DANFE:\n' +
        pdfText.substring(0, 16000)

      try {
        var aiRes = $ai.chat({
          model: 'fast',
          messages: [
            {
              role: 'system',
              content:
                'Você é um motor de parsing de DANFE / Nota Fiscal Eletrônica. Responda exclusivamente com JSON puro.',
            },
            { role: 'user', content: aiPrompt },
          ],
        })

        var content = ''
        if (aiRes && aiRes.choices && aiRes.choices[0] && aiRes.choices[0].message) {
          content = aiRes.choices[0].message.content || ''
        }

        if (content) {
          var str = content.trim()
          var first = str.indexOf('{')
          var last = str.lastIndexOf('}')
          if (first !== -1 && last !== -1 && last > first) {
            str = str.substring(first, last + 1)
          }
          aiData = JSON.parse(str)
        }
      } catch (aiErr) {
        $app.logger().error('parse-nf-pdf: erro ai.chat', 'error', String(aiErr))
      }

      // Regex fallback rules if AI failed or missed key fields
      var numeroNf = aiData && aiData.numero_nf ? cleanStr(aiData.numero_nf) : ''
      if (!numeroNf) {
        var mNum = pdfText.match(/N[º°\.\s]+([0-9]{1,9})/i)
        if (mNum) numeroNf = mNum[1]
      }

      var serie = aiData && aiData.serie ? cleanStr(aiData.serie) : '1'
      var chaveAcesso = aiData && aiData.chave_acesso ? cleanStr(aiData.chave_acesso) : ''
      if (!chaveAcesso) {
        var mChave = pdfText.match(
          /(\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i,
        )
        if (mChave) chaveAcesso = mChave[1].replace(/\s+/g, '')
        else {
          var mChave44 = pdfText.match(/\b\d{44}\b/)
          if (mChave44) chaveAcesso = mChave44[0]
        }
      }

      var dataEmissao = aiData && aiData.data_emissao ? normalizeDate(aiData.data_emissao) : ''
      if (!dataEmissao) {
        var mDate = pdfText.match(/EMISS[ÃA]O:?\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i)
        if (mDate) {
          dataEmissao = normalizeDate(mDate[1])
        }
      }
      if (!dataEmissao) {
        var anyDate = pdfText.match(/\b([0-9]{2}\/[0-9]{2}\/[0-9]{4})\b/)
        if (anyDate) {
          dataEmissao = normalizeDate(anyDate[1])
        }
      }
      if (!dataEmissao) {
        dataEmissao = new Date().toISOString().substring(0, 10)
      }

      var destinatarioNome =
        aiData &&
        (aiData.destinatario_nome ||
          aiData.cliente_nome ||
          (aiData.cliente && aiData.cliente.razao_social))
          ? cleanStr(
              aiData.destinatario_nome ||
                aiData.cliente_nome ||
                (aiData.cliente && aiData.cliente.razao_social),
            )
          : ''

      var destinatarioCnpj =
        aiData &&
        (aiData.destinatario_cnpj || aiData.cliente_cnpj || (aiData.cliente && aiData.cliente.cnpj))
          ? cleanStr(
              aiData.destinatario_cnpj ||
                aiData.cliente_cnpj ||
                (aiData.cliente && aiData.cliente.cnpj),
            )
          : ''

      var valorTotalNota =
        aiData && aiData.valor_total_nota != null
          ? parseNum(aiData.valor_total_nota)
          : aiData && aiData.valores && aiData.valores.valor_total_nota != null
            ? parseNum(aiData.valores.valor_total_nota)
            : 0

      if (valorTotalNota <= 0) {
        var mVal = pdfText.match(/VALOR TOTAL(?:\s+DA NOTA)?\s*:?\s*R?\$?\s*([\d\.,]+)/i)
        if (mVal) valorTotalNota = parseNum(mVal[1])
      }

      var valorTotalProdutos =
        aiData && aiData.valor_total_produtos != null
          ? parseNum(aiData.valor_total_produtos)
          : aiData && aiData.valores && aiData.valores.valor_total_produtos != null
            ? parseNum(aiData.valores.valor_total_produtos)
            : valorTotalNota

      // Process items and sub-lots
      var rawItens = (aiData && (aiData.itens || aiData.produtos)) || []
      var itens = []
      var allLotes = []

      for (var i = 0; i < rawItens.length; i++) {
        var it = rawItens[i]
        var cod = cleanStr(it.produto_codigo || it.codigo || it.codigo_produto || 'BPMI')
        var desc = cleanStr(it.produto_descricao || it.descricao || it.nome || 'Produto ' + (i + 1))
        var qtd = parseNum(it.produto_quantidade || it.quantidade || 1)
        var unit = parseNum(it.produto_valor_unitario || it.valor_unitario || 0)
        var tot = parseNum(
          it.produto_valor_total || it.valor_total || it.valor_total_item || qtd * unit,
        )

        var lotesDoItem = []
        if (Array.isArray(it.lotes)) {
          for (var l = 0; l < it.lotes.length; l++) {
            var lot = it.lotes[l]
            var lCod = cleanStr(lot.lote_codigo || lot.codigo || lot.lote || '')
            var lQtd = parseNum(lot.lote_quantidade || lot.quantidade || lot.qtde || qtd)
            if (lCod) {
              lotesDoItem.push({
                lote_codigo: lCod,
                lote_quantidade: lQtd,
              })
              allLotes.push({
                item_index: i,
                produto_codigo: cod,
                lote_codigo: lCod,
                lote_quantidade: lQtd,
              })
            }
          }
        } else if (it.lote) {
          var lStr = cleanStr(it.lote)
          var lMatch = lStr.match(/(?:Lote:?\s*)?([A-Z0-9\.\-_]+)(?:.*?Qtde:?\s*([\d\.,]+))?/i)
          if (lMatch) {
            var codL = lMatch[1]
            var qtdL = lMatch[2] ? parseNum(lMatch[2]) : qtd
            lotesDoItem.push({ lote_codigo: codL, lote_quantidade: qtdL })
            allLotes.push({
              item_index: i,
              produto_codigo: cod,
              lote_codigo: codL,
              lote_quantidade: qtdL,
            })
          }
        }

        itens.push({
          produto_codigo: cod,
          produto_descricao: desc,
          produto_ncm: cleanStr(it.produto_ncm || it.ncm || ''),
          produto_cst: cleanStr(it.produto_cst || it.cst || ''),
          produto_cfop: cleanStr(it.produto_cfop || it.cfop || ''),
          produto_unidade: cleanStr(it.produto_unidade || it.unidade || 'KG'),
          produto_quantidade: qtd,
          produto_valor_unitario: unit,
          produto_valor_total: tot,
          bc_icms: parseNum(it.bc_icms),
          valor_icms: parseNum(it.valor_icms),
          aliq_icms: parseNum(it.aliq_icms),
          valor_ipi: parseNum(it.valor_ipi),
          aliq_ipi: parseNum(it.aliq_ipi),
          lotes: lotesDoItem,
        })
      }

      if (itens.length === 0) {
        itens.push({
          produto_codigo: 'BPMI.001',
          produto_descricao: 'Produtos da NF ' + (numeroNf || ''),
          produto_ncm: '2309.90.90',
          produto_cst: '100',
          produto_cfop: '6102',
          produto_unidade: 'KG',
          produto_quantidade: 1,
          produto_valor_unitario: valorTotalNota,
          produto_valor_total: valorTotalNota,
          bc_icms: 0,
          valor_icms: 0,
          aliq_icms: 0,
          valor_ipi: 0,
          aliq_ipi: 0,
          lotes: [],
        })
      }

      // Extract transport / volumes
      var freteModalidade = 'CIF'
      if (aiData && aiData.frete_modalidade) {
        var fMod = cleanStr(aiData.frete_modalidade).toUpperCase()
        if (fMod.indexOf('FOB') !== -1) freteModalidade = 'FOB'
      }

      var volumesQtd = aiData ? parseNum(aiData.volumes_quantidade) : 0
      var volumesEsp =
        aiData && aiData.volumes_especie ? cleanStr(aiData.volumes_especie) : 'palete'
      if (!volumesQtd) {
        var mPalete = pdfText.match(/(\d+)\s*(?:palete|Paletes|Volumes|caixas|SC)/i)
        if (mPalete) volumesQtd = parseNum(mPalete[1])
      }

      var pesoBruto = aiData ? parseNum(aiData.peso_bruto) : 0
      var pesoLiquido = aiData ? parseNum(aiData.peso_liquido) : 0

      // Complementary / Purchase Order
      var ordemCompra = aiData && aiData.ordem_compra ? cleanStr(aiData.ordem_compra) : ''
      if (!ordemCompra) {
        var mOc = pdfText.match(/ORDEM DE COMPRA\s*:?\s*([A-Z0-9\-_]+)/i)
        if (mOc) ordemCompra = mOc[0]
      }

      var resultado = {
        // Bloco A — Cabeçalho
        numero_nf: numeroNf,
        serie: serie,
        data_emissao: dataEmissao,
        chave_acesso: chaveAcesso,
        natureza_operacao:
          aiData && aiData.natureza_operacao
            ? cleanStr(aiData.natureza_operacao)
            : 'Venda Mercadoria',
        protocolo_autorizacao:
          aiData && aiData.protocolo_autorizacao ? cleanStr(aiData.protocolo_autorizacao) : '',
        valor_total_nota: valorTotalNota,
        valor_total_produtos: valorTotalProdutos,
        valor_aproximado_tributos: aiData ? parseNum(aiData.valor_aproximado_tributos) : 0,

        // Bloco B — Destinatário
        destinatario_nome: destinatarioNome || 'Cliente Não Identificado',
        destinatario_cnpj: destinatarioCnpj,
        destinatario_ie:
          aiData &&
          (aiData.destinatario_ie || (aiData.cliente && aiData.cliente.inscricao_estadual))
            ? cleanStr(aiData.destinatario_ie || aiData.cliente.inscricao_estadual)
            : '',
        destinatario_endereco:
          aiData && (aiData.destinatario_endereco || (aiData.cliente && aiData.cliente.endereco))
            ? cleanStr(aiData.destinatario_endereco || aiData.cliente.endereco)
            : '',
        destinatario_bairro:
          aiData &&
          (aiData.destinatario_bairro || (aiData.cliente && aiData.cliente.bairro_distrito))
            ? cleanStr(aiData.destinatario_bairro || aiData.cliente.bairro_distrito)
            : '',
        destinatario_cep:
          aiData && (aiData.destinatario_cep || (aiData.cliente && aiData.cliente.cep))
            ? cleanStr(aiData.destinatario_cep || aiData.cliente.cep)
            : '',
        destinatario_municipio:
          aiData &&
          (aiData.destinatario_municipio ||
            (aiData.cliente && (aiData.cliente.municipio || aiData.cliente.cidade)))
            ? cleanStr(
                aiData.destinatario_municipio || aiData.cliente.municipio || aiData.cliente.cidade,
              )
            : '',
        destinatario_uf:
          aiData && (aiData.destinatario_uf || (aiData.cliente && aiData.cliente.uf))
            ? cleanStr(aiData.destinatario_uf || aiData.cliente.uf).toUpperCase()
            : '',
        destinatario_fone:
          aiData && (aiData.destinatario_fone || (aiData.cliente && aiData.cliente.fone))
            ? cleanStr(aiData.destinatario_fone || aiData.cliente.fone)
            : '',

        // Bloco C — Impostos e Frete
        bc_icms: aiData
          ? parseNum(aiData.bc_icms || (aiData.valores && aiData.valores.base_calculo_icms))
          : 0,
        valor_icms: aiData
          ? parseNum(aiData.valor_icms || (aiData.valores && aiData.valores.valor_icms))
          : 0,
        valor_frete: aiData
          ? parseNum(aiData.valor_frete || (aiData.valores && aiData.valores.valor_frete))
          : 0,
        valor_seguro: aiData
          ? parseNum(aiData.valor_seguro || (aiData.valores && aiData.valores.valor_seguro))
          : 0,
        desconto: aiData
          ? parseNum(aiData.desconto || (aiData.valores && aiData.valores.desconto))
          : 0,
        outras_despesas: aiData
          ? parseNum(aiData.outras_despesas || (aiData.valores && aiData.valores.outras_despesas))
          : 0,
        valor_ipi: aiData
          ? parseNum(aiData.valor_ipi || (aiData.valores && aiData.valores.valor_ipi))
          : 0,
        frete_modalidade: freteModalidade,
        volumes_quantidade: volumesQtd,
        volumes_especie: volumesEsp,
        peso_bruto: pesoBruto,
        peso_liquido: pesoLiquido,
        fatura_numero:
          aiData && (aiData.fatura_numero || (aiData.fatura && aiData.fatura.numero))
            ? cleanStr(aiData.fatura_numero || aiData.fatura.numero)
            : '',
        fatura_vencimento:
          aiData && (aiData.fatura_vencimento || (aiData.fatura && aiData.fatura.vencimento))
            ? normalizeDate(aiData.fatura_vencimento || aiData.fatura.vencimento)
            : '',
        fatura_valor: aiData
          ? parseNum(aiData.fatura_valor || (aiData.fatura && aiData.fatura.valor))
          : valorTotalNota,
        ordem_compra: ordemCompra,

        // Bloco E — Itens & Lotes
        itens: itens,
        lotes: allLotes,
      }

      return e.json(200, resultado)
    } catch (err) {
      $app.logger().error('parse-nf-pdf: erro fatal', 'error', String(err))
      return e.json(503, { error: 'Erro ao processar PDF. Tente novamente.' })
    }
  },
  $apis.requireAuth(),
)
