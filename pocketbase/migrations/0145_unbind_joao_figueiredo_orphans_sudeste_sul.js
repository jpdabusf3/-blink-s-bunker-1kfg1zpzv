/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0145: Desvincula de João Figueiredo os clientes SEM VENDEDOR ATRIBUÍDO
 * localizados no Sudeste/Sul.
 *
 * Contexto (o que as 0142 e 0144 não resolveram):
 * - A tela Cadastro exibe "Não atribuído" quando `vendedor_id` está vazio (o campo
 *   `vendedor_name` nem existe na collection).
 * - MAS o filtro de vendedor (src/lib/vendedorFilterHelper.ts) casa por QUALQUER um dos
 *   campos: vendedor_id, salesOwner, gestor_tecnico_id e suas expansões. Como `salesOwner`
 *   ainda aponta para o usuário do João (xhl48ye8ayb8fbu), o cliente aparece na lista dele.
 * - A 0144 limpou `salesOwner` apenas quando a UF era determinável. Os registros sem
 *   `state` E sem `city` ficaram "indeterminados" e mantiveram o vínculo — eram eles que
 *   continuavam aparecendo.
 *
 * Regras desta migração:
 * - Alvo: `factories` não deletadas, com `salesOwner` de João (usuário xhl48ye8ayb8fbu),
 *   `vendedor_id` VAZIO (ou seja, "Não atribuído" na tela) e UF no Sudeste/Sul.
 * - UF deduzida em cascata: state (sigla ou nome) → city → DDD do telefone/contato.
 * - UF indeterminada: NADA é alterado (o registro é mantido, apenas contado).
 * - UF fora do Sudeste/Sul: nada é alterado.
 * - Limpa SOMENTE `salesOwner`, com auditoria em `entity_change_logs`.
 * - Idempotente.
 */

migrate(
  (app) => {
    var SE_SUL = ['SP', 'PR', 'RS', 'SC', 'MG', 'ES', 'RJ']
    var SE_SUL_INDEX = {}
    for (var si = 0; si < SE_SUL.length; si++) SE_SUL_INDEX[SE_SUL[si]] = true

    var SALES_OWNER_ID = 'xhl48ye8ayb8fbu' // usuário login do João (João Pedro / João Figueiredo)
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

    // DDD -> UF (apenas para o Sudeste/Sul, que é o escopo desta migração)
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
      for (var i = 0; i < fields.length; i++) {
        var raw = String(rec.getString(fields[i]) || '')
        if (!raw || raw.indexOf('@') !== -1) continue
        var d = digitsOnly(raw)
        // Remove código do país quando presente
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
        if (SE_SUL_INDEX[up]) return up
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
    var keptOutside = 0
    var indeterminate = 0
    var unboundByUf = {}
    var keptByUf = {}

    records.forEach((rec) => {
      totalScanned++

      // Só mexe em quem está "Não atribuído" (sem vendedor_id)
      if (String(rec.getString('vendedor_id') || '').trim() !== '') {
        alreadyAssigned++
        return
      }

      var uf = inferUF(rec)

      if (!uf) {
        indeterminate++
        return
      }

      if (!SE_SUL_INDEX[uf]) {
        keptOutside++
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
              ' (Sudeste/Sul), removido da carteira de João Figueiredo.',
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
        ' (já tinham vendedor=' +
        alreadyAssigned +
        ', fora do SE/Sul=' +
        keptOutside +
        ', UF indeterminada=' +
        indeterminate +
        ')',
      'porUF_desvinculados=' + JSON.stringify(unboundByUf),
      'porUF_mantidos=' + JSON.stringify(keptByUf),
    )
  },
  (app) => {
    // Rollback no-op: a lista completa dos registros alterados está em entity_change_logs
    // (user_name = "Sistema (Migração 0145)").
  },
)
