/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0144: Complemento da desvinculação de clientes de João Figueiredo.
 *
 * A migração 0142 limpou apenas o campo `vendedor_id` (relation → gestao_tecnica) dos
 * clientes FORA das UFs [MT, PA, RO, AC, AM, TO, MA, AP, RR]. Mas `factories` tem um
 * SEGUNDO campo de vínculo com vendedor: `salesOwner` (relation → users, usuário de
 * login do João Figueiredo = xhl48ye8ayb8fbu). A tela Cadastro agrupa pelo `salesOwner`,
 * por isso clientes do Sul/Sudeste ainda apareciam vinculados a ele.
 *
 * Regras:
 * - Varre `factories` onde `salesOwner = 'xhl48ye8ayb8fbu'` (João Figueiredo).
 * - UF deduzida com a MESMA cascata da 0142: state → city → standardized_address →
 *   coordenadas (lat/lng). Coordenadas servem APENAS para CONFIRMAR/MANTER o vínculo.
 * - UF indeterminada: NUNCA altera o registro (mantém o vínculo), apenas é contada.
 * - UF FORA das 9: limpa `salesOwner` (vazio). UF DENTRO das 9: mantém intacto.
 * - Auditoria em `entity_change_logs`: user_name "Sistema (Migração 0144)",
 *   action "update", field "salesOwner", old_value "xhl48ye8ayb8fbu (João Figueiredo)".
 * - Idempotente: numa base já migrada não há mais salesOwner fora da região e nada muda.
 */

