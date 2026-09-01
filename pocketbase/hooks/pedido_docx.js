// Generates a Sales Order (.docx) from pedido data and returns the binary document.
//
// POST /backend/v1/pedidos/docx
// Body: JSON representation of pedido
// Responds with .docx (Word) document with standard Word XML packaging.
//
// All helpers are inlined inside the callback (JSVM callbacks cannot see top-level declarations).

routerAdd(
  'POST',
  '/backend/v1/pedidos/docx',
  (e) => {
    function escXml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    function fmtBRL(val) {
      if (val == null || isNaN(val)) return 'R$ 0,00'
      var num = Number(val)
      var fixed = num.toFixed(2)
      var parts = fixed.split('.')
      var intPart = parts[0]
      var decPart = parts[1]
      // Add thousands separator
      var rgx = /(\d+)(\d{3})/
      while (rgx.test(intPart)) {
        intPart = intPart.replace(rgx, '$1.$2')
      }
      return 'R$ ' + intPart + ',' + decPart
    }

    function fmtPercent(val) {
      if (val == null || isNaN(val)) return '0,00%'
      var num = Number(val)
      return num.toFixed(2).replace('.', ',') + '%'
    }

    function fmtDateNow() {
      var d = new Date()
      var dd = String(d.getDate())
      if (dd.length < 2) dd = '0' + dd
      var mm = String(d.getMonth() + 1)
      if (mm.length < 2) mm = '0' + mm
      var yyyy = d.getFullYear()
      return dd + '/' + mm + '/' + yyyy
    }

    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    var data = e.requestInfo().body || {}

    var clienteNome = data.cliente_nome || '-'
    var clienteEmail = data.cliente_email || '-'
    var clienteDocumento = data.cliente_documento || '-'
    var clienteEndereco = data.cliente_endereco || '-'
    var solicitante =
      data.solicitante || (e.auth && (e.auth.getString('name') || e.auth.getString('email'))) || '-'

    var gestorTecnicoNome = data.gestor_tecnico_nome || '-'
    var vendedorNome = data.vendedor_nome || '-'

    var produtoCodigo = data.produto_codigo || '-'
    var produtoNome = data.produto_nome || '-'
    var produtoLinha = data.produto_linha || '-'
    var quantidade = Number(data.quantidade) || 1
    var precoLiquido = Number(data.preco_liquido) || 0
    var descontoPercent = Number(data.desconto_percent) || 0

    var estado = data.estado || '-'
    var especie = data.especie || '-'
    var modalidadeFrete = data.modalidade_frete || 'FOB'
    var fretePercentual = Number(data.frete_percentual) || 0
    var freteValor = Number(data.frete_valor) || 0

    var aliquotaIcms = Number(data.aliquota_icms) || 0
    var aliquotaPis = Number(data.aliquota_pis) || 0
    var aliquotaCofins = Number(data.aliquota_cofins) || 0
    var impostosAdicionais = Number(data.impostos_adicionais) || 0

    var precoBase =
      Number(data.preco_base) || quantidade * precoLiquido * (1 - descontoPercent / 100)
    var icmsValor = Number(data.icms_valor) || (precoBase * aliquotaIcms) / 100
    var pisValor = Number(data.pis_valor) || (precoBase * aliquotaPis) / 100
    var cofinsValor = Number(data.cofins_valor) || (precoBase * aliquotaCofins) / 100
    var precoFob =
      Number(data.preco_fob) || precoBase + icmsValor + pisValor + cofinsValor + impostosAdicionais
    var precoCif = Number(data.preco_cif) || precoFob + freteValor
    var totalGeral = Number(data.total_geral) || precoCif

    var canalVendas = data.canal_vendas || '-'
    var especieDestino = data.especie_destino || '-'
    var observacoes = data.observacoes || '-'
    var dataEmissao = fmtDateNow()

    // Build Word Processing ML Document (Word 2007+ XML format)
    var docXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
      '<w:body>\n' +
      // Title & Header band
      '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="100"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="C00000"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t>BLINK BIOTECH</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>PEDIDO DE VENDA</w:t></w:r>' +
      '<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t> — Data: ' +
      escXml(dataEmissao) +
      '</w:t></w:r></w:p>\n' +
      // Section 1: Dados do Cliente
      '<w:p><w:pPr><w:spacing w:before="200" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>1. DADOS DO CLIENTE</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Nome / Razão Social: </w:t></w:r><w:r><w:t>' +
      escXml(clienteNome) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>E-mail: </w:t></w:r><w:r><w:t>' +
      escXml(clienteEmail) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>CNPJ / CPF: </w:t></w:r><w:r><w:t>' +
      escXml(clienteDocumento) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Endereço de Entrega: </w:t></w:r><w:r><w:t>' +
      escXml(clienteEndereco) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Solicitante do Pedido: </w:t></w:r><w:r><w:t>' +
      escXml(solicitante) +
      '</w:t></w:r></w:p>\n' +
      // Section 2: Gestão Técnica e Comercial
      '<w:p><w:pPr><w:spacing w:before="200" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>2. GESTÃO TÉCNICA E COMERCIAL</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Gestor Técnico: </w:t></w:r><w:r><w:t>' +
      escXml(gestorTecnicoNome) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Vendedor Responsável: </w:t></w:r><w:r><w:t>' +
      escXml(vendedorNome) +
      '</w:t></w:r></w:p>\n' +
      // Section 3: Produto
      '<w:p><w:pPr><w:spacing w:before="200" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>3. ESPECIFICAÇÃO DO PRODUTO</w:t></w:r></w:p>\n' +
      // Tabela de produto
      '<w:tbl>\n' +
      '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      // Cabeçalho da tabela
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Código</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Produto</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1600" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Linha</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Qtd</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Preço Unit.</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Desc %</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Linha do produto
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(produtoCodigo) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(produtoNome) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(produtoLinha) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      quantidade +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoLiquido)) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(descontoPercent)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '</w:tbl>\n' +
      // Section 4: Impostos e Tributação
      '<w:p><w:pPr><w:spacing w:before="240" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>4. ENQUADRAMENTO FISCAL E TRIBUTOS</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Origem/Destino: </w:t></w:r><w:r><w:t>' +
      escXml(estado) +
      ' | Espécie Fiscal: ' +
      escXml(especie) +
      '</w:t></w:r></w:p>\n' +
      // Tabela de Impostos
      '<w:tbl>\n' +
      '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Tributo / Adicional</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Alíquota / Base</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Valor Calculado</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>ICMS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(aliquotaIcms)) +
      '</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(icmsValor)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>PIS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(aliquotaPis)) +
      '</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(pisValor)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>COFINS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(aliquotaCofins)) +
      '</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(cofinsValor)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>Impostos Adicionais</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Valor informado</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(impostosAdicionais)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '</w:tbl>\n' +
      // Section 5: Frete e Canal de Distribuição
      '<w:p><w:pPr><w:spacing w:before="240" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>5. LOGÍSTICA, CANAL E DESTINO</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Modalidade de Frete: </w:t></w:r><w:r><w:t>' +
      escXml(modalidadeFrete) +
      ' (' +
      escXml(fmtPercent(fretePercentual)) +
      ' - ' +
      escXml(fmtBRL(freteValor)) +
      ')</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Canal de Vendas: </w:t></w:r><w:r><w:t>' +
      escXml(canalVendas) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Espécie de Destino: </w:t></w:r><w:r><w:t>' +
      escXml(especieDestino) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Observações Comerciais: </w:t></w:r><w:r><w:t>' +
      escXml(observacoes) +
      '</w:t></w:r></w:p>\n' +
      // Section 6: Resumo Financeiro
      '<w:p><w:pPr><w:spacing w:before="240" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>6. RESUMO FINANCEIRO E CONDIÇÕES</w:t></w:r></w:p>\n' +
      '<w:tbl>\n' +
      '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr><w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Preço Base Líquido</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoBase)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>Preço FOB (Base + Impostos)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoFob)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>Preço CIF (FOB + Frete)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoCif)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2EFDA"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>TOTAL GERAL DO PEDIDO</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2EFDA"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="276A3C"/></w:rPr><w:t>' +
      escXml(fmtBRL(totalGeral)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '</w:tbl>\n' +
      // Section 7: Footer e Termos
      '<w:p><w:pPr><w:spacing w:before="360" w:after="80"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="7F7F7F"/></w:rPr><w:t>Blink Biotech - Inteligência Comercial</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="7F7F7F"/></w:rPr><w:t>Unidades: Hernandarias - PY | Indaiatuba - SP</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="7F7F7F"/></w:rPr><w:t>Atualização fiscal 28/05/2026 - Ronaldo Reis | Validade da proposta: 30 dias</w:t></w:r></w:p>\n' +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
      '</w:body></w:document>'

    // Build standard Single-File Word XML / OpenXML Document
    // Using WordprocessingML package format recognized by Microsoft Word, LibreOffice and Google Docs (.docx / .doc)
    var fullDocxXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<?mso-application progid="Word.Document"?>\n' +
      '<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml" ' +
      'xmlns:v="urn:schemas-microsoft-com:vml" ' +
      'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
      'xmlns:sl="http://schemas.microsoft.com/schemaLibrary/2003/core" ' +
      'xmlns:aml="http://schemas.microsoft.com/aml/2001/core" ' +
      'xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint" ' +
      'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:dt="uuid:C2F41010-65B3-11d1-A29F-00AA00C14882" ' +
      'w:macrosPresent="no" w:embeddedObjPresent="no" w:ocxPresent="no" xml:space="preserve">\n' +
      '<w:body>\n' +
      // Title & Logo
      '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="C00000"/><w:sz w:val="40"/></w:rPr><w:t>BLINK BIOTECH</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>PEDIDO DE VENDA</w:t></w:r>' +
      '<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>  —  Data: ' +
      escXml(dataEmissao) +
      '</w:t></w:r></w:p>\n' +
      // Section 1
      '<w:p><w:pPr><w:spacing w:before="160" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="22"/></w:rPr><w:t>1. DADOS DO CLIENTE</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Nome / Razão Social: </w:t></w:r><w:r><w:t>' +
      escXml(clienteNome) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>E-mail: </w:t></w:r><w:r><w:t>' +
      escXml(clienteEmail) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>CNPJ / CPF: </w:t></w:r><w:r><w:t>' +
      escXml(clienteDocumento) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Endereço de Entrega: </w:t></w:r><w:r><w:t>' +
      escXml(clienteEndereco) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Solicitante do Pedido: </w:t></w:r><w:r><w:t>' +
      escXml(solicitante) +
      '</w:t></w:r></w:p>\n' +
      // Section 2
      '<w:p><w:pPr><w:spacing w:before="160" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="22"/></w:rPr><w:t>2. GESTÃO TÉCNICA E COMERCIAL</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Gestor Técnico: </w:t></w:r><w:r><w:t>' +
      escXml(gestorTecnicoNome) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Vendedor Responsável: </w:t></w:r><w:r><w:t>' +
      escXml(vendedorNome) +
      '</w:t></w:r></w:p>\n' +
      // Section 3
      '<w:p><w:pPr><w:spacing w:before="160" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="22"/></w:rPr><w:t>3. ESPECIFICAÇÃO DO PRODUTO</w:t></w:r></w:p>\n' +
      '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Código</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Produto</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1600" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Linha</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Qtd</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Preço Unit.</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Desc %</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '<w:tr>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(produtoCodigo) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(produtoNome) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(produtoLinha) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      quantidade +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoLiquido)) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(descontoPercent)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr></w:tbl>\n' +
      // Section 4
      '<w:p><w:pPr><w:spacing w:before="160" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="22"/></w:rPr><w:t>4. ENQUADRAMENTO FISCAL E TRIBUTOS</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Origem/Destino: </w:t></w:r><w:r><w:t>' +
      escXml(estado) +
      ' | Espécie Fiscal: ' +
      escXml(especie) +
      '</w:t></w:r></w:p>\n' +
      '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Tributo / Adicional</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Alíquota / Base</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Valor Calculado</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>ICMS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(aliquotaIcms)) +
      '</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(icmsValor)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>PIS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(aliquotaPis)) +
      '</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(pisValor)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>COFINS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtPercent(aliquotaCofins)) +
      '</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(cofinsValor)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>Impostos Adicionais</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Valor informado</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(impostosAdicionais)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '</w:tbl>\n' +
      // Section 5
      '<w:p><w:pPr><w:spacing w:before="160" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="22"/></w:rPr><w:t>5. LOGÍSTICA, CANAL E DESTINO</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Modalidade de Frete: </w:t></w:r><w:r><w:t>' +
      escXml(modalidadeFrete) +
      ' (' +
      escXml(fmtPercent(fretePercentual)) +
      ' - ' +
      escXml(fmtBRL(freteValor)) +
      ')</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Canal de Vendas: </w:t></w:r><w:r><w:t>' +
      escXml(canalVendas) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Espécie de Destino: </w:t></w:r><w:r><w:t>' +
      escXml(especieDestino) +
      '</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Observações Comerciais: </w:t></w:r><w:r><w:t>' +
      escXml(observacoes) +
      '</w:t></w:r></w:p>\n' +
      // Section 6
      '<w:p><w:pPr><w:spacing w:before="160" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="22"/></w:rPr><w:t>6. RESUMO FINANCEIRO</w:t></w:r></w:p>\n' +
      '<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="EEEEEE"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr><w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Preço Base Líquido</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoBase)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>Preço FOB (Base + Impostos)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoFob)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:p><w:r><w:t>Preço CIF (FOB + Frete)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>' +
      escXml(fmtBRL(precoCif)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2EFDA"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>TOTAL GERAL DO PEDIDO</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2EFDA"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="276A3C"/></w:rPr><w:t>' +
      escXml(fmtBRL(totalGeral)) +
      '</w:t></w:r></w:p></w:tc></w:tr>\n' +
      '</w:tbl>\n' +
      // Footer
      '<w:p><w:pPr><w:spacing w:before="300" w:after="40"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="7F7F7F"/></w:rPr><w:t>Blink Biotech - Inteligência Comercial</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="30"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="7F7F7F"/></w:rPr><w:t>Unidades: Hernandarias - PY | Indaiatuba - SP</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="30"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="7F7F7F"/></w:rPr><w:t>Atualização fiscal 28/05/2026 - Ronaldo Reis | Validade da proposta: 30 dias</w:t></w:r></w:p>\n' +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
      '</w:body></w:wordDocument>'

    return e.blob(
      200,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fullDocxXml,
    )
  },
  $apis.requireAuth(),
)
