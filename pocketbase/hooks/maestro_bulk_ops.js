/// <reference path="../pb_data/types.d.ts" />

/**
 * MAESTRO — Operações de dados em lote sobre clientes (factories).
 *
 * POST /backend/v1/maestro/bulk-op
 * Executa no servidor operações em lote solicitadas via chat do MAESTRO,
 * sempre APÓS confirmação explícita do usuário no frontend (confirm=true).
 * A prévia (confirm=false) devolve apenas a contagem por UF, sem alterar nada.
 *
 * Operações suportadas (field "op"):
 *  - "unassign": limpa vendedor_id dos clientes filtrados (ficam sem vendedor)
 *  - "assign": define vendedor_id dos clientes filtrados
 *  - "transfer": move clientes de from_vendedor_id para vendedor_id
 *
 * Filtros:
 *  - states: UFs a INCLUIR (ex: ["MT","PA"])
 *  - exclude_states: UFs a EXCLUIR (ex: todos fora de MT, PA, RO...)
 *  - segment: carteira/segmento (AVES, PETS, RUMINANTES, SUINOS, AQUA)
 *  - vendedor_id: restringe a clientes já vinculados a este vendedor
 *
 * Regra de segurança: clientes com UF INDETERMINADA nunca são afetados por
 * filtros de UF — permanecem intactos e são reportados separadamente.
 * Cada alteração é registrada em factory_change_logs (auditoria).
 */

var MAESTRO_KEEP_UFS = {
  MT: true,
  PA: true,
  RO: true,
  AC: true,
  AM: true,
  TO: true,
  MA: true,
  AP: true,
  RR: true,
}

var MAESTRO_UF_SET = {}
;(function () {
  var ufs = [
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
  for (var i = 0; i < ufs.length; i++) MAESTRO_UF_SET[ufs[i]] = true
})()

var MAESTRO_STATE_NAMES = {
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

// Cidades → UF (último recurso, quando state/city/standardized_address não trazem a UF)
var MAESTRO_CITY_UF = {
  sinop: 'MT',
  'tangará da serra': 'MT',
  'tangara da serra': 'MT',
  cuiabá: 'MT',
  cuiaba: 'MT',
  'várzea grande': 'MT',
  'varzea grande': 'MT',
  rondonópolis: 'MT',
  rondonopolis: 'MT',
  sorriso: 'MT',
  'lucas do rio verde': 'MT',
  altamira: 'PA',
  belém: 'PA',
  belem: 'PA',
  paragominas: 'PA',
  marabá: 'PA',
  maraba: 'PA',
  'porto velho': 'RO',
  vilhena: 'RO',
  ariquemes: 'RO',
  'ji-paraná': 'RO',
  'rio branco': 'AC',
  manaus: 'AM',
  parintins: 'AM',
  palmas: 'TO',
  araguaína: 'TO',
  araguaina: 'TO',
  'são luís': 'MA',
  'sao luis': 'MA',
  imperatriz: 'MA',
  macapá: 'AP',
  macapa: 'AP',
  'boa vista': 'RR',
  campinas: 'SP',
  'são paulo': 'SP',
  'sao paulo': 'SP',
  mirassol: 'SP',
  'são josé do rio preto': 'SP',
  'sao jose do rio preto': 'SP',
  'ribeirão preto': 'SP',
  'ribeirao preto': 'SP',
  uberlândia: 'MG',
  uberlandia: 'MG',
  londrina: 'PR',
  curitiba: 'PR',
  'porto alegre': 'RS',
  salvador: 'BA',
  recife: 'PE',
  fortaleza: 'CE',
  goiânia: 'GO',
  goiania: 'GO',
  brasília: 'DF',
  brasilia: 'DF',
  vitória: 'ES',
  vitoria: 'ES',
}

function maestroNormText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íì]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úù]/g, 'u')
    .replace(/â/g, 'a')
    .trim()
}

