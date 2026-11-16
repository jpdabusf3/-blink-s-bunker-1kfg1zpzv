/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0148: conclui a desvinculação — remove da carteira de João Figueiredo os
 * clientes SEM VENDEDOR ATRIBUÍDO cuja UF NÃO é determinável.
 *
 * Decisão do usuário (16/11/2026): as migrações 0145-0147 mantinham intactos os registros
 * sem UF determinável (nem state, nem city, nem UF no endereço, nem DDD no telefone).
 * São 34 registros — vários claramente do Sul/Sudeste pelo nome (Matsuda Minas, Campos
 * Gerais, Alibem, Biasoli, Belas Aves, Dispra, Agility, Alivet, Nutrifer) e outros
 * estrangeiros (Guatemala, Chile, Argentina, Paraguai, Uruguai). O usuário confirmou
 * desvincular todos eles.
 *
 * Regra:
 * - Alvo: `factories` não deletadas, `salesOwner` = xhl48ye8ayb8fbu (João) e
 *   `vendedor_id` VAZIO ("Não atribuído" na tela).
 * - Se a UF for determinável e estiver DENTRO de [MT, PA, RO, AC, AM, TO, MA, AP, RR]:
 *   mantém o vínculo.
 * - Se a UF for determinável e estiver FORA: limpa `salesOwner` (idempotente com a 0147).
 * - Se a UF NÃO for determinável: limpa `salesOwner` (novo, por decisão do usuário).
 * - Dedução estrita (sem o falso positivo "para"): state → city (após a última vírgula)
 *   → UF do template do endereço → DDD do telefone.
 * - Auditoria em `entity_change_logs`. Idempotente.
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
      console.log('[0148] entity_change_logs indisponível:', e)
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
    var unboundIndeterminate = 0
    var unboundOutOfRegion = 0
    var keptInRegion = 0
    var keptByUf = {}
    var unboundNames = []

    records.forEach((rec) => {
      totalScanned++

      if (hasVendedor(rec)) {
        alreadyAssigned++
        return
      }

      var res = inferUF(rec)

      // UF determinada e dentro da região de manutenção: mantém
      if (res.uf && KEEP_INDEX[res.uf]) {
        keptInRegion++
        keptByUf[res.uf] = (keptByUf[res.uf] || 0) + 1
        return
      }

      var clienteNome = rec.getString('name') || rec.id
      var motivo = res.uf
        ? 'UF ' + res.uf + ' (deduzida de ' + res.src + ') fora da região'
        : 'UF não determinável (sem estado, cidade, UF no endereço ou DDD)'

      app.runInTransaction((txApp) => {
        rec.set('salesOwner', '')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', rec.id)
          log.set('entity_name', clienteNome)
          log.set('user_name', 'Sistema (Migração 0148)')
          log.set('field', 'salesOwner')
          log.set('old_value', SALES_OWNER_LABEL)
          log.set('new_value', '')
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Desvinculação automática: cliente SEM vendedor atribuído, ' +
              motivo +
              ' — removido da carteira de João Figueiredo. Região de manutenção: [MT, PA, RO, AC, AM, TO, MA, AP, RR].',
          )
          txApp.save(log)
        }
      })

      if (res.uf) unboundOutOfRegion++
      else {
        unboundIndeterminate++
        if (unboundNames.length < 80) unboundNames.push(clienteNome)
      }
    })

    console.log(
      '[0148] total=' +
        totalScanned +
        ' desvinculados=' +
        (unboundOutOfRegion + unboundIndeterminate) +
        ' (fora_da_regiao=' +
        unboundOutOfRegion +
        ' sem_uf=' +
        unboundIndeterminate +
        ') com_vendedor=' +
        alreadyAssigned +
        ' mantidos_na_regiao=' +
        keptInRegion,
      'porUF_mantidos=' + JSON.stringify(keptByUf),
      'sem_uf_desvinculados=' + JSON.stringify(unboundNames),
    )
  },
  (app) => {
    // Rollback no-op: os alterados estão em entity_change_logs (Migração 0148).
  },
)