migrate(
  (app) => {
    var KEEP_UFS = ['MT', 'PA', 'RO', 'AC', 'AM', 'TO', 'MA', 'AP', 'RR']
    var SALES_OWNER_ID = 'xhl48ye8ayb8fbu'
    var SALES_OWNER_LABEL = 'xhl48ye8ayb8fbu (João Figueiredo)'

    var KEEP_INDEX = {}
    for (var ki = 0; ki < KEEP_UFS.length; ki++) KEEP_INDEX[KEEP_UFS[ki]] = true

    var STATE_NAME_TO_UF = {
      acre: 'AC',
      alagoas: 'AL',
      amapá: 'AP',
      amapa: 'AP',
      amazonas: 'AM',
      bahia: 'BA',
      ceará: 'CE',
      ceara: 'CE',
      'distrito federal': 'DF',
      'espírito santo': 'ES',
      'espirito santo': 'ES',
      goiás: 'GO',
      goias: 'GO',
      maranhão: 'MA',
      maranhao: 'MA',
      'mato grosso': 'MT',
      'mato grosso do sul': 'MS',
      'minas gerais': 'MG',
      pará: 'PA',
      para: 'PA',
      paraíba: 'PB',
      paraiba: 'PB',
      paraná: 'PR',
      parana: 'PR',
      pernambuco: 'PE',
      piauí: 'PI',
      piaui: 'PI',
      'rio de janeiro': 'RJ',
      'rio grande do norte': 'RN',
      'rio grande do sul': 'RS',
      rondônia: 'RO',
      rondonia: 'RO',
      roraima: 'RR',
      'santa catarina': 'SC',
      'são paulo': 'SP',
      'sao paulo': 'SP',
      sergipe: 'SE',
      tocantins: 'TO',
    }

    var UF_SIGLA_RE =
      /(?:^|[^A-Z])(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:[^A-Z]|$)/

    function stripAccents(str) {
      if (!str) return ''
      var map = {
        á: 'a',
        à: 'a',
        ã: 'a',
        â: 'a',
        ä: 'a',
        é: 'e',
        è: 'e',
        ê: 'e',
        ë: 'e',
        í: 'i',
        ì: 'i',
        î: 'i',
        ï: 'i',
        ó: 'o',
        ò: 'o',
        õ: 'o',
        ô: 'o',
        ö: 'o',
        ú: 'u',
        ù: 'u',
        û: 'u',
        ü: 'u',
        ç: 'c',
        ñ: 'n',
      }
      var res = ''
      var lower = String(str).toLowerCase()
      for (var i = 0; i < lower.length; i++) {
        var ch = lower.charAt(i)
        res += map[ch] !== undefined ? map[ch] : ch
      }
      return res
    }

    // Bounding boxes aproximados (latMin, lngMin, latMax, lngMax) — usados APENAS para
    // MANTER o vínculo quando as coordenadas caem claramente dentro da região de manutenção.
    var KEEP_BOXES = {
      MT: [-19.6, -60.8, -7.9, -41.7],
      PA: [-10.0, -59.0, -0.7, -46.0],
      RO: [-13.8, -66.9, -7.9, -59.7],
      AC: [-11.3, -74.6, -6.9, -66.5],
      AM: [-10.1, -73.9, 2.1, -55.9],
      TO: [-18.3, -50.9, -5.2, -45.8],
      MA: [-10.4, -48.7, -1.4, -41.7],
      AP: [-0.1, -55.0, 4.6, -49.5],
      RR: [-1.7, -64.5, 5.4, -58.8],
    }

    function ufFromText(text) {
      var t = String(text || '')
      if (!t) return ''
      var norm = stripAccents(t)
      for (var name in STATE_NAME_TO_UF) {
        if (norm.indexOf(name) !== -1) return STATE_NAME_TO_UF[name]
      }
      var m = UF_SIGLA_RE.exec(t.toUpperCase())
      if (m) return m[1]
      return ''
    }

    function ufInKeepBox(lat, lng) {
      if (isNaN(lat) || isNaN(lng)) return ''
      if (lat === 0 && lng === 0) return ''
      for (var uf in KEEP_BOXES) {
        var b = KEEP_BOXES[uf]
        if (lat >= b[0] && lng >= b[1] && lat <= b[2] && lng <= b[3]) return uf
      }
      return ''
    }

    function inferUF(rec) {
      // 1) state — aceita sigla exata ou nome do estado
      var st = String(rec.getString('state') || '').trim()
      if (st) {
        var up = st.toUpperCase()
        if (KEEP_INDEX[up]) return up
        var byName = STATE_NAME_TO_UF[stripAccents(st)]
        if (byName) return byName
        var found = ufFromText(st)
        if (found) return found
      }
      // 2) city — ex.: "Sinop, Mato Grosso"
      var uf = ufFromText(rec.getString('city'))
      if (uf) return uf
      // 3) standardized_address
      uf = ufFromText(rec.getString('standardized_address'))
      if (uf) return uf
      // 4) coordenadas: só para MANTER vínculo (nunca para desvincular)
      var lat = rec.getFloat('lat') || rec.getFloat('latitude') || 0
      var lng = rec.getFloat('lng') || rec.getFloat('longitude') || 0
      return ufInKeepBox(lat, lng)
    }

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0144] entity_change_logs indisponível:', e)
    }

    var totalScanned = 0
    var unbound = 0
    var keptInRegion = 0
    var indeterminate = 0
    var unboundByUf = {}
    var keptByUf = {}

    var records = app.findRecordsByFilter(
      'factories',
      'salesOwner = {:sid} && is_deleted != true',
      '',
      0,
      0,
      { sid: SALES_OWNER_ID },
    )

    records.forEach((rec) => {
      totalScanned++
      var uf = inferUF(rec)

      // UF indeterminada: mantém o vínculo, não altera nada.
      if (!uf) {
        indeterminate++
        keptInRegion++
        return
      }

      if (KEEP_INDEX[uf]) {
        keptInRegion++
        keptByUf[uf] = (keptByUf[uf] || 0) + 1
        return
      }

      // Fora da região: limpa SOMENTE salesOwner e registra auditoria.
      var clienteNome = rec.getString('name') || rec.id
      app.runInTransaction((txApp) => {
        rec.set('salesOwner', '')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', rec.id)
          log.set('entity_name', clienteNome)
          log.set('user_name', 'Sistema (Migração 0144)')
          log.set('field', 'salesOwner')
          log.set('old_value', SALES_OWNER_LABEL)
          log.set('new_value', '')
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Desvinculação automática (João Figueiredo, campo salesOwner): UF ' +
              uf +
              ' fora da região de manutenção [MT, PA, RO, AC, AM, TO, MA, AP, RR].',
          )
          txApp.save(log)
        }
      })

      unbound++
      unboundByUf[uf] = (unboundByUf[uf] || 0) + 1
    })

    console.log(
      '[0144] Varredura salesOwner=João Figueiredo: total=' +
        totalScanned +
        ' desvinculados=' +
        unbound +
        ' mantidos=' +
        keptInRegion +
        ' (sem UF=' +
        indeterminate +
        ')',
      'porUF_desvinculados=' + JSON.stringify(unboundByUf),
      'porUF_mantidos=' + JSON.stringify(keptByUf),
    )
  },
  (app) => {
    // Rollback no-op: os desvinculados não são reatribuídos automaticamente.
  },
)