function maestroExtractUf(record) {
  // 1. Campo state
  var st = String(record.get('state') || '')
    .trim()
    .toUpperCase()
  if (st) {
    if (MAESTRO_UF_SET[st]) return st
    var byName = MAESTRO_STATE_NAMES[maestroNormText(st)]
    if (byName) return byName
  }

  // 2. city e standardized_address: "Sinop, Mato Grosso" / "Tangará da Serra - MT, CEP:..."
  var candidates = [
    String(record.get('city') || ''),
    String(record.get('standardized_address') || ''),
  ]
  for (var c = 0; c < candidates.length; c++) {
    var txt = candidates[c]
    if (!txt) continue
    var m = txt.match(/[-,\s]([A-Za-z]{2})\s*(?:,|$|\sCEP)/)
    if (m) {
      var uf = m[1].toUpperCase()
      if (MAESTRO_UF_SET[uf]) return uf
    }
    var norm = maestroNormText(txt)
    for (var name in MAESTRO_STATE_NAMES) {
      if (norm.indexOf(name) !== -1) return MAESTRO_STATE_NAMES[name]
    }
    var cityNorm = maestroNormText(txt.split(/[-,]/)[0])
    if (MAESTRO_CITY_UF[cityNorm]) return MAESTRO_CITY_UF[cityNorm]
  }

  // 3. Coordenadas (bounding boxes por UF, aproximadas)
  var lat = parseFloat(String(record.get('lat') || record.get('latitude') || ''))
  var lng = parseFloat(String(record.get('lng') || record.get('longitude') || ''))
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
    if (lat >= -17.7 && lat <= -7.9 && lng >= -61.7 && lng <= -50.2) return 'MT'
    if (lat >= -10.4 && lat <= -1.8 && lng >= -58.9 && lng <= -46.6) return 'PA'
    if (lat >= -13.8 && lat <= -7.9 && lng >= -66.8 && lng <= -59.8) return 'RO'
    if (lat >= -11.3 && lat <= -7.4 && lng >= -73.9 && lng <= -66.6) return 'AC'
    if (lat >= -7.6 && lat <= -0.7 && lng >= -70.9 && lng <= -55.9) return 'AM'
    if (lat >= -12.7 && lat <= -5.2 && lng >= -50.3 && lng <= -45.9) return 'TO'
    if (lat >= -3.5 && lat <= -1.0 && lng >= -46.3 && lng <= -41.8) return 'MA'
    if (lat >= 0.1 && lat <= 2.5 && lng >= -54.9 && lng <= -49.5) return 'AP'
    if (lat >= -1.2 && lat <= 5.3 && lng >= -64.9 && lng <= -58.9) return 'RR'
  }

  return '' // UF indeterminada — nunca desvincular por estado
}

function maestroLogChange(factoryId, userName, field, oldValue, newValue, summary) {
  try {
    var col = $app.findCollectionByNameOrId('factory_change_logs')
    var rec = new Record(col)
    rec.set('factory_id', factoryId)
    rec.set('user_name', userName)
    rec.set('field', field)
    rec.set('old_value', oldValue)
    rec.set('new_value', newValue)
    rec.set('change_summary', summary)
    $app.save(rec)
  } catch (err) {
    $app.logger().warn('maestro_bulk_ops: falha ao gravar log de auditoria', 'error', String(err))
  }
}

