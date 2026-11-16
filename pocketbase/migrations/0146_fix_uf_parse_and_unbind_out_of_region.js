/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0146: Correção da dedução de UF da 0145 e conclusão da desvinculação.
 *
 * Bug corrigido:
 * - A 0145 (e as 0142/0144) procuravam o NOME do estado como substring simples do texto.
 *   O nome "para" (Pará) casava dentro de palavras comuns como "para Animais",
 *   "para Passaros", "Produtos para..." → a UF era deduzida como PA (região de
 *   manutenção) e o cliente ficava preso na carteira do João, mesmo estando em SP.
 * - Agora o nome do estado é procurado com LIMITE DE PALAVRA (regex \b), o que evita
 *   falsos positivos. Siglas seguem exigindo fronteira de não-letra.
 *
 * Escopo (o mesmo pedido): clientes `factories` não deletados, `salesOwner` = usuário do
 * João (xhl48ye8ayb8fbu) e SEM vendedor atribuído (`vendedor_id` vazio → aparecem como
 * "Não atribuído" na tela), cuja UF fique FORA de [MT, PA, RO, AC, AM, TO, MA, AP, RR].
 * Cascata: state → city → standardized_address → DDD do telefone/contato.
 * UF indeterminada: nada é alterado. Auditoria em entity_change_logs. Idempotente.
 */

