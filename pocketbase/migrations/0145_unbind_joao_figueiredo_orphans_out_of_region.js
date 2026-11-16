/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0145: Remove da carteira de João Figueiredo os clientes SEM VENDEDOR ATRIBUÍDO
 * que estão FORA da região de atuação dele.
 *
 * Diagnóstico (por que as 0142/0144 não bastaram):
 * - A tela Cadastro mostra "Não atribuído" quando `vendedor_id` está vazio. Só que essa
 *   collection NÃO tem campo `vendedor_name` — o rótulo vem de `vendedor_id`/expansões.
 * - O filtro de vendedor (src/lib/vendedorFilterHelper.ts) casa por QUALQUER um destes:
 *   vendedor_id, salesOwner, gestor_tecnico_id e suas expansões. Como `salesOwner` seguia
 *   apontando para o usuário do João (xhl48ye8ayb8fbu), o cliente continuava listado nele.
 * - A 0144 limpou `salesOwner` apenas quando a UF era determinável por state/city/endereço.
 *   Os registros sem `state`, sem `city` e com endereço vazio ficaram "indeterminados" e
 *   mantiveram o vínculo. Além disso ela cobria só a UF, não o DDD.
 *
 * Regras desta migração:
 * - Alvo: `factories` não deletadas, `salesOwner` = usuário do João E `vendedor_id` vazio
 *   ("Não atribuído" na tela).
 * - UF deduzida em cascata: state (sigla ou nome) → city → standardized_address →
 *   DDD do telefone/contato.
 * - UF fora da região [MT, PA, RO, AC, AM, TO, MA, AP, RR]: limpa SOMENTE `salesOwner`,
 *   com auditoria em `entity_change_logs`.
 * - UF dentro da região: intacto. UF indeterminada: intacto (apenas contado).
 * - Idempotente.
 */

migrate(
  (app) => {
    var KEEP_UFS = ['MT', 'PA', 'RO', 'AC', 'AM', 'TO', 'MA', 'AP', 'RR']
    var KEEP_INDEX = {}
    for (var ki = 0; ki < KEEP_UFS.length; ki++) KEEP_INDEX[KEEP_UFS[ki]] = true

    var SALES_OWNER_ID = 'xhl48ye8ayb8fbu' // login do João (João Pedro / João Figueiredo)
    var SALES_OWNER_LABEL = 'xhl48ye8ayb8fbu (João Figueiredo)'

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

    // DDD -> UF (cobre todo o país; a região de manutenção é decidida depois)
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
      if (st) {
        var up = st.toUpperCase()
        if (KEEP_INDEX[up]) return up
        var byName = STATE_NAME_TO_UF[stripAccents(st)]
        if (byName) return byName
        var found = ufFromText(st)
        if (found) return found
      }
      var byCity = ufFromText(rec.getString('city'))
      if (byCity) return byCity
      var byAddr = ufFromText(rec.getString('standardized_address'))
      if (byAddr) return byAddr
      return ufFromPhone(rec)
    }

    // Relação pode vir como string ou array; normaliza para o primeiro id.
    function relFirst(v) {
      if (v === null || v === undefined) return ''
      if (typeof v === 'string') return v
      try {
        if (typeof v.length === 'number') return v.length > 0 ? String(v[0]) : ''
      } catch (_) {}
      return String(v)
    }

    function hasVendedor(rec) {
      var a = relFirst(rec.get('vendedor_id'))
      if (a) return true
      try {
        if (String(rec.getString('vendedor_id') || '')) return true
      } catch (_) {}
      return false
    }

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0145] entity_change_logs indisponível:', e)
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

    records.forEach((rec) => {
      totalScanned++

      if (hasVendedor(rec)) {
        alreadyAssigned++
        return
      }

      var uf = inferUF(rec)

      if (!uf) {
        indeterminate++
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
          log.set('user_name', 'Sistema (Migração 0145)')
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
      '[0145] Varredura salesOwner=João: total=' +
        totalScanned +
        ' desvinculados=' +
        unbound +
        ' (com vendedor=' +
        alreadyAssigned +
        ', na região=' +
        keptInRegion +
        ', UF indeterminada=' +
        indeterminate +
        ')',
      'porUF_desvinculados=' + JSON.stringify(unboundByUf),
      'porUF_mantidos=' + JSON.stringify(keptByUf),
    )
  },
  (app) => {
    // Rollback no-op: os registros alterados estão em entity_change_logs
    // (user_name = "Sistema (Migração 0145)").
  },
)