routerAdd(
  'POST',
  '/backend/v1/maestro/bulk-op',
  (e) => {
    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('auth required')

    const body = e.requestInfo().body || {}
    const op = String(body.op || '')
    const confirm = body.confirm === true
    const states = Array.isArray(body.states) ? body.states.map((s) => String(s).toUpperCase()) : []
    const excludeStates = Array.isArray(body.exclude_states)
      ? body.exclude_states.map((s) => String(s).toUpperCase())
      : []
    const segment = String(body.segment || '')
      .trim()
      .toUpperCase()
    const fromVendedorId = String(body.from_vendedor_id || '').trim()
    const vendedorId = String(body.vendedor_id || '').trim()
    const vendedorName = String(body.vendedor_name || '').trim()

    if (['unassign', 'assign', 'transfer'].indexOf(op) === -1) {
      return e.badRequestError('op deve ser: unassign, assign ou transfer')
    }
    if ((op === 'assign' || op === 'transfer') && !vendedorId) {
      return e.badRequestError('vendedor_id é obrigatório para assign/transfer')
    }
    if (op === 'transfer' && !fromVendedorId) {
      return e.badRequestError('from_vendedor_id é obrigatório para transfer')
    }
    if (!states.length && !excludeStates.length) {
      return e.badRequestError('informe states ou exclude_states para a operação em lote')
    }
    if (
      op === 'unassign' &&
      excludeStates.length &&
      fromVendedorId &&
      fromVendedorId === '4urt19q2phjs7fn'
    ) {
      for (var k = 0; k < excludeStates.length; k++) {
        if (!MAESTRO_KEEP_UFS[excludeStates[k]]) {
          return e.badRequestError(
            'UF ' + excludeStates[k] + ' não está na lista de manutenção da região do vendedor',
          )
        }
      }
    }
    if (op === 'assign' && vendedorId === fromVendedorId) {
      return e.badRequestError('vendedor_id de destino não pode ser igual ao de origem')
    }

    if (!confirm) {
      // ---- PRÉVIA: apenas contagem por UF, nada é alterado ----
      var byUf = {}
      var total = 0
      var undetermined = 0
      var pages = 0
      var allRecords = []
      var batch = 500
      var filterParts = ['is_deleted != true']
      if (fromVendedorId) filterParts.push('vendedor_id = "' + fromVendedorId + '"')
      if (vendedorId && op === 'unassign') filterParts.push('vendedor_id != ""')
      var filter = filterParts.join(' && ')

      var lastId = ''
      for (;;) {
        var pageFilter = filter
        if (lastId) pageFilter += ' && id > "' + lastId + '"'
        var records = $app.findRecordsByFilter('factories', pageFilter, 'id', batch, 0)
        if (!records.length) break
        for (var r = 0; r < records.length; r++) {
          var rec2 = records[r]
          lastId = rec2.get('id')
          var uf = maestroExtractUf(rec2)
          if (!uf) {
            undetermined++
            continue
          }
          var inStates = !states.length || states.indexOf(uf) !== -1
          var excluded = excludeStates.length && excludeStates.indexOf(uf) !== -1
          if (!inStates || excluded) continue
          var key = uf
          byUf[key] = (byUf[key] || 0) + 1
          total++
        }
        if (++pages > 100) break // trava de segurança: 50k registros
      }

      return e.json(200, {
        success: true,
        preview: true,
        total,
        undetermined,
        by_uf: byUf,
        message:
          'Prévia: ' +
          total +
          ' cliente(s) afetado(s)' +
          (undetermined ? '; ' + undetermined + ' com UF indeterminada foram preservados' : ''),
      })
    }

    // ---- EXECUÇÃO (confirm=true) ----
    var affected = 0
    var undet2 = 0
    var errors2 = 0
    var lastId2 = ''
    var batch2 = 200
    var filterParts2 = ['is_deleted != true']
    if (fromVendedorId) filterParts2.push('vendedor_id = "' + fromVendedorId + '"')
    if (op === 'unassign' && vendedorId) filterParts2.push('vendedor_id != ""')

    for (;;) {
      var pageFilter2 = filterParts2.join(' && ')
      if (lastId2) pageFilter2 += ' && id > "' + lastId2 + '"'
      var recs = $app.findRecordsByFilter('factories', pageFilter2, 'id', batch2, 0)
      if (!recs.length) break
      for (var i = 0; i < recs.length; i++) {
        var factory = recs[i]
        lastId2 = factory.get('id')
        var uf2 = maestroExtractUf(factory)
        if (!uf2) {
          undet2++
          continue
        }
        var okStates = !states.length || states.indexOf(uf2) !== -1
        var isExcluded = excludeStates.length && excludeStates.indexOf(uf2) !== -1
        if (!okStates || isExcluded) continue

        var oldValue = ''
        var newValue = ''
        if (op === 'unassign') {
          oldValue = vendedorName
            ? vendedorName + ' (' + (fromVendedorId || 'atual') + ')'
            : String(factory.get('vendedor_id') || '')
          newValue = ''
          if (!factory.get('vendedor_id')) continue // já sem vendedor
        } else if (op === 'assign') {
          oldValue = String(factory.get('vendedor_id') || '')
          newValue = vendedorId
          if (oldValue === newValue) continue
        } else {
          oldValue = fromVendedorId
          newValue = vendedorId
        }

        factory.set('vendedor_id', newValue)
        $app.save(factory)
        affected++

        var oldLabel = oldValue
        if (op === 'unassign') {
          oldLabel = vendedorName
            ? vendedorName + ' (' + (fromVendedorId || 'atual') + ')'
            : 'vendedor ' + (oldValue || '(sem vendedor)')
        }
        maestroLogChange(
          factory.get('id'),
          'Sistema (Maestro)',
          'vendedor_id',
          oldLabel,
          newValue,
          'Maestro: ' + op + ' — UF ' + uf2,
        )
      }
    }

    $app
      .logger()
      .info(
        'maestro_bulk_ops: executado',
        'op',
        op,
        'afetados',
        String(affected),
        'indeterminados',
        String(undet2),
        'erros',
        String(errors2),
      )

    return e.json(200, {
      success: true,
      preview: false,
      affected,
      undetermined: undet2,
      errors: errors2,
      message:
        'Operação "' +
        op +
        '" concluída: ' +
        affected +
        ' cliente(s) afetado(s)' +
        (undet2 ? '; ' + undet2 + ' com UF indeterminada foram preservados' : ''),
    })
  },
  $apis.requireAuth(),
)