migrate(
  (app) => {
    var KEEP_UFS = ['MT', 'PA', 'RO', 'AC', 'AM', 'TO', 'MA', 'AP', 'RR']
    var KEEP_INDEX = {}
    for (var ki = 0; ki < KEEP_UFS.length; ki++) KEEP_INDEX[KEEP_UFS[ki]] = true

    var SALES_OWNER_ID = 'xhl48ye8ayb8fbu'
    var SALES_OWNER_LABEL = 'xhl48ye8ayb8fbu (João Figueiredo)'

    // Nomes de estado → UF (comparados com limite de palavra, sem acento)
    var STATE_NAME_TO_UF = {
      acre: 'AC',
      alagoas: 'AL',
      amapa: 'AP',
      amazonas: 'AM',
      bahia: 'BA',
      ceara: 'CE',
      'distrito federal': 'DF',
      'espirito santo': 'ES',
      goias: 'GO',
      maranhao: 'MA',
      'mato grosso': 'MT',
      'mato grosso do sul': 'MS',
      'minas gerais': 'MG',
      para: 'PA',
      paraiba: 'PB',
      parana: 'PR',
      pernambuco: 'PE',
      piaui: 'PI',
      'rio de janeiro': 'RJ',
      'rio grande do norte': 'RN',
      'rio grande do sul': 'RS',
      rondonia: 'RO',
      roraima: 'RR',
      'santa catarina': 'SC',
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

    // Limite de palavra caseiro (Goja não garante suporte a \b com acentos já removidos,
    // então usamos regex simples sobre texto normalizado).
    function isWordChar(c) {
      return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
    }

    function containsWholePhrase(haystack, phrase) {
      var from = 0
      while (true) {
        var idx = haystack.indexOf(phrase, from)
        if (idx === -1) return false
        var before = idx === 0 ? '' : haystack.charAt(idx - 1)
        var afterIdx = idx + phrase.length
        var after = afterIdx >= haystack.length ? '' : haystack.charAt(afterIdx)
        if (!isWordChar(before) && !isWordChar(after)) return true
        from = idx + 1
      }
    }

    function ufFromText(text) {
      var t = String(text || '')
      if (!t) return ''
      var norm = stripAccents(t)
      for (var name in STATE_NAME_TO_UF) {
        if (containsWholePhrase(norm, name)) return STATE_NAME_TO_UF[name]
      }
      // Sigla: precisa "sobrar" como token (ex.: "Pirassununga - SP", "Sinop/MT")
      var m = UF_SIGLA_RE.exec(t.toUpperCase())
      if (m) return m[1]
      return ''
    }

    var DDD_TO_UF = {
      11: 'SP',
      12: 'SP',
      13: 'SP',
      14: 'SP',
      15: 'SP',
      16: 'SP',
      17: 'SP',
      18: 'SP',
      19: 'SP',
      21: 'RJ',
      22: 'RJ',
      24: 'RJ',
      27: 'ES',
      28: 'ES',
      31: 'MG',
      32: 'MG',
      33: 'MG',
      34: 'MG',
      35: 'MG',
      37: 'MG',
      38: 'MG',
      41: 'PR',
      42: 'PR',
      43: 'PR',
      44: 'PR',
      45: 'PR',
      46: 'PR',
      47: 'SC',
      48: 'SC',
      49: 'SC',
      51: 'RS',
      53: 'RS',
      54: 'RS',
      55: 'RS',
      61: 'DF',
      62: 'GO',
      63: 'TO',
      64: 'GO',
      65: 'MT',
      66: 'MT',
      67: 'MS',
      68: 'AC',
      69: 'RO',
      71: 'BA',
      73: 'BA',
      74: 'BA',
      75: 'BA',
      77: 'BA',
      79: 'SE',
      81: 'PE',
      82: 'AL',
      83: 'PB',
      84: 'RN',
      85: 'CE',
      86: 'PI',
      87: 'PE',
      88: 'CE',
      89: 'PI',
      91: 'PA',
      92: 'AM',
      93: 'PA',
      94: 'PA',
      95: 'RR',
      96: 'AP',
      97: 'AM',
      98: 'MA',
      99: 'MA',
    }

    function digitsOnly(v) {
      var s = String(v || '')
      var out = ''
      for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i)
        if (c >= '0' && c <= '9') out += c
      }
      return out
    }

    function ufFromPhone(rec) {
      var fields = ['contato', 'contactPhone', 'telefone', 'contactName']
      for (var f = 0; f < fields.length; f++) {
        var raw = String(rec.getString(fields[f]) || '')
        if (!raw || raw.indexOf('@') !== -1) continue
        var d = digitsOnly(raw)
        if ((d.length === 12 || d.length === 13) && d.substring(0, 2) === '55') d = d.substring(2)
        if (d.length < 10) continue
        var ddd = parseInt(d.substring(0, 2), 10)
        if (DDD_TO_UF[ddd]) return DDD_TO_UF[ddd]
      }
      return ''
    }

    function inferUF(rec) {
      var st = String(rec.getString('state') || '').trim()
      if (st && st !== '-' && st !== '—') {
        var up = st.toUpperCase()
        if (KEEP_INDEX[up]) return up
        var byNameState = STATE_NAME_TO_UF[stripAccents(st)]
        if (byNameState) return byNameState
        var foundState = ufFromText(st)
        if (foundState) return foundState
      }
      var byCity = ufFromText(rec.getString('city'))
      if (byCity) return byCity
      var byAddr = ufFromText(rec.getString('standardized_address'))
      if (byAddr) return byAddr
      return ufFromPhone(rec)
    }

    function relFirst(v) {
      if (v === null || v === undefined) return ''
      if (typeof v === 'string') return v
      try {
        if (typeof v.length === 'number') return v.length > 0 ? String(v[0]) : ''
      } catch (_) {}
      return String(v)
    }

    function hasVendedor(rec) {
      if (relFirst(rec.get('vendedor_id'))) return true
      try {
        if (String(rec.getString('vendedor_id') || '')) return true
      } catch (_) {}
      return false
    }

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0146] entity_change_logs indisponível:', e)
    }

    var records = app.findRecordsByFilter(
      'factories',
      'salesOwner = {:sid} && is_deleted != true',
      '',
      0,
      0,
      { sid: SALES_OWNER_ID },
    )

    var totalScanned = 0
    var alreadyAssigned = 0
    var unbound = 0
    var keptInRegion = 0
    var indeterminate = 0
    var unboundByUf = {}
    var keptByUf = {}
    var indeterminateNames = []

    records.forEach((rec) => {
      totalScanned++

      if (hasVendedor(rec)) {
        alreadyAssigned++
        return
      }

      var uf = inferUF(rec)

      if (!uf) {
        indeterminate++
        if (indeterminateNames.length < 40) {
          indeterminateNames.push(rec.getString('name') || rec.id)
        }
        return
      }

      if (KEEP_INDEX[uf]) {
        keptInRegion++
        keptByUf[uf] = (keptByUf[uf] || 0) + 1
        return
      }

      var clienteNome = rec.getString('name') || rec.id
      var ufFinal = uf
      app.runInTransaction((txApp) => {
        rec.set('salesOwner', '')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', rec.id)
          log.set('entity_name', clienteNome)
          log.set('user_name', 'Sistema (Migração 0146)')
          log.set('field', 'salesOwner')
          log.set('old_value', SALES_OWNER_LABEL)
          log.set('new_value', '')
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Desvinculação automática: cliente SEM vendedor atribuído, UF ' +
              ufFinal +
              ' fora da região de manutenção [MT, PA, RO, AC, AM, TO, MA, AP, RR].',
          )
          txApp.save(log)
        }
      })

      unbound++
      unboundByUf[uf] = (unboundByUf[uf] || 0) + 1
    })

    console.log(
      '[0146] total=' +
        totalScanned +
        ' desvinculados=' +
        unbound +
        ' com_vendedor=' +
        alreadyAssigned +
        ' na_regiao=' +
        keptInRegion +
        ' indeterminados=' +
        indeterminate,
      'porUF_desvinculados=' + JSON.stringify(unboundByUf),
      'porUF_mantidos=' + JSON.stringify(keptByUf),
      'indeterminados=' + JSON.stringify(indeterminateNames),
    )
  },
  (app) => {
    // Rollback no-op: os alterados estão em entity_change_logs (Migração 0146).
  },
)
