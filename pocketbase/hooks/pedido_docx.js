// Generates a Sales Order & Commercial Performance Report (.docx) from pedido data and returns the binary document.
//
// POST /backend/v1/pedidos/docx
// Body: JSON representation of pedido
// Responds with .docx (Word) document with standard WordprocessingML packaging.
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

    function pad(n, len) {
      var s = '' + n
      while (s.length < len) s = '0' + s
      return s
    }

    function fmtBRL(val) {
      if (val == null || isNaN(val)) return 'R$ 0,00'
      var num = Number(val)
      var fixed = Math.abs(num).toFixed(2)
      var parts = fixed.split('.')
      var intPart = parts[0]
      var decPart = parts[1]
      // Add thousands separator (period)
      var rgx = /(\d+)(\d{3})/
      while (rgx.test(intPart)) {
        intPart = intPart.replace(rgx, '$1.$2')
      }
      var sign = num < 0 ? '-' : ''
      return sign + 'R$ ' + intPart + ',' + decPart
    }

    function fmtPercent(val) {
      if (val == null || isNaN(val)) return '0,00%'
      var num = Number(val)
      return num.toFixed(2).replace('.', ',') + '%'
    }

    function fmtDateDDMMYYYY(d) {
      if (!d) d = new Date()
      if (typeof d === 'string') {
        var parsed = new Date(d)
        if (!isNaN(parsed.getTime())) d = parsed
        else d = new Date()
      }
      var dd = pad(d.getDate(), 2)
      var mm = pad(d.getMonth() + 1, 2)
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
    var dataEmissao = fmtDateDDMMYYYY(data.data_emissao || data.data || new Date())

    // Helper functions for WordprocessingML elements
    function pageBreak() {
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n'
    }

    function heading1(text) {
      return (
        '<w:p>' +
        '<w:pPr>' +
        '<w:pStyle w:val="Heading1"/>' +
        '<w:spacing w:before="240" w:after="120"/>' +
        '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C00000"/></w:pBdr>' +
        '</w:pPr>' +
        '<w:r>' +
        '<w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>' +
        '<w:t>' +
        escXml(text) +
        '</w:t>' +
        '</w:r>' +
        '</w:p>\n'
      )
    }

    function heading2(text) {
      return (
        '<w:p>' +
        '<w:pPr>' +
        '<w:pStyle w:val="Heading2"/>' +
        '<w:spacing w:before="160" w:after="80"/>' +
        '</w:pPr>' +
        '<w:r>' +
        '<w:rPr><w:b/><w:color w:val="595959"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>' +
        '<w:t>' +
        escXml(text) +
        '</w:t>' +
        '</w:r>' +
        '</w:p>\n'
      )
    }

    function metaRow(label, val) {
      return (
        '<w:p>' +
        '<w:pPr><w:spacing w:after="60"/></w:pPr>' +
        '<w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>' +
        escXml(label) +
        ': </w:t></w:r>' +
        '<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>' +
        escXml(val) +
        '</w:t></w:r>' +
        '</w:p>\n'
      )
    }

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
      '<w:styles>' +
      '<w:style w:type="paragraph" w:default="on" w:styleId="Normal">' +
      '<w:name w:val="Normal"/>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:sz w:val="22"/><w:lang w:val="PT-BR"/></w:rPr>' +
      '</w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1">' +
      '<w:name w:val="heading 1"/>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:b/><w:color w:val="1F497D"/><w:sz w:val="26"/><w:lang w:val="PT-BR"/></w:rPr>' +
      '</w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2">' +
      '<w:name w:val="heading 2"/>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:b/><w:color w:val="595959"/><w:sz w:val="22"/><w:lang w:val="PT-BR"/></w:rPr>' +
      '</w:style>' +
      '<w:style w:type="paragraph" w:styleId="Header">' +
      '<w:name w:val="header"/>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:sz w:val="16"/><w:color w:val="888888"/><w:lang w:val="PT-BR"/></w:rPr>' +
      '</w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer">' +
      '<w:name w:val="footer"/>' +
      '<w:rPr><w:rFonts w:ascii="Calibri" w:h-ansi="Calibri"/><w:sz w:val="18"/><w:color w:val="666666"/><w:lang w:val="PT-BR"/></w:rPr>' +
      '</w:style>' +
      '</w:styles>\n' +
      '<w:body>\n' +
      // ==========================================
      // PÁGINA 1: PÁGINA DE TÍTULO / CAPA
      // ==========================================
      '<w:p><w:pPr><w:spacing w:before="600" w:after="160"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="C00000"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr><w:t>Blink Biotech</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:before="120" w:after="240"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr><w:t>RELATORIO DE DESEMPENHO COMERCIAL</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:before="80" w:after="120"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>Emissão Oficial de Proposta Comercial e Pedido de Venda</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:before="60" w:after="480"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Data de Emissão: ' +
      escXml(dataEmissao) +
      '</w:t></w:r></w:p>\n' +
      // Bloco destacado com identificação na capa
      '<w:tbl>\n' +
      '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="6" w:space="0" w:color="C00000"/>' +
      '<w:left w:val="single" w:sz="6" w:space="0" w:color="C00000"/>' +
      '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="C00000"/>' +
      '<w:right w:val="single" w:sz="6" w:space="0" w:color="C00000"/>' +
      '<w:insideH w:val="none"/><w:insideV w:val="none"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F9FBFD"/><w:tcW w:w="9200" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1F497D"/></w:rPr><w:t>Cliente / Destinatário: </w:t></w:r><w:r><w:t>' +
      escXml(clienteNome) +
      '</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1F497D"/></w:rPr><w:t>Produto Principal: </w:t></w:r><w:r><w:t>' +
      escXml(produtoNome) +
      ' (' +
      escXml(produtoCodigo) +
      ')</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1F497D"/></w:rPr><w:t>Valor Total Geral: </w:t></w:r><w:r><w:rPr><w:b/><w:color w:val="276A3C"/></w:rPr><w:t>' +
      escXml(fmtBRL(totalGeral)) +
      '</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1F497D"/></w:rPr><w:t>Solicitante Responsável: </w:t></w:r><w:r><w:t>' +
      escXml(solicitante) +
      '</w:t></w:r></w:p>' +
      '</w:tc></w:tr></w:tbl>\n' +
      // ==========================================
      // SEÇÃO 1: RESUMO EXECUTIVO (Página 1)
      // ==========================================
      heading1('1. Resumo Executivo') +
      '<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:t>' +
      'Este relatório consolida a proposta comercial, parâmetros fiscais e projeção financeira para o fornecimento de insumos biotecnológicos de alta performance da Blink Biotech. Todos os cálculos de tributos, margens e logística foram homologados para garantir transparência e conformidade operacional.' +
      '</w:t></w:r></w:p>\n' +
      metaRow('Cliente', clienteNome) +
      metaRow('E-mail de Contato', clienteEmail) +
      metaRow('CNPJ / CPF', clienteDocumento) +
      metaRow('Endereço de Entrega', clienteEndereco) +
      metaRow('Solicitante Interno', solicitante) +
      // ==========================================
      // SEÇÃO 2: PEDIDOS EM CARTEIRA & ESPECIFICAÇÃO (Página 2)
      // ==========================================
      pageBreak() +
      heading1('2. Pedidos em Carteira e Especificação de Produtos') +
      heading2('2.1 Gestão Técnica e Comercial Responsável') +
      metaRow('Gestor Técnico Responsável', gestorTecnicoNome) +
      metaRow('Vendedor Responsável', vendedorNome) +
      heading2('2.2 Itens e Volumes do Pedido') +
      // Tabela de Produtos
      '<w:tbl>\n' +
      '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Código</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Produto</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="1600" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Linha</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Qtd</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Preço Unit.</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Desc %</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>' +
      escXml(produtoCodigo) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>' +
      escXml(produtoNome) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1600" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>' +
      escXml(produtoLinha) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>' +
      quantidade +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(precoLiquido)) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>' +
      escXml(fmtPercent(descontoPercent)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '</w:tbl>\n' +
      // ==========================================
      // SEÇÃO 3: ENQUADRAMENTO FISCAL E TRIBUTAÇÃO (Página 3)
      // ==========================================
      pageBreak() +
      heading1('3. Enquadramento Fiscal e Matriz Tributária') +
      heading2('3.1 Parâmetros de Origem e Espécie Fiscal') +
      metaRow('Estado de Origem / Tributação', estado) +
      metaRow('Espécie Fiscal Aplicada', especie) +
      heading2('3.2 Detalhamento dos Tributos Incidentes') +
      // Tabela de Tributos com cabeçalho em negrito e linhas alternadas
      '<w:tbl>\n' +
      '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Tributo / Adicional</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Alíquota / Base</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Valor Calculado</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 1 (odd - white)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ICMS</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>' +
      escXml(fmtPercent(aliquotaIcms)) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(icmsValor)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 2 (even - light gray)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>PIS</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>' +
      escXml(fmtPercent(aliquotaPis)) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(pisValor)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 3 (odd - white)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>COFINS</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>' +
      escXml(fmtPercent(aliquotaCofins)) +
      '</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(cofinsValor)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 4 (even - light gray)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Impostos Adicionais</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Valor Informado</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(impostosAdicionais)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '</w:tbl>\n' +
      // ==========================================
      // SEÇÃO 4: LOGÍSTICA, CANAL E DESTINO (Página 4)
      // ==========================================
      pageBreak() +
      heading1('4. Logística, Canais de Distribuição e Destino') +
      heading2('4.1 Condições de Transporte e Frete') +
      metaRow('Modalidade de Frete', modalidadeFrete) +
      metaRow('Percentual de Frete Aplicado', fmtPercent(fretePercentual)) +
      metaRow('Valor Total do Frete', fmtBRL(freteValor)) +
      heading2('4.2 Canal Comercial e Segmentação') +
      metaRow('Canal de Vendas', canalVendas) +
      metaRow('Espécie de Destino', especieDestino) +
      metaRow('Observações Comerciais', observacoes) +
      // ==========================================
      // SEÇÃO 5: RESUMO FINANCEIRO E CONDIÇÕES COMERCIAIS (Página 5)
      // ==========================================
      pageBreak() +
      heading1('5. Resumo Financeiro e Condições Comerciais') +
      heading2('5.1 Consolidação de Valores') +
      '<w:tbl>\n' +
      '<w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>' +
      '</w:tblBorders></w:tblPr>\n' +
      // Header
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="5200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Componente Financeiro</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F497D"/><w:tcW w:w="4000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Valor (R$)</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 1 (odd - white)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="5200" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Preço Base Líquido</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="4000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(precoBase)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 2 (even - light gray)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="5200" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Preço FOB (Base + Tributos + Adicionais)</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:tcW w:w="4000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(precoFob)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 3 (odd - white)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="5200" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>Preço CIF (FOB + Frete Logístico)</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:tcW w:w="4000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>' +
      escXml(fmtBRL(precoCif)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      // Row 4 Highlight (even - light green highlight)
      '<w:tr>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2EFDA"/><w:tcW w:w="5200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>TOTAL GERAL DO PEDIDO</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2EFDA"/><w:tcW w:w="4000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="276A3C"/></w:rPr><w:t>' +
      escXml(fmtBRL(totalGeral)) +
      '</w:t></w:r></w:p></w:tc>' +
      '</w:tr>\n' +
      '</w:tbl>\n' +
      // ==========================================
      // SEÇÃO 6: CRONOGRAMA E VALIDADE (Página 6)
      // ==========================================
      pageBreak() +
      heading1('6. Cronograma de Atendimento e Validade da Proposta') +
      metaRow('Validade da Proposta Comercial', '30 (trinta) dias a contar da data de emissão') +
      metaRow('Prazo Estimado de Faturamento', 'Até 5 dias úteis após confirmação do pedido') +
      metaRow('Condições de Pagamento', 'Conforme cadastro comercial homologado') +
      metaRow('Unidades Operacionais', 'Hernandarias - PY | Indaiatuba - SP') +
      // ==========================================
      // SEÇÃO 7: DISPOSIÇÕES FINAIS E ASSINATURA (Página 7)
      // ==========================================
      pageBreak() +
      heading1('7. Disposições Finais e Homologação Comercial') +
      '<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:t>' +
      'Declaramos que as especificações técnicas e condições comerciais contidas neste relatório foram elaboradas em estrita conformidade com as diretrizes operacionais e fiscais da Blink Biotech. A confirmação deste pedido implica a aceitação integral dos termos estabelecidos.' +
      '</w:t></w:r></w:p>\n' +
      // Bloco de Assinatura
      '<w:p><w:pPr><w:spacing w:before="600" w:after="80"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/></w:rPr><w:t>____________________________________________________</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:b/><w:color w:val="1F497D"/><w:sz w:val="24"/></w:rPr><w:t>Diretoria Comercial - Blink Biotech</w:t></w:r></w:p>\n' +
      '<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="20"/><w:color w:val="595959"/></w:rPr><w:t>Indaiatuba / SP, ' +
      escXml(dataEmissao) +
      '</w:t></w:r></w:p>\n' +
      // Section properties with Header & Footer definitions and title page exception
      '<w:sectPr>\n' +
      '<w:titlePg/>\n' +
      '<w:pgSz w:w="11906" w:h="16838"/>\n' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708"/>\n' +
      // Header for non-title pages
      '<w:hdr w:type="default">\n' +
      '<w:p><w:pPr><w:pStyle w:val="Header"/><w:jc w:val="right"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="D9D9D9"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="16"/><w:color w:val="7F7F7F"/></w:rPr><w:t>Relatorio de Desempenho</w:t></w:r></w:p>\n' +
      '</w:hdr>\n' +
      // Header for title page (empty)
      '<w:hdr w:type="first">\n' +
      '<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p>\n' +
      '</w:hdr>\n' +
      // Footer for non-title pages
      '<w:ftr w:type="default">\n' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs><w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="D9D9D9"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Blink Biotech - Diretoria Comercial</w:t></w:r>' +
      '<w:r><w:tab/></w:r>' +
      '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Página </w:t></w:r>' +
      '<w:fldSimple w:instr="PAGE"/>' +
      '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t> de </w:t></w:r>' +
      '<w:fldSimple w:instr="NUMPAGES"/>' +
      '</w:p>\n' +
      '</w:ftr>\n' +
      // Footer for title page (also has footer or empty, requirement says: "Rodapé em todas as páginas: Blink Biotech - Diretoria Comercial à esquerda, número da página à direita")
      '<w:ftr w:type="first">\n' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs><w:pBdr><w:top w:val="single" w:sz="4" w:space="2" w:color="D9D9D9"/></w:pBdr></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Blink Biotech - Diretoria Comercial</w:t></w:r>' +
      '<w:r><w:tab/></w:r>' +
      '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>Página </w:t></w:r>' +
      '<w:fldSimple w:instr="PAGE"/>' +
      '<w:r><w:rPr><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t> de </w:t></w:r>' +
      '<w:fldSimple w:instr="NUMPAGES"/>' +
      '</w:p>\n' +
      '</w:ftr>\n' +
      '</w:sectPr>\n' +
      '</w:body></w:wordDocument>'

    return e.blob(
      200,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fullDocxXml,
    )
  },
  $apis.requireAuth(),
)
