/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0142: Desvincula clientes (factories) do vendedor João Figueiredo
 * que NÃO estejam nas UFs [MT, PA, RO, AC, AM, TO, MA, AP, RR].
 *
 * Regras:
 * - O vínculo cliente↔vendedor é o campo `vendedor_id` (relation → gestao_tecnica).
 * - Vendedor canônico: "João Figueiredo" (registro 4urt19q2phjs7fn). "João Pedro" é a mesma pessoa,
 *   porém já foi unificado em migrações anteriores (0121/0133); caso ainda exista algum registro
 *   apontando para outro id de gestao_tecnica com nome "João Pedro", ele também é varrido.
 * - A UF é deduzida de `state` → senão `city`/`standardized_address` → senão coordenadas.
 * - UF indeterminada: NÃO altera o registro (mantém o vínculo).
 * - Cada desvinculação é auditada em `factory_change_logs`.
 * - Idempotente: em uma base já migrada, não há vendedor_id para varrer e nada é alterado.
 */

var KEEP_UFS = ['MT', 'PA', 'RO', 'AC', 'AM', 'TO', 'MA', 'AP', 'RR']
var JOAO_ID = '4urt19q2phjs7fn'
var JOAO_NAME = 'João Figueiredo'

var KEEP_INDEX = {}
for (var _i = 0; _i < KEEP_UFS.length; _i++) KEEP_INDEX[KEEP_UFS[_i]] = true

var STATE_NAME_TO_UF = {
  Acre: 'AC',
  Alagoas: 'AL',
  Amapá: 'AP',
  Amazonas: 'AM',
  Bahia: 'BA',
  Ceará: 'CE',
  'Distrito Federal': 'DF',
  'Espírito Santo': 'ES',
  Goiás: 'GO',
  Maranhão: 'MA',
  'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG',
  Pará: 'PA',
  Paraíba: 'PB',
  Paraná: 'PR',
  Pernambuco: 'PE',
  Piauí: 'PI',
  'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS',
  Rondônia: 'RO',
  Roraima: 'RR',
  'Santa Catarina': 'SC',
  'São Paulo': 'SP',
  Sergipe: 'SE',
  Tocantins: 'TO',
}

var UF_SIGLA_RE =
  /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/g

// Bounding boxes aproximados (latMin, lngMin, latMax, lngMax) — usados APENAS para manter
// o vínculo quando as coordenadas caem claramente na região de manutenção.
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
  // 1) Nome completo do estado (case-insensitive)
  var lower = t.toLowerCase()
  for (var name in STATE_NAME_TO_UF) {
    if (lower.indexOf(name.toLowerCase()) !== -1) return STATE_NAME_TO_UF[name]
  }
  // 2) Sigla isolada em caixa alta
  UF_SIGLA_RE.lastIndex = 0
  var m = UF_SIGLA_RE.exec(t.toUpperCase())
  if (m) return m[1]
  return ''
}

function ufInKeepBox(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) return ''
  for (var uf in KEEP_BOXES) {
    var b = KEEP_BOXES[uf]
    if (lat >= b[0] && lng >= b[1] && lat <= b[2] && lng <= b[3]) return uf
  }
  return ''
}

function inferUF(rec) {
  var st = String(rec.getString('state') || '').trim()
  if (st) {
    var up = st.toUpperCase()
    if (KEEP_INDEX[up]) return up
    if (STATE_NAME_TO_UF[st]) return STATE_NAME_TO_UF[st]
    var found = ufFromText(st)
    if (found) return found
  }
  var uf = ufFromText(rec.getString('city'))
  if (uf) return uf
  uf = ufFromText(rec.getString('standardized_address'))
  if (uf) return uf
  var lat = parseFloat(rec.getString('latitude') || rec.getString('lat') || '')
  var lng = parseFloat(rec.getString('longitude') || rec.getString('lng') || '')
  return ufInKeepBox(lat, lng)
}

migrate(
  (app) => {
    // Varre o vínculo canônico de João Figueiredo (e eventual resquício de "João Pedro")
    var sellerIds = [JOAO_ID]
    try {
      var joaoPedro = $app.findRecordsByFilter('gestao_tecnica', 'nome = {:n}', '', 0, 0, {
        n: 'João Pedro',
      })
      joaoPedro.forEach((r) => {
        if (r.id !== JOAO_ID) sellerIds.push(r.id)
      })
    } catch (_) {}

    var totalScanned = 0
    var unbound = 0
    var keptInRegion = 0
    var indeterminate = 0
    var unboundByUf = {}
    var keptByUf = {}
    var logCol = app.findCollectionByNameOrId('factory_change_logs')

    sellerIds.forEach((sellerId) => {
      var records = $app.findRecordsByFilter(
        'factories',
        'vendedor_id = {:vid} && is_deleted != true',
        '',
        0,
        0,
        { vid: sellerId },
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

        // Fora da região: limpa SOMENTE vendedor_id e registra auditoria.
        var clienteNome = rec.getString('name') || rec.id
        app.runInTransaction((txApp) => {
          rec.set('vendedor_id', '')
          txApp.save(rec)

          var log = new Record(logCol)
          log.set('factory_id', rec.id)
          log.set('user_name', 'Sistema (Migração 0142)')
          log.set('field', 'vendedor_id')
          log.set('old_value', JOAO_NAME + ' (' + sellerId + ')')
          log.set('new_value', '')
          log.set(
            'change_summary',
            'Desvinculação automática (' +
              JOAO_NAME +
              '): UF ' +
              uf +
              ' fora da região de manutenção [MT, PA, RO, AC, AM, TO, MA, AP, RR]. Cliente: ' +
              clienteNome,
          )
          txApp.save(log)
        })

        unbound++
        unboundByUf[uf] = (unboundByUf[uf] || 0) + 1
      })
    })

    console.log(
      '[0142] Varredura João Figueiredo: total=' +
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
