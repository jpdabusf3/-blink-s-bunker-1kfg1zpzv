// Generates a PDF visit/activity report for a record in `atividades`, stores
// the generated PDF in the activity's `relatorio_pdf` file field, and returns
// the binary PDF for download.
//
// POST /backend/v1/atividade-pdf
//   body: { atividadeId }   (uses the authenticated user for the requester name)
//   - loads the atividade + its cliente_id (factory) + vendedor_id (user)
//   - builds a minimal valid PDF 1.4 (Helvetica, A4 portrait) with a branded
//     Blink header band and the visit data
//   - saves the PDF bytes into atividades.relatorio_pdf via
//     $filesystem.fileFromBytes
//   - returns the binary PDF (e.blob)
//
// All helpers are inlined inside the callback (JSVM callbacks cannot see
// top-level declarations).
routerAdd(
  'POST',
  '/backend/v1/atividade-pdf',
  (e) => {
    function pad(n, len) {
      var s = '' + n
      while (s.length < len) s = '0' + s
      return s
    }
    function escPdf(s) {
      return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
    }
    function fmtDate(iso) {
      if (!iso) return ''
      try {
        var d = new Date(iso)
        if (isNaN(d.getTime())) return String(iso)
        return (
          pad(d.getDate(), 2) +
          '/' +
          pad(d.getMonth() + 1, 2) +
          '/' +
          d.getFullYear() +
          ' ' +
          pad(d.getHours(), 2) +
          ':' +
          pad(d.getMinutes(), 2)
        )
      } catch (_) {
        return String(iso)
      }
    }
    function fmtDateOnly(iso) {
      if (!iso) return ''
      try {
        var d = new Date(iso)
        if (isNaN(d.getTime())) return String(iso)
        return pad(d.getDate(), 2) + '/' + pad(d.getMonth() + 1, 2) + '/' + d.getFullYear()
      } catch (_) {
        return String(iso)
      }
    }
    // UTF-8 string -> byte array (number[])  (used for PDF object bodies)
    function stringToBytes(s) {
      var bytes = []
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i)
        if (c < 0x80) {
          bytes.push(c)
        } else if (c < 0x800) {
          bytes.push(0xc0 | (c >> 6))
          bytes.push(0x80 | (c & 0x3f))
        } else if (c < 0xd800 || c >= 0xe000) {
          bytes.push(0xe0 | (c >> 12))
          bytes.push(0x80 | ((c >> 6) & 0x3f))
          bytes.push(0x80 | (c & 0x3f))
        } else {
          i++
          var c2 = s.charCodeAt(i)
          var cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff))
          bytes.push(0xf0 | (cp >> 18))
          bytes.push(0x80 | ((cp >> 12) & 0x3f))
          bytes.push(0x80 | ((cp >> 6) & 0x3f))
          bytes.push(0x80 | (cp & 0x3f))
        }
      }
      return bytes
    }
    // Latin-1 string -> byte array for the content stream (WinAnsiEncoding).
    // Non-representable chars become '?'.
    function latin1Bytes(s) {
      var out = []
      s = String(s == null ? '' : s)
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i)
        if (c > 255) out.push(63)
        else out.push(c)
      }
      return out
    }
    function appendBytes(buf, arr) {
      for (var i = 0; i < arr.length; i++) buf.push(arr[i])
      return buf
    }
    function appendStr(buf, s) {
      for (var i = 0; i < s.length; i++) buf.push(s.charCodeAt(i) & 0xff)
      return buf
    }
    function wrapText(text, maxChars) {
      text = String(text == null ? '' : text)
      var out = []
      var paragraphs = text.split('\n')
      for (var p = 0; p < paragraphs.length; p++) {
        var words = paragraphs[p].split(' ')
        var cur = ''
        for (var w = 0; w < words.length; w++) {
          if ((cur + ' ' + words[w]).trim().length > maxChars) {
            if (cur) out.push(cur)
            cur = words[w]
          } else {
            cur = (cur + ' ' + words[w]).trim()
          }
        }
        if (cur) out.push(cur)
        if (paragraphs.length > 1 && p < paragraphs.length - 1) out.push('')
      }
      return out.length ? out : ['']
    }

    // ---------- main ----------
    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    var body = e.requestInfo().body || {}
    var atividadeId = body.atividadeId
    if (!atividadeId) return e.badRequestError('atividadeId é obrigatório')

    var atividade = null
    try {
      atividade = $app.findRecordById('atividades', atividadeId)
    } catch (_) {
      return e.notFoundError('atividade não encontrada')
    }

    var clienteId = atividade.getString('cliente_id') || ''
    var vendedorId = atividade.getString('vendedor_id') || ''
    var cliente = null
    if (clienteId) {
      try {
        cliente = $app.findRecordById('factories', clienteId)
      } catch (_) {}
    }
    var vendedor = null
    if (vendedorId) {
      try {
        vendedor = $app.findRecordById('users', vendedorId)
      } catch (_) {}
    }

    var clientName = cliente ? cliente.getString('name') : ''
    var clientCity = cliente ? cliente.getString('city') : ''
    var clientState = cliente ? cliente.getString('state') : ''
    var clientCnpj = cliente ? cliente.getString('cnpj') : ''
    var clientCarteira = cliente ? cliente.getString('carteira') : ''
    var clientSpecies = cliente ? cliente.getString('animalSpecies') : ''
    var clientFunilStatus = cliente ? cliente.getString('status_funil') : ''

    var vendedorName = vendedor ? vendedor.getString('name') || vendedor.getString('email') : ''
    if (!vendedorName && e.auth && e.auth.getString) {
      vendedorName = e.auth.getString('name') || e.auth.getString('email') || ''
    }

    var tipoAtividade = atividade.getString('tipo_atividade') || ''
    var etapaFunil = atividade.getString('etapa_funil') || ''
    var valorEstimado = atividade.get('valor_estimado') || 0
    var descricao = atividade.getString('descricao') || ''
    var proximoPasso = atividade.getString('proximo_passo') || ''
    var pendencias = atividade.getString('pendencias') || ''
    var origem = atividade.getString('origem') || ''
    var dataProxima = atividade.getString('data_proxima_acao') || ''
    var createdIso = atividade.getString('created') || ''

    var valorNum = Number(valorEstimado) || 0
    var valorTxt = 'R$ ' + valorNum.toFixed(2).replace('.', ',')

    // ---------- build the PDF ----------
    var PAGE_W = 595.28
    var PAGE_H = 841.89
    var MARGIN = 50

    function fieldLine(label, value, y) {
      var out = 'BT /F1 10 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(label) + ': ) Tj ET\n'
      out +=
        'BT /F2 10 Tf ' +
        (MARGIN + label.length * 5.2 + 2) +
        ' ' +
        y +
        ' Td (' +
        escPdf(String(value == null ? '' : value).substring(0, 88)) +
        ') Tj ET'
      return out
    }

    var lines = []
    // ---- branded header band (Blink red) ----
    lines.push(
      '0.88 0.18 0.18 rg ' +
        MARGIN +
        ' ' +
        (PAGE_H - 90) +
        ' ' +
        (PAGE_W - 2 * MARGIN) +
        ' 50 re f',
    )
    lines.push('1 1 1 rg')
    lines.push('BT /F2 18 Tf ' + (MARGIN + 16) + ' ' + (PAGE_H - 58) + ' Td (BLINK BIOTECH) Tj ET')
    lines.push(
      'BT /F1 10 Tf ' +
        (MARGIN + 16) +
        ' ' +
        (PAGE_H - 74) +
        ' Td (Relatorio de Visita  -  CRM Inteligencia Comercial) Tj ET',
    )

    // ---- body ----
    var y = PAGE_H - 120
    lines.push('0.1 0.1 0.1 rg')

    lines.push('BT /F2 12 Tf ' + MARGIN + ' ' + y + ' Td (Dados do Cliente) Tj ET')
    y -= 18
    lines.push(fieldLine('Cliente', clientName || '-', y))
    y -= 14
    var cityState = [clientCity, clientState].filter(Boolean).join(' / ')
    lines.push(fieldLine('Cidade/UF', cityState || '-', y))
    y -= 14
    lines.push(fieldLine('CNPJ', clientCnpj || '-', y))
    y -= 14
    lines.push(fieldLine('Carteira', clientCarteira || '-', y))
    y -= 14
    lines.push(fieldLine('Especie', clientSpecies || '-', y))
    y -= 14
    lines.push(fieldLine('Status Funil', clientFunilStatus || etapaFunil || '-', y))
    y -= 22

    lines.push('BT /F2 12 Tf ' + MARGIN + ' ' + y + ' Td (Dados da Visita) Tj ET')
    y -= 18
    lines.push(fieldLine('Data', fmtDate(createdIso) || '-', y))
    y -= 14
    lines.push(fieldLine('Tipo', tipoAtividade || '-', y))
    y -= 14
    lines.push(fieldLine('Etapa do Funil', etapaFunil || '-', y))
    y -= 14
    lines.push(fieldLine('Valor Estimado', valorTxt, y))
    y -= 14
    lines.push(fieldLine('Vendedor', vendedorName || '-', y))
    y -= 14
    lines.push(fieldLine('Origem', origem || '-', y))
    y -= 22

    lines.push('BT /F2 12 Tf ' + MARGIN + ' ' + y + ' Td (Resumo da Visita) Tj ET')
    y -= 16
    var descLines = wrapText(descricao || '-', 95)
    for (var di = 0; di < descLines.length && y > 100; di++) {
      lines.push('BT /F1 10 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(descLines[di]) + ') Tj ET')
      y -= 13
    }
    y -= 8

    lines.push('BT /F2 12 Tf ' + MARGIN + ' ' + y + ' Td (Proximos Passos) Tj ET')
    y -= 16
    var nextLines = wrapText(proximoPasso || '-', 95)
    for (var ni = 0; ni < nextLines.length && y > 80; ni++) {
      lines.push('BT /F1 10 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(nextLines[ni]) + ') Tj ET')
      y -= 13
    }
    if (dataProxima) {
      y -= 4
      lines.push(fieldLine('Data da proxima acao', fmtDateOnly(dataProxima), y))
      y -= 14
    }
    y -= 8

    if (pendencias) {
      lines.push('BT /F2 12 Tf ' + MARGIN + ' ' + y + ' Td (Pendencias) Tj ET')
      y -= 16
      var pendLines = wrapText(pendencias, 95)
      for (var pi = 0; pi < pendLines.length && y > 70; pi++) {
        lines.push('BT /F1 10 Tf ' + MARGIN + ' ' + y + ' Td (' + escPdf(pendLines[pi]) + ') Tj ET')
        y -= 13
      }
    }

    lines.push('0.5 0.5 0.5 rg')
    lines.push(
      'BT /F1 8 Tf ' +
        MARGIN +
        ' 35 Td (Documento gerado automaticamente pelo Blink CRM em ' +
        fmtDate(new Date().toISOString()) +
        ') Tj ET',
    )

    var contentStr = lines.join('\n')
    var contentBytes = latin1Bytes(contentStr)

    // ---------- objects ----------
    var objects = []
    // obj 1: Catalog
    objects.push(stringToBytes('<< /Type /Catalog /Pages 2 0 R >>'))
    // obj 2: Pages
    objects.push(stringToBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'))
    // obj 3: Page
    objects.push(
      stringToBytes(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
          PAGE_W +
          ' ' +
          PAGE_H +
          '] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      ),
    )
    // obj 4: Contents stream
    objects.push(contentBytes)
    // obj 5: Font Helvetica
    objects.push(
      stringToBytes(
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      ),
    )
    // obj 6: Font Helvetica-Bold
    objects.push(
      stringToBytes(
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      ),
    )

    // ---------- assemble ----------
    var pdf = []
    appendStr(pdf, '%PDF-1.4\n')
    appendStr(pdf, '%\u00e2\u00e3\u00cf\u00d3\n')

    var offsets = [0]
    for (var oi = 0; oi < objects.length; oi++) {
      offsets.push(pdf.length)
      appendStr(pdf, oi + 1 + ' 0 obj\n')
      appendBytes(pdf, objects[oi])
      appendStr(pdf, '\nendobj\n')
    }

    var xrefStart = pdf.length
    appendStr(pdf, 'xref\n')
    appendStr(pdf, '0 ' + (objects.length + 1) + '\n')
    appendStr(pdf, '0000000000 65535 f \n')
    for (var xi = 1; xi <= objects.length; xi++) {
      appendStr(pdf, pad(offsets[xi], 10) + ' 00000 n \n')
    }

    appendStr(pdf, 'trailer\n')
    appendStr(pdf, '<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n')
    appendStr(pdf, 'startxref\n')
    appendStr(pdf, xrefStart + '\n')
    appendStr(pdf, '%%EOF')

    var pdfBytes = pdf

    // ---------- store into atividades.relatorio_pdf ----------
    try {
      var fileName = 'relatorio_visita_' + String(atividadeId).substring(0, 8) + '.pdf'
      var file = $filesystem.fileFromBytes(pdfBytes, fileName)
      atividade.set('relatorio_pdf', file)
      $app.save(atividade)
    } catch (storeErr) {
      $app
        .logger()
        .error('atividade-pdf: store failed', 'error', String(storeErr).substring(0, 200))
    }

    return e.blob(200, 'application/pdf', pdfBytes)
  },
  $apis.requireAuth(),
)
