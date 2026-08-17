// Generates a client history report as an editable Word (.docx) file from the
// activity_logs linked to a factory/client, and returns the binary file for
// download. The generated blob is then stored in `client_reports` by the
// client (standard SDK multipart upload) so it appears in the Relatórios tab.
//
// POST /backend/v1/client-reports/word
// body: { clientId, titulo?, periodoInicio?, periodoFim?, modelo?, solicitante? }
//   - modelo: "executivo" | "tecnico" | "comercial" (default: executivo)
//   - solicitante: name of the requesting user (falls back to auth user)
//   - gathers activity_logs for the client
//   - builds a minimal valid .docx (OOXML zip, stored/uncompressed, no deps)
//   - the Blink Biotech logo is always embedded (cover) regardless of template
//   - colours / styles follow the chosen visual template
//   - responds with the binary blob
//
// Fix history:
//   - The logo used to be fetched via $http.send(...).body, which in the JSVM
//     is a lossy Go->JS string cast of the binary body — the resulting bytes
//     were corrupted, so the embedded PNG inside the .docx zip was invalid and
//     Microsoft Word rejected the whole package with "conteúdo ilegível".
//     The logo is now downloaded with $filesystem.fileFromURL (which exposes
//     the raw bytes through a FileReader) so the PNG is byte-accurate.
//   - altChunk is now a direct child of <w:body> (not wrapped in <w:r>), per
//     the OOXML schema, which some Word versions enforce strictly.
//   - All user-controlled text fields are XML-escaped ( &, <, >, ", ' ).
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
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
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

    // Download a URL as raw bytes. $filesystem.fileFromURL returns a File whose
    // reader exposes the true binary content (unlike $http body which lossy-
    // casts bytes to a JS string). Used to embed the logo PNG byte-accurately.
    function fetchBytesViaFilesystem(url, timeoutSec) {
      var file = $filesystem.fileFromURL(url, timeoutSec || 30)
      var reader = file.reader.open()
      try {
        var buf = new Uint8Array(file.size)
        reader.read(buf)
        // convert to plain array (number[]) — buildStoredZip expects arrays
        var arr = new Array(buf.length)
        for (var i = 0; i < buf.length; i++) arr[i] = buf[i]
        return arr
      } finally {
        try {
          reader.close()
        } catch (_) {}
      }
    }

    // ---------- visual templates ----------
    // Each template defines colours + an HTML cover/header block and table styling.
    var TEMPLATES = {
      executivo: {
        label: 'Executivo',
        primary: '#1f2937',
        accent: '#6b7280',
        headerBg: '#1f2937',
        headerColor: '#ffffff',
        tableHeaderBg: '#e5e7eb',
        kpiBg: '#f9fafb',
        kpiBorder: '#d1d5db',
        coverTitleSize: '26pt',
        bodyFont: "Georgia, 'Times New Roman', serif",
        fontStyle:
          'body{font-family:Georgia,Times,serif;font-size:11pt;color:#1f2937;}' +
          'h1{color:#1f2937;font-size:20pt;border-bottom:2px solid #1f2937;padding-bottom:4px;}' +
          'h2{color:#374151;font-size:14pt;}' +
          'table{font-size:10pt;}' +
          '.kpi{background:#f9fafb;border:1px solid #d1d5db;border-radius:6px;padding:10px;display:inline-block;margin:6px;text-align:center;}' +
          '.kpi b{display:block;font-size:18pt;color:#1f2937;}' +
          '.cover{background:#1f2937;color:#fff;padding:40px;border-radius:8px;}' +
          '.cover h1{color:#fff;border:none;font-size:26pt;}' +
          '.cover .sub{color:#d1d5db;font-size:12pt;margin-top:8px;}',
      },
      tecnico: {
        label: 'Técnico',
        primary: '#1e3a8a',
        accent: '#2563eb',
        headerBg: '#1e3a8a',
        headerColor: '#ffffff',
        tableHeaderBg: '#dbeafe',
        kpiBg: '#eff6ff',
        kpiBorder: '#2563eb',
        coverTitleSize: '24pt',
        bodyFont: "'Segoe UI', Calibri, Arial, sans-serif",
        fontStyle:
          "body{font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:11pt;color:#0f172a;}" +
          'h1{color:#1e3a8a;font-size:20pt;border-left:5px solid #2563eb;padding-left:10px;}' +
          'h2{color:#1e3a8a;font-size:14pt;border-bottom:1px solid #2563eb;}' +
          'table{font-size:10pt;border:1px solid #cbd5e1;}' +
          'th{background:#dbeafe;color:#1e3a8a;}' +
          'td{border:1px solid #cbd5e1;}' +
          '.kpi{background:#eff6ff;border:1px solid #2563eb;border-radius:6px;padding:10px;display:inline-block;margin:6px;text-align:center;}' +
          '.kpi b{display:block;font-size:18pt;color:#1e3a8a;}' +
          '.cover{background:#1e3a8a;color:#fff;padding:40px;border-radius:8px;}' +
          '.cover h1{color:#fff;border:none;font-size:24pt;}' +
          '.cover .sub{color:#bfdbfe;font-size:12pt;margin-top:8px;}',
      },
      comercial: {
        label: 'Comercial',
        primary: '#b91c1c',
        accent: '#f59e0b',
        headerBg: '#b91c1c',
        headerColor: '#ffffff',
        tableHeaderBg: '#fef3c7',
        kpiBg: '#fff7ed',
        kpiBorder: '#f59e0b',
        coverTitleSize: '26pt',
        bodyFont: "'Segoe UI', Calibri, Arial, sans-serif",
        fontStyle:
          "body{font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:11pt;color:#1c1917;}" +
          'h1{color:#b91c1c;font-size:20pt;border-bottom:3px solid #f59e0b;padding-bottom:4px;}' +
          'h2{color:#b91c1c;font-size:14pt;}' +
          'table{font-size:10pt;}' +
          'th{background:#fef3c7;color:#92400e;}' +
          '.kpi{background:#fff7ed;border:2px solid #f59e0b;border-radius:8px;padding:10px;display:inline-block;margin:6px;text-align:center;}' +
          '.kpi b{display:block;font-size:18pt;color:#b91c1c;}' +
          '.kpi .lbl{color:#92400e;font-weight:bold;}' +
          '.cover{background:linear-gradient(135deg,#b91c1c,#f59e0b);color:#fff;padding:40px;border-radius:8px;}' +
          '.cover h1{color:#fff;border:none;font-size:26pt;}' +
          '.cover .sub{color:#fff;font-size:12pt;margin-top:8px;font-weight:bold;}',
      },
    }

    // ---------- main ----------
    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    var body = e.requestInfo().body || {}
    var clientId = body.clientId
    if (!clientId) return e.badRequestError('clientId é obrigatório')

    var modeloKey = String(body.modelo || 'executivo').toLowerCase()
    if (!TEMPLATES[modeloKey]) modeloKey = 'executivo'
    var T = TEMPLATES[modeloKey]

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

    var userName = body.solicitante || ''
    if (!userName && e.auth && e.auth.getString) {
      userName = e.auth.getString('name') || e.auth.getString('email') || ''
    }

    // ---------- fetch the Blink logo as byte-accurate raw bytes ----------
    // $filesystem.fileFromURL downloads the resource and exposes the true
    // binary content via a FileReader — essential for a valid PNG inside the
    // .docx zip (the previous $http.send().body path corrupted the bytes).
    var logoBytes = null
    try {
      logoBytes = fetchBytesViaFilesystem(
        'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/38d970e5-7e8c-4a30-8b1e-ccf8a9667554/image-f220f.png',
        20,
      )
      if (!logoBytes || logoBytes.length < 24) logoBytes = null
      // sanity check: PNG signature (89 50 4E 47 0D 0A 1A 0A)
      if (
        logoBytes &&
        (logoBytes[0] !== 0x89 ||
          logoBytes[1] !== 0x50 ||
          logoBytes[2] !== 0x4e ||
          logoBytes[3] !== 0x47)
      ) {
        logoBytes = null
      }
    } catch (_) {
      logoBytes = null
    }

    // ---------- build HTML body ----------
    var nowStr = fmtDate(new Date().toISOString())

    var coverHtml = ''
    coverHtml += '<div class="cover">'
    coverHtml += '<h1>' + esc(titulo) + '</h1>'
    coverHtml += '<div class="sub">Blink Biotech • Relatório ' + esc(T.label) + '</div>'
    coverHtml += '</div>'
    coverHtml += '<p style="margin-top:14px;"><b>Cliente:</b> ' + esc(clientName) + '</p>'

    var bodyHtml = ''
    bodyHtml += coverHtml

    // KPI block (counts by tipo) — always present for all templates
    var byTipo = {}
    for (var ti = 0; ti < logs.length; ti++) {
      var tKey = logs[ti].getString('tipo') || 'outro'
      byTipo[tKey] = (byTipo[tKey] || 0) + 1
    }
    bodyHtml += '<div style="margin:10px 0;">'
    bodyHtml += '<div class="kpi"><b>' + logs.length + '</b><span class="lbl">Ações</span></div>'
    bodyHtml +=
      '<div class="kpi"><b>' +
      (byTipo['status'] || 0) +
      '</b><span class="lbl">Mudanças de Status</span></div>'
    bodyHtml +=
      '<div class="kpi"><b>' +
      (byTipo['acao'] || 0) +
      '</b><span class="lbl">Ações Registradas</span></div>'
    bodyHtml += '</div>'

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
    bodyHtml += '<p><b>Solicitado por:</b> ' + esc(userName) + '</p>'
    bodyHtml += '<p><b>Gerado em:</b> ' + nowStr + '</p>'
    bodyHtml += '<hr/>'

    if (logs.length === 0) {
      bodyHtml += '<p><i>Nenhuma ação registrada para este cliente.</i></p>'
    } else {
      bodyHtml += '<h2>Histórico de Ações</h2>'
      bodyHtml +=
        '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">'
      bodyHtml +=
        '<tr style="background:' +
        T.tableHeaderBg +
        ';color:' +
        T.primary +
        ';font-weight:bold;">' +
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
          statusChange = esc(stOld || '—') + ' &rarr; ' + esc(stNew || '—')
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
      'Documento gerado automaticamente pelo Blink&#39;s Bunker (Modelo ' +
      esc(T.label) +
      '). Editável.</p>'

    // ---------- build the .docx (OOXML zip) ----------
    // The HTML chunk is referenced via an altChunk relationship (rId1). When
    // the logo is present it is rendered as a real OOXML drawing (image)
    // referencing relationship rId3, placed as the first paragraph (cover).
    var EMU_PER_PX = 9525
    var logoParaXml = ''
    var imgRelXml = ''
    var logoMediaEntry = null
    if (logoBytes) {
      logoMediaEntry = { name: 'word/media/logo.png', data: logoBytes }
      // read PNG IHDR for native pixel dimensions (big-endian at offsets 16/20)
      var imgW = 200
      var imgH = 60
      try {
        if (logoBytes.length > 24) {
          imgW =
            (logoBytes[16] << 24) | (logoBytes[17] << 16) | (logoBytes[18] << 8) | logoBytes[19]
          imgH =
            (logoBytes[20] << 24) | (logoBytes[21] << 16) | (logoBytes[22] << 8) | logoBytes[23]
          if (imgW <= 0 || imgH <= 0 || imgW > 4000 || imgH > 4000) {
            imgW = 200
            imgH = 60
          }
        }
      } catch (_) {}
      // scale to a max width of ~220px, keep aspect ratio
      var maxW = 220
      var dispW = imgW
      var dispH = imgH
      if (dispW > maxW) {
        dispH = Math.round((dispH * maxW) / dispW)
        dispW = maxW
      }
      var cx = dispW * EMU_PER_PX
      var cy = dispH * EMU_PER_PX
      var picXml =
        '<w:p>' +
        '<w:pPr><w:jc w:val="center"/></w:pPr>' +
        '<w:r>' +
        '<w:drawing>' +
        '<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">' +
        '<wp:extent cx="' +
        cx +
        '" cy="' +
        cy +
        '"/>' +
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
        '<wp:docPr id="1" name="Blink Biotech Logo"/>' +
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:nvPicPr>' +
        '<pic:cNvPr id="1" name="Blink Biotech Logo"/>' +
        '<pic:cNvPicPr/>' +
        '</pic:nvPicPr>' +
        '<pic:blipFill>' +
        '<a:blip r:embed="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>' +
        '<a:stretch><a:fillRect/></a:stretch>' +
        '</pic:blipFill>' +
        '<pic:spPr>' +
        '<a:xfrm><a:off x="0" y="0"/><a:ext cx="' +
        cx +
        '" cy="' +
        cy +
        '"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
        '</pic:spPr>' +
        '</pic:pic>' +
        '</a:graphicData>' +
        '</a:graphic>' +
        '</wp:inline>' +
        '</w:drawing>' +
        '</w:r>' +
        '</w:p>'
      logoParaXml = picXml
      imgRelXml =
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>'
    }

    // altChunk is a direct child of <w:body> (not wrapped in <w:r>/<w:p>),
    // which is the schema-correct placement Word expects.
    var docXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body>' +
      logoParaXml +
      '<w:altChunk r:id="rId1"/>' +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
      '</w:body></w:document>'

    var htmlBytes = stringToBytes(
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
        'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8">' +
        '<style>' +
        T.fontStyle +
        '</style>' +
        '</head><body>' +
        bodyHtml +
        '</body></html>',
    )

    var relsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/afChunk" Target="chunk1.htm"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      imgRelXml +
      '</Relationships>'

    var contentTypesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="htm" ContentType="text/html"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
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
    if (logoMediaEntry) entries.push(logoMediaEntry)
    var zipBytes = buildStoredZip(entries)

    return e.blob(
      200,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      zipBytes,
    )
  },
  $apis.requireAuth(),
)
