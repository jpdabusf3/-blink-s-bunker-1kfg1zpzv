// pocketbase/hooks/parse_nf_pdf.js
// Endpoint: POST /backend/v1/parse-nf-pdf and OPTIONS handler
// Contract:
// Input: JSON { "pdf_url": "...", "raw_text": "..." }
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
          var matches = rawBody.match(/\(([^()]{2,})\)/g) || []
          if (matches.length > 5) {
            var extracted = []
            for (var m = 0; m < matches.length; m++) {
              extracted.push(matches[m].slice(1, -1))
            }
            pdfText = extracted.join(' ')
          } else {
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

      // Log total characters of raw text (FIX 1.1)
      var rawCharCount = pdfText ? pdfText.length : 0
      $app.logger().info('parse-nf-pdf: raw text extracted', 'charCount', rawCharCount)

      if (!pdfText || pdfText.trim().length < 10) {
        return e.json(503, { error: 'Erro ao processar PDF. Tente novamente.' })
      }

      // ----------------------------------------------------
      // FIX 1.2: Pipeline de limpeza de texto
      // ----------------------------------------------------
      function cleanDanfeText(raw) {
        if (!raw) return ''
        var s = String(raw)

        // 1. Remova bytes nulos, form feed (\f) e outros caracteres de controle não imprimíveis,
        // exceto nova linha (\n) e tab (\t).
        s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

        // 5. Normalize Unicode: ligaduras, aspas inteligentes, traços especiais
        s = s
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2013\u2014\u2015]/g, '-')
          .replace(/\u00A0/g, ' ')
          .replace(/[\uFB00]/g, 'ff')
          .replace(/[\uFB01]/g, 'fi')
          .replace(/[\uFB02]/g, 'fl')
          .replace(/[\uFB03]/g, 'ffi')
          .replace(/[\uFB04]/g, 'ffl')

        // 4. Limpar caracteres corrompidos / ruído entre letras tipo "UMuMbMe" quando em labels
        s = s.replace(
          /N\s*O\s*M\s*E\s*[\/\-]\s*R\s*A\s*Z\s*[AÃ]\s*O\s*S\s*O\s*C\s*I\s*A\s*L/gi,
          'NOME / RAZAO SOCIAL',
        )
        s = s.replace(/R\s*A\s*Z\s*[AÃ]\s*O\s*S\s*O\s*C\s*I\s*A\s*L/gi, 'RAZAO SOCIAL')
        s = s.replace(/C\s*N\s*P\s*J\s*[\/\-]\s*C\s*P\s*F/gi, 'CNPJ / CPF')
        s = s.replace(/D\s*A\s*D\s*O\s*S\s*D\s*O\s*P\s*R\s*O\s*D\s*U\s*T\s*O/gi, 'DADOS DO PRODUTO')
        s = s.replace(
          /C\s*[AÁ]\s*L\s*C\s*U\s*L\s*O\s*D\s*O\s*I\s*M\s*P\s*O\s*S\s*T\s*O/gi,
          'CALCULO DO IMPOSTO',
        )

        // 2 & 3 & 6. Quebrar linhas, trimar cada linha, normalizar múltiplos espaços e múltiplas quebras
        var lines = s.split(/\r?\n/)
        var cleanedLines = []
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].replace(/[ \t]+/g, ' ').trim()
          if (line.length > 0) {
            cleanedLines.push(line)
          }
        }

        return cleanedLines.join('\n')
      }

      var cleanedText = cleanDanfeText(pdfText)
      var warnings = []
      var extractionMethod = {}

      // FIX 1.3: Detecção de problema de encoding
      function detectEncodingCorruption(text) {
        // Se encontrar padrões não naturais como UMuMbMe frequentes
        var pattern = /\b[A-Z][a-z][A-Z][a-z][A-Z][a-z]\b/g
        var m = text.match(pattern)
        return m && m.length > 2
      }

      if (detectEncodingCorruption(cleanedText)) {
        warnings.push(
          'Possivel problema de encoding detectado no documento. Campos podem requerer revisao manual.',
        )
      }

      // ----------------------------------------------------
      // FIX 3.1: Parsing de Valores Monetários (parseNum)
      // ----------------------------------------------------
      function parseNum(v) {
        if (typeof v === 'number') return isNaN(v) ? 0 : v
        if (v == null) return 0
        var s = String(v).trim()
        if (s.length === 0) return 0

        // 2. Remova prefixo R$ se presente
        s = s.replace(/R\$/gi, '').trim()
        // 3. Remova todos os espaços
        s = s.replace(/\s+/g, '')
        if (s.length === 0) return 0

        var hasDot = s.indexOf('.') !== -1
        var hasComma = s.indexOf(',') !== -1

        if (hasDot && hasComma) {
          // 4. Contém ponto E vírgula: ponto é separador de milhar, vírgula é decimal
          s = s.replace(/\./g, '').replace(',', '.')
        } else if (hasComma) {
          // 5. Contém apenas vírgula: vírgula é decimal
          s = s.replace(',', '.')
        } else if (hasDot) {
          // 6. Contém apenas ponto:
          // Se há exatamente 2 dígitos após o último ponto (ex.: "8.50" = 8.50)
          var lastDotIdx = s.lastIndexOf('.')
          var decimals = s.substring(lastDotIdx + 1)
          if (decimals.length === 2 || (decimals.length === 1 && /^\d+$/.test(decimals))) {
            // Decimal float (ex: 8.50 ou 8.5)
          } else if (decimals.length === 3 && /^\d{3}$/.test(decimals)) {
            // Separador de milhar (ex.: "9.000" = 9000, "371.031" = 371031)
            s = s.replace(/\./g, '')
          } else {
            // Default: manter como float
          }
        }

        var cleanNumeric = s.replace(/[^\d.-]/g, '')
        if (!cleanNumeric || cleanNumeric === '-' || cleanNumeric === '.') return 0
        var n = parseFloat(cleanNumeric)
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

      // ----------------------------------------------------
      // FIX 2: Extração do Número da NF
      // ----------------------------------------------------
      function extractNumeroNf(text) {
        var candidates = []

        // 1. Padrão "NF-e" ou "NFe" seguido de dígitos (3 a 9 dígitos)
        var m1 = text.match(
          /(?:NF-?e|NOTA\s+FISCAL\s+ELETR[OÔ]NICA)[^\d\n\r]{0,30}(?:N[º°\.\s]*)?0*(\d{3,9})\b/i,
        )
        if (m1 && m1[1]) {
          candidates.push({ val: m1[1], pattern: 'pattern_nfe' })
        }

        // 2. Padrão "NOTA FISCAL" seguido de dígitos (3 a 9 dígitos)
        var m2 = text.match(/NOTA\s+FISCAL[^\d\n\r]{0,30}(?:N[º°\.\s]*)?0*(\d{3,9})\b/i)
        if (m2 && m2[1]) {
          candidates.push({ val: m2[1], pattern: 'pattern_nota_fiscal' })
        }

        // 3. Padrão no cabeçalho do DANFE (DANFE seguido de número ou Nº 000.000.323)
        var m3 = text.match(
          /(?:DANFE|Documento\s+Auxiliar)[^\n\r]{0,100}?(?:N[º°\.\s]*)?0*(\d{3,9})\b/i,
        )
        if (m3 && m3[1]) {
          candidates.push({ val: m3[1], pattern: 'pattern_danfe_header' })
        }

        // 4. Padrão genérico N. 000.000.323 ou Nº 000000323
        var m4 = text.match(/N[º°\.\s]+(?:0+\.?)*(0*[1-9]\d{2,8})\b/i)
        if (m4 && m4[1]) {
          var numClean = m4[1].replace(/\./g, '').replace(/^0+/, '')
          if (numClean.length >= 3) {
            candidates.push({ val: numClean, pattern: 'pattern_numero_generic' })
          }
        }

        // 5. Padrão com zeros à esquerda no topo: "000323" ou "0000323" -> "323"
        var m5 = text.match(/\b0{2,6}([1-9]\d{2,8})\b/)
        if (m5 && m5[1]) {
          candidates.push({ val: m5[1], pattern: 'pattern_leading_zeros' })
        }

        // 6. Chave de acesso de 44 dígitos: os dígitos 26 a 34 representam o número da NF (9 dígitos)
        // Exemplo: 4126 0838 3486 3800 0433 5500 1000 0003 23... -> 000000323 -> 323
        var mChave =
          text.match(
            /\b\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b/,
          ) || text.match(/\b\d{44}\b/)
        if (mChave) {
          var cleanChave = mChave[0].replace(/\s+/g, '')
          if (cleanChave.length === 44) {
            var nfInChave = cleanChave.substring(25, 34) // 9 dígitos da NF
            var nfInChaveInt = parseInt(nfInChave, 10)
            if (nfInChaveInt >= 1 && nfInChaveInt <= 999999999) {
              candidates.push({ val: String(nfInChaveInt), pattern: 'chave_acesso_digits' })
            }
          }
        }

        for (var i = 0; i < candidates.length; i++) {
          var cand = candidates[i]
          var numVal = parseInt(cand.val, 10)
          if (!isNaN(numVal) && numVal >= 1 && numVal <= 999999999 && String(numVal).length >= 3) {
            return { val: String(numVal), pattern: cand.pattern }
          }
        }

        return null
      }

      // ----------------------------------------------------
      // FIX 5: Extração do Nome do Destinatário & CNPJ
      // ----------------------------------------------------
      function extractCnpj(text) {
        // Encontrar CNPJ padrão XX.XXX.XXX/XXXX-XX
        var m = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)
        if (m && m.length > 0) {
          // No DANFE o primeiro CNPJ costuma ser o emitente (Blink 38.348.638/0004-33)
          // e o segundo costuma ser o destinatário.
          for (var i = 0; i < m.length; i++) {
            if (m[i].indexOf('38.348.638') === -1) {
              return m[i]
            }
          }
          return m[0]
        }
        return ''
      }

      function extractDestinatarioNome(text, cnpjDest) {
        // 5.1 Busca pelo label "NOME / RAZAO SOCIAL" ou "RAZAO SOCIAL"
        var regexLabel =
          /(?:NOME\s*[\/\-]?\s*RAZ[AÃ]O\s+SOCIAL|RAZ[AÃ]O\s+SOCIAL)[^\n\r:]*[:\n\r\s]+([^\n\r]+)/gi
        var match
        while ((match = regexLabel.exec(text)) !== null) {
          var cand = match[1].trim()
          // Limpa caracteres não alfabéticos exceto espaços, hífens, pontos e &
          cand = cand
            .replace(/[^A-Za-zÀ-ÿ0-9\s\.\-&]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          // Ignorar se for o emitente "BLINK BIOSCIENCE"
          if (/BLINK\s+BIOSCIENCE/i.test(cand)) continue
          // Valide: no mínimo 2 palavras e no mínimo 10 caracteres
          var words = cand.split(/\s+/).filter(function (w) {
            return w.length > 1
          })
          var hasCorruptPattern = /[A-Z][a-z][A-Z][a-z]/.test(cand)
          if (words.length >= 2 && cand.length >= 10 && !hasCorruptPattern) {
            return { val: cand, pattern: 'label_razao_social' }
          }
        }

        // 5.2 Fallback baseado no CNPJ: texto na linha do CNPJ ou 1-2 linhas antes
        if (cnpjDest) {
          var lines = text.split(/\r?\n/)
          for (var l = 0; l < lines.length; l++) {
            if (lines[l].indexOf(cnpjDest) !== -1) {
              // Checar 1 e 2 linhas antes
              for (var prev = l - 1; prev >= Math.max(0, l - 3); prev--) {
                var prevLine = lines[prev]
                  .replace(/[^A-Za-zÀ-ÿ0-9\s\.\-&]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                if (prevLine.indexOf('DESTINAT') !== -1 || prevLine.indexOf('REMETENTE') !== -1)
                  continue
                if (/BLINK\s+BIOSCIENCE/i.test(prevLine)) continue
                var pWords = prevLine.split(/\s+/).filter(function (w) {
                  return w.length > 1
                })
                var pCorrupt = /[A-Z][a-z][A-Z][a-z]/.test(prevLine)
                if (pWords.length >= 2 && prevLine.length >= 8 && !pCorrupt) {
                  return { val: prevLine, pattern: 'cnpj_context_preceding_line' }
                }
              }
              // Checar se o nome está na mesma linha antes do CNPJ
              var parts = lines[l].split(cnpjDest)
              if (parts[0]) {
                var sameLineClean = parts[0]
                  .replace(/[^A-Za-zÀ-ÿ0-9\s\.\-&]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                if (!/BLINK\s+BIOSCIENCE/i.test(sameLineClean)) {
                  var sWords = sameLineClean.split(/\s+/).filter(function (w) {
                    return w.length > 1
                  })
                  if (
                    sWords.length >= 2 &&
                    sameLineClean.length >= 8 &&
                    !/[A-Z][a-z][A-Z][a-z]/.test(sameLineClean)
                  ) {
                    return { val: sameLineClean, pattern: 'cnpj_context_same_line' }
                  }
                }
              }
            }
          }
        }

        // Busca por nomes conhecidos como Feedpro, Nuttria, etc.
        var knownNames = [
          'Feedpro Science Nutrition Importadora e Exportadora Ltda',
          'Feedpro Science Nutrition',
          'Nuttria Nutricao Animal Ltda',
          'Nuttria Nutricao Animal',
        ]
        for (var k = 0; k < knownNames.length; k++) {
          if (new RegExp(knownNames[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) {
            return { val: knownNames[k], pattern: 'known_customer_match' }
          }
        }

        return null
      }

      // ----------------------------------------------------
      // FIX 6: Extração da UF
      // ----------------------------------------------------
      var VALID_UFS = [
        'AC',
        'AL',
        'AP',
        'AM',
        'BA',
        'CE',
        'DF',
        'ES',
        'GO',
        'MA',
        'MT',
        'MS',
        'MG',
        'PA',
        'PB',
        'PR',
        'PE',
        'PI',
        'RJ',
        'RN',
        'RS',
        'RO',
        'RR',
        'SC',
        'SP',
        'SE',
        'TO',
      ]

      function extractUf(text) {
        // 6.1 Buscar label UF perto da seção do destinatário / município
        // Encontrar seção DESTINATÁRIO / REMETENTE
        var destSectionMatch = text.match(
          /(?:DESTINAT[AÁ]RIO|REMETENTE)[\s\S]{1,800}?(?:CALCULO|C[AÁ]LCULO\s+DO\s+IMPOSTO|DADOS\s+DO\s+PRODUTO)/i,
        )
        var searchArea = destSectionMatch ? destSectionMatch[0] : text

        // Padrão: MUNICIPIO / CIDADE seguido de UF
        var mUfMun = searchArea.match(
          /(?:MUNIC[IÍ]PIO|CIDADE)[^\n\r]*[\n\r\s]+[A-Za-zÀ-ÿ\s\.\-]+(?:\s+|UF\s*:?\s*)([A-Z]{2})\b/i,
        )
        if (mUfMun && VALID_UFS.indexOf(mUfMun[1].toUpperCase()) !== -1) {
          return { val: mUfMun[1].toUpperCase(), pattern: 'destinatario_municipio_uf_label' }
        }

        // Padrão: label UF: XX ou UF XX
        var mUfDirect = searchArea.match(/\bUF\s*:?\s*([A-Z]{2})\b/i)
        if (mUfDirect && VALID_UFS.indexOf(mUfDirect[1].toUpperCase()) !== -1) {
          return { val: mUfDirect[1].toUpperCase(), pattern: 'destinatario_uf_label' }
        }

        // 6.2 Fallback baseado em contexto de cidades conhecidas
        if (
          /S[aã]o\s+Jos[eé]\s+dos\s+Pinhais/i.test(text) ||
          /Curitiba/i.test(text) ||
          /Maring[aá]/i.test(text) ||
          /Londrina/i.test(text) ||
          /Cascavel/i.test(text) ||
          /Pato\s+Branco/i.test(text) ||
          /Toledo/i.test(text)
        ) {
          return { val: 'PR', pattern: 'city_context_pr' }
        }
        if (
          /Mirassol/i.test(text) ||
          /Indaiatuba/i.test(text) ||
          /Campinas/i.test(text) ||
          /S[aã]o\s+Paulo/i.test(text) ||
          /Ribeir[aã]o\s+Preto/i.test(text) ||
          /Sorocaba/i.test(text)
        ) {
          return { val: 'SP', pattern: 'city_context_sp' }
        }
        if (
          /Chapec[oó]/i.test(text) ||
          /Joinville/i.test(text) ||
          /Florian[oó]polis/i.test(text) ||
          /Crici[uú]ma/i.test(text)
        ) {
          return { val: 'SC', pattern: 'city_context_sc' }
        }
        if (
          /Passo\s+Fundo/i.test(text) ||
          /Porto\s+Alegre/i.test(text) ||
          /Caxias\s+do\s+Sul/i.test(text)
        ) {
          return { val: 'RS', pattern: 'city_context_rs' }
        }
        if (
          /Uberl[aâ]ndia/i.test(text) ||
          /Belo\s+Horizonte/i.test(text) ||
          /Contagem/i.test(text)
        ) {
          return { val: 'MG', pattern: 'city_context_mg' }
        }

        return null
      }

      // ----------------------------------------------------
      // FIX 3.2: Regexes de extração de valores monetários
      // ----------------------------------------------------
      function extractValores(text) {
        var moneyRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i

        function getValAfter(labelRegex) {
          var m = text.match(
            new RegExp(labelRegex.source + '[^\\d\\n\\r]{0,40}' + moneyRegex.source, 'i'),
          )
          if (m && m[1]) {
            return parseNum(m[1])
          }
          return 0
        }

        var valorTotalNota = getValAfter(/VALOR\s+TOTAL\s+DA\s+NOTA/i)
        if (valorTotalNota <= 0) {
          valorTotalNota = getValAfter(/V\.?\s*TOTAL\s+DA\s+NOTA/i)
        }
        if (valorTotalNota <= 0) {
          valorTotalNota = getValAfter(/VALOR\s+TOTAL/i)
        }

        var valorProdutos = getValAfter(/VALOR\s+DOS\s+PRODUTOS/i)
        if (valorProdutos <= 0) {
          valorProdutos = getValAfter(/V\.?\s*TOTAL\s+DOS\s+PRODUTOS/i)
        }

        var valorIcms = getValAfter(/VALOR\s+DO\s+ICMS/i)
        var bcIcms = getValAfter(/BASE\s+DE\s+C[AÁ]LCULO\s+DO\s+ICMS/i)
        var valorPis = getValAfter(/VALOR\s+DO\s+PIS/i)
        var valorCofins = getValAfter(/VALOR\s+DO\s+COFINS/i)
        var valorFrete = getValAfter(/VALOR\s+DO\s+FRETE/i)
        var valorSeguro = getValAfter(/VALOR\s+DO\s+SEGURO/i)
        var desconto = getValAfter(/DESCONTO/i)
        var outrasDespesas = getValAfter(/OUTRAS\s+DESPESAS/i)
        var valorIpi = getValAfter(/VALOR\s+DO\s+IPI/i)

        // FIX 3.3 Validação de valores:
        if (valorTotalNota <= 0 && valorProdutos > 0) {
          valorTotalNota = valorProdutos
        }

        return {
          valor_total_nota: valorTotalNota,
          valor_total_produtos: valorProdutos > 0 ? valorProdutos : valorTotalNota,
          valor_icms: valorIcms,
          bc_icms: bcIcms,
          valor_pis: valorPis,
          valor_cofins: valorCofins,
          valor_frete: valorFrete,
          valor_seguro: valorSeguro,
          desconto: desconto,
          outras_despesas: outrasDespesas,
          valor_ipi: valorIpi,
        }
      }

      // ----------------------------------------------------
      // FIX 4: Extração de Itens (multi-abordagem)
      // ----------------------------------------------------
      var KNOWN_PRODUCT_NAMES = [
        'Zinc',
        'Manganese',
        'Iron',
        'Copper',
        'Chromium',
        'Selenium',
        'Calcium',
        'Cobalt',
        'Magnesium',
        'Mycolink',
        'BetaLink',
        'Mos',
        'Lev',
        'Hydro',
        'Ycw',
        'Blend',
      ]

      function extractItensMultiStrategy(text) {
        var foundItens = []
        var strategyUsed = ''

        // Estratégia 1 — Padrão de código de produto Blink
        // Regex: BB[A-Z][A-Z]\.[A-Z][A-Z][0-9][0-9][0-9] ou BPMI.[A-Z0-9]+ ou BBMI.[A-Z0-9]+
        var blinkCodeRegex =
          /\b(B[BP][A-Z0-9]{2}\.[A-Z0-9]{5,8}|BPMI\.[A-Z0-9]+|BBMI\.[A-Z0-9]+|BBMY\.[A-Z0-9]+|BBMO\.[A-Z0-9]+)\b/g
        var codeMatches = []
        var match
        while ((match = blinkCodeRegex.exec(text)) !== null) {
          codeMatches.push({ code: match[1], index: match.index })
        }

        if (codeMatches.length > 0) {
          strategyUsed = 'blink_product_code_regex'
          for (var i = 0; i < codeMatches.length; i++) {
            var curr = codeMatches[i]
            var nextIndex = i + 1 < codeMatches.length ? codeMatches[i + 1].index : curr.index + 400
            var snippet = text.substring(curr.index, Math.min(text.length, nextIndex))

            // Extrair contexto: descrição, NCM (8 dig), CFOP (4 dig), CST (3 dig), QTD, UNIT, TOTAL
            var ncmMatch = snippet.match(/\b(\d{8})\b/)
            var cfopMatch = snippet.match(/\b([56]\d{3})\b/)
            var cstMatch = snippet.match(/\b([01]\d{2})\b/)

            // Descrição: texto após o código até números de NCM ou quantidade
            var desc = 'Produto ' + curr.code
            var descMatch = snippet
              .replace(curr.code, '')
              .match(
                /([A-Za-zÀ-ÿ0-9\s\.\-_]{3,50}?)(?=\d{8}|\bKG\b|\bSC\b|\bUN\b|\bTON\b|\d+,\d{2}|$)/,
              )
            if (descMatch && descMatch[1].trim().length > 2) {
              desc = descMatch[1].trim()
            }

            // Unidade
            var unMatch = snippet.match(/\b(KG|SC|UN|TON|L|CX)\b/i)
            var un = unMatch ? unMatch[1].toUpperCase() : 'KG'

            // Valores monetários e quantidade no snippet
            // Formatos comuns: 10.000,00 28,50 285.000,00
            var moneyMatches =
              snippet.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4})/g) || []
            var qtd = 1
            var unitPrice = 0
            var totPrice = 0

            if (moneyMatches.length >= 3) {
              qtd = parseNum(moneyMatches[0])
              unitPrice = parseNum(moneyMatches[1])
              totPrice = parseNum(moneyMatches[2])
            } else if (moneyMatches.length === 2) {
              qtd = parseNum(moneyMatches[0])
              totPrice = parseNum(moneyMatches[1])
              unitPrice = qtd > 0 ? totPrice / qtd : totPrice
            } else if (moneyMatches.length === 1) {
              totPrice = parseNum(moneyMatches[0])
              unitPrice = totPrice
            }

            // Lote
            var lotes = []
            var loteMatch = snippet.match(
              /(?:Lote:?\s*|LOTE:?\s*)([A-Z0-9\.\-_]+)(?:.*?Qtde:?\s*([\d\.,]+))?/i,
            )
            if (loteMatch) {
              lotes.push({
                lote_codigo: loteMatch[1],
                lote_quantidade: loteMatch[2] ? parseNum(loteMatch[2]) : qtd,
              })
            }

            foundItens.push({
              produto_codigo: curr.code,
              produto_descricao: desc,
              produto_ncm: ncmMatch ? ncmMatch[1] : '2309.90.90',
              produto_cst: cstMatch ? cstMatch[1] : '100',
              produto_cfop: cfopMatch ? cfopMatch[1] : '6102',
              produto_unidade: un,
              produto_quantidade: qtd,
              produto_valor_unitario: unitPrice,
              produto_valor_total: totPrice,
              bc_icms: 0,
              valor_icms: 0,
              aliq_icms: 0,
              valor_ipi: 0,
              aliq_ipi: 0,
              lotes: lotes,
            })
          }
        }

        // Estratégia 2 — Padrão por palavras-chave se Estratégia 1 encontrar menos que o esperado
        if (foundItens.length === 0) {
          for (var k = 0; k < KNOWN_PRODUCT_NAMES.length; k++) {
            var pName = KNOWN_PRODUCT_NAMES[k]
            var kwRegex = new RegExp('\\b(?:Blink\\s+)?' + pName + '(?:\\s+[A-Za-z0-9\\-]+)*', 'gi')
            var kwMatch
            while ((kwMatch = kwRegex.exec(text)) !== null) {
              var kwSnippet = text.substring(
                kwMatch.index,
                Math.min(text.length, kwMatch.index + 300),
              )
              var kwMoney =
                kwSnippet.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4})/g) || []
              var kQtd = 1
              var kUnit = 0
              var kTot = 0
              if (kwMoney.length >= 2) {
                kQtd = parseNum(kwMoney[0])
                kTot = parseNum(kwMoney[1])
                kUnit = kQtd > 0 ? kTot / kQtd : kTot
              }
              foundItens.push({
                produto_codigo: 'BPMI.' + pName.substring(0, 4).toUpperCase(),
                produto_descricao: kwMatch[0].trim(),
                produto_ncm: '2309.90.90',
                produto_cst: '100',
                produto_cfop: '6102',
                produto_unidade: 'KG',
                produto_quantidade: kQtd,
                produto_valor_unitario: kUnit,
                produto_valor_total: kTot,
                bc_icms: 0,
                valor_icms: 0,
                aliq_icms: 0,
                valor_ipi: 0,
                aliq_ipi: 0,
                lotes: [],
              })
            }
          }
          if (foundItens.length > 0) strategyUsed = 'known_keyword_search'
        }

        return { itens: foundItens, strategy: strategyUsed }
      }

      // ----------------------------------------------------
      // Executar Extração Determinística Primária
      // ----------------------------------------------------
      var detNum = extractNumeroNf(cleanedText)
      var numeroNf = detNum ? detNum.val : ''
      if (detNum) extractionMethod.numero_nf = detNum.pattern

      var destinatarioCnpj = extractCnpj(cleanedText)
      if (destinatarioCnpj) extractionMethod.destinatario_cnpj = 'regex_cnpj'

      var detDest = extractDestinatarioNome(cleanedText, destinatarioCnpj)
      var destinatarioNome = detDest ? detDest.val : ''
      if (detDest) extractionMethod.destinatario_nome = detDest.pattern

      var detUf = extractUf(cleanedText)
      var destinatarioUf = detUf ? detUf.val : ''
      if (detUf) extractionMethod.destinatario_uf = detUf.pattern

      var detValores = extractValores(cleanedText)
      var valorTotalNota = detValores.valor_total_nota
      var valorTotalProdutos = detValores.valor_total_produtos
      extractionMethod.valores = 'regex_monetary_extraction'

      var detItensResult = extractItensMultiStrategy(cleanedText)
      var itens = detItensResult.itens
      if (detItensResult.strategy) extractionMethod.itens = detItensResult.strategy

      // Chave de Acesso
      var chaveAcesso = ''
      var mChaveDet = cleanedText.match(
        /(\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i,
      )
      if (mChaveDet) {
        chaveAcesso = mChaveDet[1].replace(/\s+/g, '')
      } else {
        var mChave44Det = cleanedText.match(/\b\d{44}\b/)
        if (mChave44Det) chaveAcesso = mChave44Det[0]
      }

      // Data de Emissão
      var dataEmissao = ''
      var mDateDet = cleanedText.match(
        /EMISS[ÃA]O:?\s*([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4})/i,
      )
      if (mDateDet) {
        dataEmissao = normalizeDate(mDateDet[1])
      }
      if (!dataEmissao) {
        var anyDateDet = cleanedText.match(/\b([0-9]{2}\/[0-9]{2}\/[0-9]{4})\b/)
        if (anyDateDet) {
          dataEmissao = normalizeDate(anyDateDet[1])
        }
      }

      // ----------------------------------------------------
      // FIX 8.2: Orquestração de IA como Fallback Inteligente
      // Chamamos IA se faltar número da NF, destinatário, valor total ou se encontrar 0 itens
      // ----------------------------------------------------
      var needsAi = !numeroNf || !destinatarioNome || valorTotalNota <= 0 || itens.length === 0
      var aiData = null

      if (needsAi) {
        var aiPrompt =
          'Você é um especialista em parsing e extração de Nota Fiscal Eletrônica DANFE brasileira.\n' +
          'Analise o texto extraído da DANFE e extraia TODOS os campos no formato JSON estruturado rigorosamente.\n' +
          'Regras essenciais:\n' +
          '- numero_nf: número completo da NF (ex.: "323", "322", "324" - NUNCA retorne apenas o primeiro dígito)\n' +
          '- serie: série da NF (ex: "1")\n' +
          '- chave_acesso: 44 dígitos numéricos\n' +
          '- data_emissao: data no formato AAAA-MM-DD\n' +
          '- natureza_operacao: texto da natureza de operação\n' +
          '- protocolo_autorizacao: protocolo de autorização de uso\n' +
          '- destinatario_nome: Razão Social / Nome do Destinatário (limpo, sem corrupções tipo UMuMbMe)\n' +
          '- destinatario_cnpj: CNPJ do Destinatário (XX.XXX.XXX/XXXX-XX)\n' +
          '- destinatario_ie: Inscrição Estadual do Destinatário\n' +
          '- destinatario_endereco: Endereço\n' +
          '- destinatario_bairro: Bairro\n' +
          '- destinatario_cep: CEP do Destinatário (XX.XXX-XXX)\n' +
          '- destinatario_municipio: Município / Cidade do Destinatário\n' +
          '- destinatario_uf: UF (2 letras maiúsculas válidas: PR, SP, SC, RS, MG, etc.)\n' +
          '- destinatario_fone: Telefone\n' +
          '- bc_icms: base de cálculo do ICMS (número float)\n' +
          '- valor_icms: valor do ICMS (número float)\n' +
          '- valor_frete: valor do frete (número float)\n' +
          '- valor_seguro: valor do seguro (número float)\n' +
          '- desconto: valor do desconto (número float)\n' +
          '- outras_despesas: outras despesas acessórias (número float)\n' +
          '- valor_ipi: valor total de IPI (número float)\n' +
          '- valor_total_produtos: valor total dos produtos (número float não zero)\n' +
          '- valor_total_nota: valor total da nota fiscal (número float não zero)\n' +
          '- frete_modalidade: CIF ou FOB\n' +
          '- volumes_quantidade: quantidade de volumes (número)\n' +
          '- volumes_especie: espécie dos volumes (ex: palete, Paletes, caixas, volumes, SC)\n' +
          '- peso_bruto: peso bruto em Kg (número)\n' +
          '- peso_liquido: peso líquido em Kg (número)\n' +
          '- fatura_numero: número da fatura\n' +
          '- fatura_vencimento: data de vencimento (AAAA-MM-DD)\n' +
          '- fatura_valor: valor da fatura (número)\n' +
          '- ordem_compra: número/texto da ordem de compra\n' +
          '- itens: array de produtos com:\n' +
          '  produto_codigo (código do produto Blink ex: BPMI.OR005, BPMI.OR033, BBMO.BE001),\n' +
          '  produto_descricao (descrição do produto),\n' +
          '  produto_ncm (código NCM),\n' +
          '  produto_cst (código CST),\n' +
          '  produto_cfop (código CFOP),\n' +
          '  produto_unidade (unidade ex: KG, UN, SC),\n' +
          '  produto_quantidade (número float),\n' +
          '  produto_valor_unitario (número float),\n' +
          '  produto_valor_total (número float),\n' +
          '  bc_icms (número),\n' +
          '  valor_icms (número),\n' +
          '  aliq_icms (número),\n' +
          '  lotes: array de objetos { lote_codigo: string, lote_quantidade: number }\n' +
          'Retorne SOMENTE JSON puro, sem markdown nem explicações.\n\n' +
          'TEXTO DA DANFE:\n' +
          cleanedText

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
          $app.logger().error('parse-nf-pdf: erro ai.chat fallback', 'error', String(aiErr))
        }

        // Mesclar resultados da IA onde faltou no determinístico
        if (aiData) {
          if (!numeroNf && aiData.numero_nf) {
            var aiNum = cleanStr(aiData.numero_nf)
            if (aiNum.length >= 3 && parseInt(aiNum, 10) > 0) {
              numeroNf = aiNum
              extractionMethod.numero_nf = 'ai_fallback'
            }
          }
          if (!destinatarioNome && (aiData.destinatario_nome || aiData.cliente_nome)) {
            var aiName = cleanStr(aiData.destinatario_nome || aiData.cliente_nome)
            if (aiName.length >= 5 && !/[A-Z][a-z][A-Z][a-z]/.test(aiName)) {
              destinatarioNome = aiName
              extractionMethod.destinatario_nome = 'ai_fallback'
            }
          }
          if (!destinatarioCnpj && (aiData.destinatario_cnpj || aiData.cliente_cnpj)) {
            destinatarioCnpj = cleanStr(aiData.destinatario_cnpj || aiData.cliente_cnpj)
            extractionMethod.destinatario_cnpj = 'ai_fallback'
          }
          if (
            !destinatarioUf &&
            (aiData.destinatario_uf || (aiData.cliente && aiData.cliente.uf))
          ) {
            var aiUf = cleanStr(aiData.destinatario_uf || aiData.cliente.uf).toUpperCase()
            if (VALID_UFS.indexOf(aiUf) !== -1) {
              destinatarioUf = aiUf
              extractionMethod.destinatario_uf = 'ai_fallback'
            }
          }
          if (valorTotalNota <= 0 && aiData.valor_total_nota != null) {
            var aiVal = parseNum(aiData.valor_total_nota)
            if (aiVal > 0) {
              valorTotalNota = aiVal
              valorTotalProdutos = parseNum(aiData.valor_total_produtos) || aiVal
              extractionMethod.valores = 'ai_fallback'
            }
          }

          // Se itens determinísticos foram 0 ou insuficientes e a IA extraiu itens válidos
          var aiItens = aiData.itens || aiData.produtos || []
          if (itens.length === 0 && aiItens.length > 0) {
            var parsedAiItens = []
            for (var aiIdx = 0; aiIdx < aiItens.length; aiIdx++) {
              var aItem = aiItens[aiIdx]
              var aCod = cleanStr(aItem.produto_codigo || aItem.codigo || 'BPMI')
              var aDesc = cleanStr(
                aItem.produto_descricao ||
                  aItem.descricao ||
                  aItem.nome ||
                  'Produto ' + (aiIdx + 1),
              )
              var aQtd = parseNum(aItem.produto_quantidade || aItem.quantidade || 1)
              var aUnit = parseNum(aItem.produto_valor_unitario || aItem.valor_unitario || 0)
              var aTot = parseNum(aItem.produto_valor_total || aItem.valor_total || aQtd * aUnit)

              if (aDesc && aTot > 0) {
                parsedAiItens.push({
                  produto_codigo: aCod,
                  produto_descricao: aDesc,
                  produto_ncm: cleanStr(aItem.produto_ncm || aItem.ncm || '2309.90.90'),
                  produto_cst: cleanStr(aItem.produto_cst || aItem.cst || '100'),
                  produto_cfop: cleanStr(aItem.produto_cfop || aItem.cfop || '6102'),
                  produto_unidade: cleanStr(
                    aItem.produto_unidade || aItem.unidade || 'KG',
                  ).toUpperCase(),
                  produto_quantidade: aQtd,
                  produto_valor_unitario: aUnit,
                  produto_valor_total: aTot,
                  bc_icms: parseNum(aItem.bc_icms),
                  valor_icms: parseNum(aItem.valor_icms),
                  aliq_icms: parseNum(aItem.aliq_icms),
                  valor_ipi: parseNum(aItem.valor_ipi),
                  aliq_ipi: parseNum(aItem.aliq_ipi),
                  lotes: Array.isArray(aItem.lotes) ? aItem.lotes : [],
                })
              }
            }
            if (parsedAiItens.length > 0) {
              itens = parsedAiItens
              extractionMethod.itens = 'ai_fallback'
            }
          }
        }
      }

      // Validação final de campos
      if (!numeroNf || numeroNf.length < 3) {
        warnings.push('Numero da NF nao identificado com seguranca (minimo 3 digitos).')
      }
      if (
        !destinatarioNome ||
        destinatarioNome.length < 5 ||
        /[A-Z][a-z][A-Z][a-z]/.test(destinatarioNome)
      ) {
        warnings.push('Nome do destinatario requer revisao manual.')
      }
      if (valorTotalNota <= 0) {
        warnings.push('Valor total da nota fiscal e zero ou nao identificado.')
      }
      if (itens.length === 0) {
        warnings.push('Nenhum item de produto identificado na NF.')
        // Item fallback de emergência para não quebrar a tela
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

      // Consolidar lotes
      var allLotes = []
      for (var itIdx = 0; itIdx < itens.length; itIdx++) {
        var itObj = itens[itIdx]
        if (Array.isArray(itObj.lotes)) {
          for (var lIdx = 0; lIdx < itObj.lotes.length; lIdx++) {
            var lotObj = itObj.lotes[lIdx]
            if (lotObj && lotObj.lote_codigo) {
              allLotes.push({
                item_index: itIdx,
                produto_codigo: itObj.produto_codigo,
                lote_codigo: cleanStr(lotObj.lote_codigo),
                lote_quantidade: parseNum(lotObj.lote_quantidade || itObj.produto_quantidade),
              })
            }
          }
        }
      }

      if (!dataEmissao) {
        dataEmissao = new Date().toISOString().substring(0, 10)
      }

      var resultado = {
        success: true,
        warnings: warnings,
        rawTextLength: rawCharCount,
        extractionMethod: JSON.stringify(extractionMethod),

        // Bloco A — Cabeçalho
        numero_nf: numeroNf,
        serie: (aiData && aiData.serie) || '1',
        data_emissao: dataEmissao,
        chave_acesso: chaveAcesso,
        natureza_operacao: (aiData && aiData.natureza_operacao) || 'Venda Mercadoria',
        protocolo_autorizacao: (aiData && aiData.protocolo_autorizacao) || '',
        valor_total_nota: valorTotalNota,
        valor_total_produtos: valorTotalProdutos,
        valor_aproximado_tributos: aiData ? parseNum(aiData.valor_aproximado_tributos) : 0,

        // Bloco B — Destinatário
        destinatario_nome: destinatarioNome || 'Cliente Não Identificado',
        destinatario_cnpj: destinatarioCnpj,
        destinatario_ie:
          (aiData &&
            (aiData.destinatario_ie || (aiData.cliente && aiData.cliente.inscricao_estadual))) ||
          '',
        destinatario_endereco:
          (aiData &&
            (aiData.destinatario_endereco || (aiData.cliente && aiData.cliente.endereco))) ||
          '',
        destinatario_bairro:
          (aiData &&
            (aiData.destinatario_bairro || (aiData.cliente && aiData.cliente.bairro_distrito))) ||
          '',
        destinatario_cep:
          (aiData && (aiData.destinatario_cep || (aiData.cliente && aiData.cliente.cep))) || '',
        destinatario_municipio:
          (aiData &&
            (aiData.destinatario_municipio ||
              (aiData.cliente && (aiData.cliente.municipio || aiData.cliente.cidade)))) ||
          '',
        destinatario_uf: destinatarioUf || '',
        destinatario_fone:
          (aiData && (aiData.destinatario_fone || (aiData.cliente && aiData.cliente.fone))) || '',

        // Bloco C — Impostos e Frete
        bc_icms: detValores.bc_icms || (aiData ? parseNum(aiData.bc_icms) : 0),
        valor_icms: detValores.valor_icms || (aiData ? parseNum(aiData.valor_icms) : 0),
        valor_frete: detValores.valor_frete || (aiData ? parseNum(aiData.valor_frete) : 0),
        valor_seguro: detValores.valor_seguro || (aiData ? parseNum(aiData.valor_seguro) : 0),
        desconto: detValores.desconto || (aiData ? parseNum(aiData.desconto) : 0),
        outras_despesas:
          detValores.outras_despesas || (aiData ? parseNum(aiData.outras_despesas) : 0),
        valor_ipi: detValores.valor_ipi || (aiData ? parseNum(aiData.valor_ipi) : 0),
        frete_modalidade:
          aiData &&
          aiData.frete_modalidade &&
          String(aiData.frete_modalidade).toUpperCase().indexOf('FOB') !== -1
            ? 'FOB'
            : 'CIF',
        volumes_quantidade: aiData ? parseNum(aiData.volumes_quantidade) : 0,
        volumes_especie: (aiData && aiData.volumes_especie) || 'Paletes',
        peso_bruto: aiData ? parseNum(aiData.peso_bruto) : 0,
        peso_liquido: aiData ? parseNum(aiData.peso_liquido) : 0,
        fatura_numero:
          (aiData && (aiData.fatura_numero || (aiData.fatura && aiData.fatura.numero))) || '',
        fatura_vencimento: normalizeDate(
          aiData && (aiData.fatura_vencimento || (aiData.fatura && aiData.fatura.vencimento)),
        ),
        fatura_valor:
          aiData && aiData.fatura_valor != null ? parseNum(aiData.fatura_valor) : valorTotalNota,
        ordem_compra: (aiData && aiData.ordem_compra) || '',

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
