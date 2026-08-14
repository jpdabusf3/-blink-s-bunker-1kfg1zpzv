// Generates a client history report as an editable Word (.docx) file from the
// activity_logs linked to a factory/client, and returns the binary file for
// download. The generated blob is then stored in `client_reports` by the
// client (standard SDK multipart upload) so it appears in the Relatórios tab.
//
// POST /backend/v1/client-reports/word
// body: { clientId, titulo?, periodoInicio?, periodoFim? }
//   - gathers activity_logs for the client
//   - builds a minimal valid .docx (OOXML zip, stored/uncompressed, no deps)
//   - responds with the binary blob
routerAdd(
  'POST',
  '/backend/v1/client-reports/word',
  (e) => {
    // ---------- all helpers inlined (JSVM callbacks can't see top-level decls) ----------
    function pad(n, len) {
      var s = '' + n
      while (s.length < len) s = '0' + s
      return s
    }
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }
    function fmtDate(iso) {
      if (!iso) return '—'
      try {
        var d = new Date(iso)
        if (isNaN(d.getTime())) return iso
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
        return iso
      }
    }
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
    var crcT = null
    function crc32Table() {
      if (crcT) return crcT
      var t = []
      for (var n = 0; n < 256; n++) {
        var c = n
        for (var k = 0; k < 8; k++) {
          if (c & 1) c = 0xedb88320 ^ (c >>> 1)
          else c = c >>> 1
        }
        t[n] = c >>> 0
      }
      crcT = t
      return t
    }
    function crc32(bytes) {
      var table = crc32Table()
      var crc = 0xffffffff
      for (var i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff]
      }
      return (crc ^ 0xffffffff) >>> 0
    }
    function u16(v) {
      return [v & 0xff, (v >>> 8) & 0xff]
    }
    function u32(v) {
      return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]
    }
    function buildStoredZip(entries) {
      var out = []
      var central = []
      var offset = 0
      for (var i = 0; i < entries.length; i++) {
        var nameBytes = stringToBytes(entries[i].name)
        var data = entries[i].data
        var crc = crc32(data)
        var size = data.length
        var lh = []
        lh = lh.concat(u32(0x04034b50))
        lh = lh.concat(u16(20))
        lh = lh.concat(u16(0))
        lh = lh.concat(u16(0))
        lh = lh.concat(u16(0))
        lh = lh.concat(u16(0))
        lh = lh.concat(u32(crc))
        lh = lh.concat(u32(size))
        lh = lh.concat(u32(size))
        lh = lh.concat(u16(nameBytes.length))
        lh = lh.concat(u16(0))
        out = out.concat(lh)
        out = out.concat(nameBytes)
        out = out.concat(data)
        var cdh = []
        cdh = cdh.concat(u32(0x02014b50))
        cdh = cdh.concat(u16(20))
        cdh = cdh.concat(u16(20))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u32(crc))
        cdh = cdh.concat(u32(size))
        cdh = cdh.concat(u32(size))
        cdh = cdh.concat(u16(nameBytes.length))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u16(0))
        cdh = cdh.concat(u32(0))
        cdh = cdh.concat(u32(offset))
        cdh = cdh.concat(nameBytes)
        central = central.concat(cdh)
        offset += lh.length + nameBytes.length + data.length
      }
      var eocd = []
      eocd = eocd.concat(u32(0x06054b50))
      eocd = eocd.concat(u16(0))
      eocd = eocd.concat(u16(0))
      eocd = eocd.concat(u16(entries.length))
      eocd = eocd.concat(u16(entries.length))
      eocd = eocd.concat(u32(central.length))
      eocd = eocd.concat(u32(offset))
      eocd = eocd.concat(u16(0))
      return out.concat(central).concat(eocd)
    }
    function userDisplay(log) {
      try {
        var uId = log.getString('user')
        if (!uId) return '—'
        var u = $app.findRecordById('users', uId)
        return u.getString('name') || u.getString('email') || '—'
      } catch (_) {
        return '—'
      }
    }

    // ---------- main ----------
    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    var body = e.requestInfo().body || {}
    var clientId = body.clientId
    if (!clientId) return e.badRequestError('clientId é obrigatório')

    var factory = null
    try {
      factory = $app.findRecordById('factories', clientId)
    } catch (_) {
      return e.notFoundError('cliente não encontrado')
    }
    var clientName = factory.getString('name')

    var logs = []
    try {
      logs = $app.findRecordsByFilter(
        'activity_logs',
        "recordId = '" + clientId + "'",
        'created',
        10000,
        0,
      )
    } catch (_) {}

    var titulo = body.titulo || 'Relatório de Histórico — ' + clientName
    var periodoInicio = body.periodoInicio || ''
    var periodoFim = body.periodoFim || ''
    var periodoTxt = ''
    if (periodoInicio || periodoFim) {
      periodoTxt =
        '(' +
        (periodoInicio ? fmtDate(periodoInicio) : 'início') +
        ' até ' +
        (periodoFim ? fmtDate(periodoFim) : 'agora') +
        ')'
    }

    var userName = ''
    if (e.auth && e.auth.getString) {
      userName = e.auth.getString('name') || e.auth.getString('email') || ''
    }

    // ---------- build HTML body ----------
    var bodyHtml = ''
    bodyHtml += '<h1>' + esc(titulo) + '</h1>'
    bodyHtml += '<p><b>Cliente:</b> ' + esc(clientName) + '</p>'
    if (factory.getString('city'))
      bodyHtml += '<p><b>Cidade:</b> ' + esc(factory.getString('city')) + '</p>'
    if (factory.getString('state'))
      bodyHtml += '<p><b>Estado:</b> ' + esc(factory.getString('state')) + '</p>'
    if (factory.getString('animalSpecies'))
      bodyHtml += '<p><b>Espécie:</b> ' + esc(factory.getString('animalSpecies')) + '</p>'
    if (factory.getString('status_funil'))
      bodyHtml += '<p><b>Status do Funil:</b> ' + esc(factory.getString('status_funil')) + '</p>'
    if (factory.getString('vendedor_name'))
      bodyHtml += '<p><b>Vendedor:</b> ' + esc(factory.getString('vendedor_name')) + '</p>'
    bodyHtml += '<p><b>Período:</b> ' + esc(periodoTxt || 'Todo o histórico') + '</p>'
    bodyHtml += '<p><b>Total de ações registradas:</b> ' + logs.length + '</p>'
    bodyHtml +=
      '<p><b>Gerado por:</b> ' + esc(userName) + ' em ' + fmtDate(new Date().toISOString()) + '</p>'
    bodyHtml += '<hr/>'

    if (logs.length === 0) {
      bodyHtml += '<p><i>Nenhuma ação registrada para este cliente.</i></p>'
    } else {
      bodyHtml += '<h2>Histórico de Ações</h2>'
      bodyHtml +=
        '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">'
      bodyHtml +=
        '<tr style="background:#e8e8e8;">' +
        '<th>Data/Hora</th><th>Tipo</th><th>Ação</th><th>Detalhes / Próximo Passo</th>' +
        '<th>Mudança de Status</th><th>Responsável</th></tr>'
      for (var i = 0; i < logs.length; i++) {
        var log = logs[i]
        var tipo = log.getString('tipo') || 'outro'
        var action = log.getString('action') || ''
        var details = log.getString('details') || ''
        var prox = log.getString('proximo_passo') || ''
        var stOld = log.getString('status_anterior') || ''
        var stNew = log.getString('status_novo') || ''
        var statusChange = ''
        if (stOld || stNew) {
          statusChange = esc(stOld || '—') + ' → ' + esc(stNew || '—')
        }
        var detailCell = esc(details)
        if (prox) detailCell += '<br/><i>Próximo passo:</i> ' + esc(prox)
        bodyHtml += '<tr>'
        bodyHtml += '<td>' + fmtDate(log.getString('created')) + '</td>'
        bodyHtml += '<td>' + esc(tipo) + '</td>'
        bodyHtml += '<td>' + esc(action) + '</td>'
        bodyHtml += '<td>' + detailCell + '</td>'
        bodyHtml += '<td>' + statusChange + '</td>'
        bodyHtml += '<td>' + esc(userDisplay(log)) + '</td>'
        bodyHtml += '</tr>'
      }
      bodyHtml += '</table>'
    }
    bodyHtml +=
      '<p style="margin-top:20px;color:#888;font-size:10px;">' +
      'Documento gerado automaticamente pelo Blink&#39;s Bunker. Editável.</p>'

    // ---------- build the .docx (OOXML zip) ----------
    var docXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      '<w:p><w:r><w:altChunk r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></w:r></w:p>' +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
      '</w:body></w:document>'

    var htmlBytes = stringToBytes(
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
        'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8">' +
        '<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}' +
        'table{font-size:10pt;}h1{font-size:18pt;}h2{font-size:14pt;}</style>' +
        '</head><body>' +
        bodyHtml +
        '</body></html>',
    )

    var relsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/afChunk" Target="chunk1.htm"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>'

    var contentTypesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="htm" ContentType="text/html"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>'

    var stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
      '</w:styles>'

    var rootRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'

    var entries = [
      { name: '[Content_Types].xml', data: stringToBytes(contentTypesXml) },
      { name: '_rels/.rels', data: stringToBytes(rootRelsXml) },
      { name: 'word/document.xml', data: stringToBytes(docXml) },
      { name: 'word/_rels/document.xml.rels', data: stringToBytes(relsXml) },
      { name: 'word/styles.xml', data: stringToBytes(stylesXml) },
      { name: 'word/chunk1.htm', data: htmlBytes },
    ]
    var zipBytes = buildStoredZip(entries)

    return e.blob(
      200,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      zipBytes,
    )
  },
  $apis.requireAuth(),
)
