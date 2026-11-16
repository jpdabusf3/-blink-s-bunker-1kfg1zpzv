/// <reference path="../pb_data/types.d.ts" />

/**
 * MAESTRO — Operações de dados em lote sobre clientes (factories).
 *
 * POST /backend/v1/maestro-bulk-client-op
 * Executa no servidor operações em lote solicitadas via chat do MAESTRO.
 * Fluxo de duas fases, acionado pelo frontend (maestro-actions.ts):
 *   1. DRY-RUN (confirm=false): apenas conta os clientes que seriam afetados,
 *      por UF — nada é alterado, nada é auditado.
 *   2. EXECUÇÃO (confirm=true): aplica as alterações e grava a auditoria.
 * A confirmação do usuário acontece no cartão do chat entre as duas fases.
 *
 * Operações (campo "op"):
 *  - "unassign": limpa vendedor_id dos clientes filtrados (ficam sem vendedor)
 *  - "assign": define vendedor_id dos clientes filtrados
 *  - "transfer": move clientes de from_vendedor_id para vendedor_id
 *
 * Filtros:
 *  - states: UFs a INCLUIR (ex: ["MT","PA"])
 *  - exclude_states: UFs a EXCLUIR (ex: tudo fora de MT, PA, RO, AC, AM, TO, MA, AP, RR)
 *  - segment: carteira/segmento (AVES, PETS, RUMINANTES, SUINOS, AQUA)
 *  - from_vendedor_id / vendedor_id: restringe aos clientes já vinculados a este vendedor
 *
 * Regra de segurança: clientes com UF INDETERMINADA nunca são afetados por
 * filtros de UF — permanecem intactos e são reportados separadamente.
 * Cada alteração é registrada em factory_change_logs (auditoria).
 */

