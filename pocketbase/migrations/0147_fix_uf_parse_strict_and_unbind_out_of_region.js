/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0147: corrige definitivamente a dedução de UF e conclui a desvinculação.
 *
 * O que ainda falhava (0145/0146):
 * - A dedução procurava nomes de estado como palavra dentro de QUALQUER texto. Em
 *   "PROTEIN PRODUTOS PARA PASSAROS LTDA" a palavra "para" é uma palavra inteira, então
 *   o limite de palavra da 0146 não resolveu: continuou sendo lido como Pará.
 * - O endereço padronizado tem formato fixo:
 *     "<Razão>, <nº> - <Bairro>, <Cidade> - <UF>, CEP: <cep>"
 *   Quando cidade/UF não existem, ele fica "...,  - , CEP: " — sem NENHUMA informação de
 *   UF. Procurar nome de estado no texto inteiro ali é sempre um falso positivo.
 *
 * Regras de dedução agora:
 * 1) `state`: sigla exata, ou nome do estado exato, ou nome como palavra inteira
 *    (é um campo dedicado a estado, então isso é seguro).
 * 2) `city`: se houver vírgula, compara só o trecho após a ÚLTIMA vírgula com o nome do
 *    estado (ex.: "Castanheira, Mato Grosso"); sem vírgula, exige igualdade exata com o
 *    nome do estado — nunca substring.
 * 3) `standardized_address`: lê APENAS o campo de UF do template (trecho entre o último
 *    " - " e ", CEP:"), que precisa ser uma sigla válida. Nada de buscar nomes no texto.
 * 4) DDD do telefone/contato.
 *
 * Escopo: `factories` não deletadas, `salesOwner` = xhl48ye8ayb8fbu (João) e SEM vendedor
 * atribuído; UF fora de [MT, PA, RO, AC, AM, TO, MA, AP, RR] → limpa `salesOwner`.
 * UF indeterminada ou dentro da região: intacto. Auditoria. Idempotente.
 */

migrate(
  (app) => {
    var KEEP_UFS = ['MT', 'PA', 'RO', 'AC', 'AM', 'TO', 'MA', 'AP', 'RR']
    var KEEP_INDEX = {}
    for (var ki = 0; ki < KEEP_UFS.length; ki++) KEEP_INDEX[KEEP_UFS[ki]] = true

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
    var VALID_INDEX = {}
    for (var vi = 0; vi < VALID_UFS.length; vi++) VALID_INDEX[VALID_UFS[vi]] = true

    var SALES_OWNER_ID = 'xhl48ye8ayb8fbu'
    var SALES_OWNER_LABEL = 'xhl48ye8ayb8fbu (João Figueiredo)'

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

    function normText(s) {
      return stripAccents(String(s || ''))
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[.,;:-\s]+|[.,;:-\s]+$/g, '')
    }

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

    // 1) Campo `state`: aceita sigla ou nome (nome pode vir com palavra extra)
    function ufFromStateField(raw) {
      var t = normText(raw)
      if (!t) return ''
      var up = t.toUpperCase()
      if (VALID_INDEX[up]) return up
      if (STATE_NAME_TO_UF[t]) return STATE_NAME_TO_UF[t]
      for (var name in STATE_NAME_TO_UF) {
        if (containsWholePhrase(t, name)) return STATE_NAME_TO_UF[name]
      }
      return ''
    }

    // 2) Campo `city`: "Cidade, Estado" ou nome de estado puro. Nunca substring solta.
    function ufFromCityField(raw) {
      var t = normText(raw)
      if (!t) return ''
      var up = t.toUpperCase()
      if (VALID_INDEX[up]) return up
      if (STATE_NAME_TO_UF[t]) return STATE_NAME_TO_UF[t]
      var comma = t.lastIndexOf(',')
      if (comma !== -1) {
        var tail = normText(t.substring(comma + 1))
        if (STATE_NAME_TO_UF[tail]) return STATE_NAME_TO_UF[tail]
        if (VALID_INDEX[tail.toUpperCase()]) return tail.toUpperCase()
      }
      return ''
    }

    // 3) `standardized_address`: só o campo de UF do template "<..., Cidade> - <UF>, CEP: ..."
    function ufFromAddressTemplate(raw) {
      var t = String(raw || '')
      if (!t) return ''
      var cut = t.indexOf(', CEP:')
      var head = cut === -1 ? t : t.substring(0, cut)
      var lastDash = head.lastIndexOf(' - ')
      if (lastDash === -1) return ''
      var tail = normText(head.substring(lastDash + 3)).toUpperCase()
      if (VALID_INDEX[tail]) return tail
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

    var SOURCES = ['state', 'city', 'address', 'phone']

    function inferUF(rec) {
      var uf = ufFromStateField(rec.getString('state'))
      if (uf) return { uf: uf, src: 'state' }
      uf = ufFromCityField(rec.getString('city'))
      if (uf) return { uf: uf, src: 'city' }
      uf = ufFromAddressTemplate(rec.getString('standardized_address'))
      if (uf) return { uf: uf, src: 'address' }
      uf = ufFromPhone(rec)
      if (uf) return { uf: uf, src: 'phone' }
      return { uf: '', src: '' }
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
      console.log('[0147] entity_change_logs indisponível:', e)
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
    var bySource = {}
    var indeterminateNames = []

    records.forEach((rec) => {
      totalScanned++

      if (hasVendedor(rec)) {
        alreadyAssigned++
        return
      }

      var res = inferUF(rec)

      if (!res.uf) {
        indeterminate++
        if (indeterminateNames.length < 60) {
          indeterminateNames.push(rec.getString('name') || rec.id)
        }
        return
      }

      bySource[res.src] = (bySource[res.src] || 0) + 1

      if (KEEP_INDEX[res.uf]) {
        keptInRegion++
        keptByUf[res.uf] = (keptByUf[res.uf] || 0) + 1
        return
      }

      var clienteNome = rec.getString('name') || rec.id
      var ufFinal = res.uf
      var srcFinal = res.src
      app.runInTransaction((txApp) => {
        rec.set('salesOwner', '')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', rec.id)
          log.set('entity_name', clienteNome)
          log.set('user_name', 'Sistema (Migração 0147)')
          log.set('field', 'salesOwner')
          log.set('old_value', SALES_OWNER_LABEL)
          log.set('new_value', '')
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Desvinculação automática: cliente SEM vendedor atribuído, UF ' +
              ufFinal +
              ' (deduzida de ' +
              srcFinal +
              ') fora da região [MT, PA, RO, AC, AM, TO, MA, AP, RR].',
          )
          txApp.save(log)
        }
      })

      unbound++
      unboundByUf[ufFinal] = (unboundByUf[ufFinal] || 0) + 1
    })

    console.log(
      '[0147] total=' +
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
      'fonte_da_UF=' + JSON.stringify(bySource),
      'indeterminados=' + JSON.stringify(indeterminateNames),
    )
  },
  (app) => {
    // Rollback no-op: os alterados estão em entity_change_logs (Migração 0147).
  },
)