routerAdd(
  'POST',
  '/backend/v1/maestro-bulk-client-op',
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

    // Vendedor de origem do filtro (para unassign, vendedor_id é aceito como alias)
    let sourceSeller = fromVendedorId
    if (!sourceSeller && op === 'unassign') sourceSeller = vendedorId

    if (['unassign', 'assign', 'transfer'].indexOf(op) === -1) {
      return e.badRequestError('op deve ser: unassign, assign ou transfer')
    }
    if ((op === 'assign' || op === 'transfer') && !vendedorId) {
      return e.badRequestError('vendedor_id é obrigatório para assign/transfer')
    }
    if (op === 'transfer' && !fromVendedorId) {
      return e.badRequestError('from_vendedor_id é obrigatório para transfer')
    }
    if (op === 'unassign' && !sourceSeller) {
      return e.badRequestError('informe from_vendedor_id (vendedor de origem) para unassign')
    }
    if (!states.length && !excludeStates.length) {
      return e.badRequestError('informe states ou exclude_states para a operação em lote')
    }
    if (op === 'transfer' && vendedorId === fromVendedorId) {
      return e.badRequestError('vendedor_id de destino não pode ser igual ao de origem')
    }

    const filterParts = ['is_deleted != true']
    if (sourceSeller) filterParts.push('vendedor_id = "' + sourceSeller + '"')
    if (segment) filterParts.push('carteira = "' + segment + '"')
    const baseFilter = filterParts.join(' && ')

    // Dedução de UF: state → city/standardized_address → coordenadas.
    function extractUf(record) {
      // 1. Campo state
      const st = String(record.get('state') || '')
        .trim()
        .toUpperCase()
      if (st) {
        if (UF_SET[st]) return st
        const byName = STATE_NAMES[normText(st)]
        if (byName) return byName
      }
      // 2. city / standardized_address — ex.: "Sinop, Mato Grosso" / "Tangará da Serra - MT, CEP..."
      const candidates = [
        String(record.get('city') || ''),
        String(record.get('standardized_address') || ''),
      ]
      for (let c = 0; c < candidates.length; c++) {
        const txt = candidates[c]
        if (!txt) continue
        const m = txt.match(/[-,\s]([A-Za-z]{2})\s*(?:,|$|\sCEP)/)
        if (m) {
          const uf = m[1].toUpperCase()
          if (UF_SET[uf]) return uf
        }
        const norm = normText(txt)
        for (const name in STATE_NAMES) {
          if (norm.indexOf(name) !== -1) return STATE_NAMES[name]
        }
        const cityNorm = normText(txt.split(/[-,]/)[0])
        if (CITY_UF[cityNorm]) return CITY_UF[cityNorm]
      }
      // 3. Coordenadas — usadas APENAS para MANTER vínculo (nunca para desvincular)
      const lat = parseFloat(String(record.get('lat') || record.get('latitude') || ''))
      const lng = parseFloat(String(record.get('lng') || record.get('longitude') || ''))
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        for (const uf in KEEP_BOXES) {
          const b = KEEP_BOXES[uf]
          if (lat >= b[0] && lng >= b[1] && lat <= b[2] && lng <= b[3]) return uf
        }
      }
      return '' // UF indeterminada — nunca desvincular por estado
    }

    if (!confirm) {
      // ---- FASE 1: DRY-RUN — apenas contagem por UF, nada é alterado ----
      const byUf = {}
      let total = 0
      let undetermined = 0
      let lastId = ''
      for (let guard = 0; guard < 200; guard++) {
        let pageFilter = baseFilter
        if (lastId) pageFilter += ' && id > "' + lastId + '"'
        const records = $app.findRecordsByFilter('factories', pageFilter, 'id', 500, 0)
        if (!records.length) break
        for (let r = 0; r < records.length; r++) {
          const rec = records[r]
          lastId = rec.get('id')
          const uf = extractUf(rec)
          if (!uf) {
            undetermined++
            continue
          }
          const inStates = !states.length || states.indexOf(uf) !== -1
          const excluded = excludeStates.length && excludeStates.indexOf(uf) !== -1
          if (!inStates || excluded) continue
          byUf[uf] = (byUf[uf] || 0) + 1
          total++
        }
      }

      const previa =
        'Prévia: ' +
        total +
        ' cliente(s) seriam afetado(s)' +
        (undetermined ? '; ' + undetermined + ' com UF indeterminada foram preservados' : '')
      return e.json(200, {
        success: true,
        op: op,
        dry_run: true,
        needs_confirmation: true,
        matched: total,
        indeterminate_uf: undetermined,
        per_uf: byUf,
        summary: previa,
        message: previa,
      })
    }

    // ---- FASE 2: EXECUÇÃO (confirm=true) ----
    let affected = 0
    let matchedTotal = 0
    let undet = 0
    let auditWritten = 0
    const perUf = {}
    let lastId2 = ''

    for (let guard2 = 0; guard2 < 500; guard2++) {
      let pageFilter = baseFilter
      if (lastId2) pageFilter += ' && id > "' + lastId2 + '"'
      const recs = $app.findRecordsByFilter('factories', pageFilter, 'id', 200, 0)
      if (!recs.length) break
      for (let i = 0; i < recs.length; i++) {
        const factory = recs[i]
        lastId2 = factory.get('id')
        const uf = extractUf(factory)
        if (!uf) {
          undet++
          continue
        }
        const okStates = !states.length || states.indexOf(uf) !== -1
        const isExcluded = excludeStates.length && excludeStates.indexOf(uf) !== -1
        if (!okStates || isExcluded) continue

        const oldValue = String(factory.get('vendedor_id') || '')
        let newValue = oldValue
        if (op === 'unassign') {
          if (!oldValue) continue // já sem vendedor
          newValue = ''
        } else if (op === 'assign') {
          if (oldValue === vendedorId) continue
          newValue = vendedorId
        } else {
          if (oldValue !== fromVendedorId) continue
          newValue = vendedorId
        }
        matchedTotal++

        let oldLabel = oldValue
        if (op === 'unassign') {
          oldLabel = vendedorName
            ? vendedorName + ' (' + sourceSeller + ')'
            : 'vendedor ' + (oldValue || '(sem vendedor)')
        }
        factory.set('vendedor_id', newValue)
        $app.save(factory)
        affected++
        perUf[uf] = (perUf[uf] || 0) + 1

        if (
          logChange(
            factory.get('id'),
            'Sistema (Maestro)',
            'vendedor_id',
            oldLabel,
            newValue,
            'Maestro: ' + op + ' — UF ' + uf,
          )
        ) {
          auditWritten++
        }
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
        String(undet),
        'auditoria',
        String(auditWritten),
      )

    return e.json(200, {
      success: true,
      op: op,
      dry_run: false,
      needs_confirmation: false,
      matched: matchedTotal,
      affected: affected,
      indeterminate_uf: undet,
      per_uf: perUf,
      audit_written: auditWritten,
      message:
        'Operação "' +
        op +
        '" concluída: ' +
        affected +
        ' cliente(s) afetado(s)' +
        (undet ? '; ' + undet + ' com UF indeterminada foram preservados' : ''),
    })
  },
  $apis.requireAuth(),
)

// ---------- Helpers (definidos neste mesmo arquivo, escopo do hook) ----------

const UF_SET = {}
const UF_LIST = [
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
for (let i = 0; i < UF_LIST.length; i++) UF_SET[UF_LIST[i]] = true

const STATE_NAMES = {
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

const CITY_UF = {
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

// Bounding boxes aproximados (latMin, lngMin, latMax, lngMax) por UF — só p/ manter vínculo
const KEEP_BOXES = {
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

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íì]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úù]/g, 'u')
    .trim()
}

/**
 * Grava o registro de auditoria em factory_change_logs. Retorna true em caso de sucesso.
 */
function logChange(factoryId, userName, field, oldValue, newValue, summary) {
  try {
    const col = $app.findCollectionByNameOrId('factory_change_logs')
    const rec = new Record(col)
    rec.set('factory_id', factoryId)
    rec.set('user_name', userName)
    rec.set('field', field)
    rec.set('old_value', oldValue)
    rec.set('new_value', newValue)
    rec.set('change_summary', summary)
    $app.save(rec)
    return true
  } catch (err) {
    $app.logger().warn('maestro_bulk_ops: falha ao gravar log de auditoria', 'error', String(err))
    return false
  }
}
