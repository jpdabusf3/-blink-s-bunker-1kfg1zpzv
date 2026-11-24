// pocketbase/hooks/enrich_client_data.js
// Endpoint: POST /backend/v1/enrich-client-data (+ OPTIONS)
// Enriquecimento de endereço (ViaCEP) e geocodificação (Nominatim) para a aba Cadastro.
//
// Regras da JSVM do PocketBase v0.23+ respeitadas aqui:
// - $os.sleep NÃO existe → usar a função global sleep(ms).
// - Funções/constantes de escopo superior NÃO podem ser referenciadas dentro de
//   callbacks de rota → todos os helpers vivem DENTRO do corpo do callback.
// - "== null" não existe no parser de filtros → usar "~ ''" (casa vazio E nulo).
//
// Comportamento:
// - Processa em CHUNKS por request (o frontend faz loop chamando de novo enquanto
//   has_more=true), com espera real (sleep global) entre chamadas HTTP externas.
// - Filtra SOMENTE registros ainda não enriquecidos (address_status vazio) —
//   registros já processados recebem um status e saem do pool automaticamente.
// - NÃO inventa endereço: se o ViaCEP não confirmar, cidade/UF/logradouro/bairro/cep
//   ficam vazios (só grava o que veio confirmado da fonte).
// - Progresso consultável: a resposta traz remaining/has_more e cada registro gravado
//   fica com address_status/enriched_at — dá para consultar o estado a qualquer momento.

routerAdd('OPTIONS', '/backend/v1/enrich-client-data', (e) => {
  e.response.header().set('Access-Control-Allow-Origin', '*')
  e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  e.response
    .header()
    .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  return e.noContent(204)
})

routerAdd(
  'POST',
  '/backend/v1/enrich-client-data',
  (e) => {
    e.response.header().set('Access-Control-Allow-Origin', '*')
    e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    e.response
      .header()
      .set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')

    var userId = e.auth && e.auth.id
    if (!userId) {
      return e.json(401, { error: 'Nao autorizado' })
    }

    var body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }

    var mode = body.mode || 'single'
    var clientId = body.client_id || body.clientId || ''
    var force = body.force === true
    var forceOffset = typeof body.offset === 'number' && body.offset > 0 ? body.offset : 0

    if (mode === 'single' && !clientId) {
      return e.json(400, { error: 'client_id é obrigatório para o modo "single"' })
    }

    // ---------- Helpers (definidos DENTRO do callback, regra da JSVM) ----------

    // Espera real entre chamadas externas. Usa a função global sleep(ms) da JSVM;
    // se por algum motivo não existir, segue sem esperar (nunca lança TypeError).
    function jsleep(ms) {
      try {
        if (typeof sleep === 'function' && ms > 0) {
          sleep(ms)
        }
      } catch (_) {
        // nunca quebra o enriquecimento por causa do sleep
      }
    }

    function removeAccents(str) {
      if (!str) return ''
      var s = String(str)
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
        Á: 'A',
        À: 'A',
        Ã: 'A',
        Â: 'A',
        Ä: 'A',
        É: 'E',
        È: 'E',
        Ê: 'E',
        Ë: 'E',
        Í: 'I',
        Ì: 'I',
        Î: 'I',
        Ï: 'I',
        Ó: 'O',
        Ò: 'O',
        Õ: 'O',
        Ô: 'O',
        Ö: 'O',
        Ú: 'U',
        Ù: 'U',
        Û: 'U',
        Ü: 'U',
        Ç: 'C',
        Ñ: 'N',
      }
      var out = ''
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i)
        out += map[ch] !== undefined ? map[ch] : ch
      }
      return out
    }

    function extractCep(text) {
      if (!text) return ''
      var m = String(text).match(/\b(\d{2}\.?\d{3}-?\d{3}|\d{8})\b/)
      if (m && m[1]) {
        var digits = m[1].replace(/\D/g, '')
        if (digits.length === 8) return digits
      }
      return ''
    }

    function formatCep(digits) {
      if (!digits || digits.length !== 8) return digits || ''
      return digits.substring(0, 5) + '-' + digits.substring(5)
    }

    function capitalizeWords(str) {
      if (!str) return ''
      var lowerExceptions = [
        'de',
        'da',
        'do',
        'das',
        'dos',
        'e',
        'em',
        'para',
        'com',
        'no',
        'na',
        'nos',
        'nas',
      ]
      var words = String(str).trim().split(/\s+/)
      var result = []
      for (var i = 0; i < words.length; i++) {
        var w = words[i].trim()
        if (!w) continue
        var wLower = w.toLowerCase()
        if (i > 0 && lowerExceptions.indexOf(wLower) !== -1) {
          result.push(wLower)
        } else {
          result.push(w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        }
      }
      return result.join(' ')
    }

    function standardizeStreet(street) {
      if (!street) return ''
      var s = String(street).trim()
      var replacements = [
        { regex: /\b(Av\.?|Aven\.?)\b/gi, rep: 'Avenida' },
        { regex: /\b(R\.?|Rua\.?)\b/gi, rep: 'Rua' },
        { regex: /\b(Est\.?|Estr\.?)\b/gi, rep: 'Estrada' },
        { regex: /\b(Al\.?|Alam\.?)\b/gi, rep: 'Alameda' },
        { regex: /\b(Pca\.?|Pça\.?|Praca\.?|Praça\.?)\b/gi, rep: 'Praça' },
        { regex: /\b(Tv\.?|Trav\.?)\b/gi, rep: 'Travessa' },
        { regex: /\b(Rod\.?|Rodov\.?)\b/gi, rep: 'Rodovia' },
      ]
      for (var r = 0; r < replacements.length; r++) {
        s = s.replace(replacements[r].regex, replacements[r].rep)
      }
      s = s.replace(/\s+/g, ' ').trim()
      return capitalizeWords(s)
    }

    // Analisa endereço em texto livre: logradouro, numero, bairro, cep
    function parseFreeTextAddress(addrText) {
      var parsed = { logradouro: '', numero: '', bairro: '', cep: '' }
      if (!addrText) return parsed

      var raw = String(addrText).trim()
      parsed.cep = extractCep(raw)

      var withoutCep = raw
        .replace(/\b\d{2}\.?\d{3}-?\d{3}\b|\bCEP:?\s*\d{5}-?\d{3}\b|\bCEP:?\s*\d{8}\b/gi, '')
        .trim()

      var parts = withoutCep.split(/[,;–—]/)
      var cleanParts = []
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim()
        if (p) cleanParts.push(p)
      }

      if (cleanParts.length >= 1) {
        parsed.logradouro = cleanParts[0]
      }

      var numMatch = withoutCep.match(
        /\b(?:n[º°.]?\s*|numero\s*|n\s+)?(\d+|S\/N|s\/n|sn|sem\s+n[uú]mero)\b/i,
      )
      if (numMatch && numMatch[1]) {
        var nStr = numMatch[1].toUpperCase()
        if (nStr === 'SN' || nStr === 'SEM NÚMERO' || nStr === 'SEM NUMERO') {
          parsed.numero = 'S/N'
        } else {
          parsed.numero = nStr
        }
      }

      if (cleanParts.length >= 3) {
        if (/^\d+|S\/N$/i.test(cleanParts[1]) && !parsed.bairro) {
          parsed.bairro = cleanParts[2]
        }
      }

      return parsed
    }

    // ViaCEP por CEP — só retorna dados CONFIRMADOS pela fonte
    function fetchViaCepByCep(cepDigits) {
      try {
        var url = 'https://viacep.com.br/ws/' + cepDigits + '/json/'
        var res = $http.send({ url: url, method: 'GET', timeout: 10 })
        if (res.statusCode !== 200) return null
        var data = res.json
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch (_) {
            return null
          }
        }
        if (!data || data.erro === true || data.erro === 'true') return null
        return data
      } catch (err) {
        console.warn('enrich-client-data: ViaCEP cep error', 'cep', cepDigits, 'err', String(err))
        return null
      }
    }

    // ViaCEP por UF / cidade / logradouro
    function fetchViaCepByAddress(uf, cidade, logradouro) {
      try {
        var cleanUf = encodeURIComponent(String(uf || '').trim())
        var cleanCidade = encodeURIComponent(String(cidade || '').trim())
        var cleanLogradouro = encodeURIComponent(String(logradouro || '').trim())
        if (!cleanUf || !cleanCidade || !cleanLogradouro) return null

        var url =
          'https://viacep.com.br/ws/' +
          cleanUf +
          '/' +
          cleanCidade +
          '/' +
          cleanLogradouro +
          '/json/'
        var res = $http.send({ url: url, method: 'GET', timeout: 10 })
        if (res.statusCode !== 200) return null
        var data = res.json
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch (_) {
            return null
          }
        }
        if (Array.isArray(data) && data.length > 0) {
          var first = data[0]
          if (first && first.erro !== true && first.erro !== 'true') return first
        }
        return null
      } catch (err) {
        console.warn('enrich-client-data: ViaCEP address search error', 'err', String(err))
        return null
      }
    }

    // Geocodificação Nominatim (OpenStreetMap)
    function fetchNominatimGeocode(query) {
      try {
        var url =
          'https://nominatim.openstreetmap.org/search?q=' +
          encodeURIComponent(query) +
          '&format=json&limit=1&accept-language=pt-BR'
        var res = $http.send({
          url: url,
          method: 'GET',
          headers: { 'User-Agent': 'BlinkCRM/1.0' },
          timeout: 15,
        })
        if (res.statusCode !== 200) return null
        var data = res.json
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch (_) {
            return null
          }
        }
        if (Array.isArray(data) && data.length > 0) {
          var item = data[0]
          if (item && item.lat && item.lon) {
            return { lat: parseFloat(item.lat), lng: parseFloat(item.lon) }
          }
        }
        return null
      } catch (err) {
        console.warn('enrich-client-data: Nominatim geocode error', 'err', String(err))
        return null
      }
    }

    // ---------- Seleção de registros (CHUNK) ----------

    var CHUNK_SIZE = 20
    var records = []
    var poolFilter = force ? 'is_deleted != true' : "is_deleted != true && address_status ~ ''"
    var pageOffset = 0
    var totalPool = 0

    try {
      totalPool = $app.countRecords('factories', poolFilter)
    } catch (countErr) {
      console.warn('enrich-client-data: countRecords error', 'err', String(countErr))
      totalPool = 0
    }

    if (mode === 'single') {
      try {
        records.push($app.findRecordById('factories', clientId))
      } catch (_) {
        return e.notFoundError('Cliente não encontrado')
      }
      totalPool = 1
    } else {
      // Modo force: o pool não encolhe (todos os registros são válidos), então usa
      // offset acumulado pelo frontend. Modo normal: registros processados saem do
      // pool (recebem status), então offset 0 a cada chunk.
      pageOffset = force ? forceOffset : 0
      if (pageOffset >= totalPool && totalPool > 0) {
        // Nada restante neste pool
        return e.json(200, {
          total_processed: 0,
          total_enriched: 0,
          total_geocoded: 0,
          total_failed: 0,
          total_inconsistent: 0,
          remaining: 0,
          has_more: false,
          total_pool: totalPool,
          details: [],
        })
      }
      try {
        records = $app.findRecordsByFilter(
          'factories',
          poolFilter,
          '-created',
          CHUNK_SIZE,
          pageOffset,
        )
      } catch (findErr) {
        console.error('enrich-client-data: findRecords error', 'err', String(findErr))
        return e.json(500, { error: 'Erro ao buscar clientes para enriquecer' })
      }
    }

    // ---------- Processamento ----------

    var totalProcessed = 0
    var totalEnriched = 0
    var totalGeocoded = 0
    var totalFailed = 0
    var totalInconsistent = 0
    var details = []

    for (var i = 0; i < records.length; i++) {
      var rec = records[i]
      var recId = rec.id
      var recName = rec.getString('name') || ''

      try {
        totalProcessed++

        var rawAddress = rec.getString('address') || ''
        var cidade = rec.getString('city') || ''
        var estado = rec.getString('state') || ''

        var parsedAddr = parseFreeTextAddress(rawAddress)
        var cep = parsedAddr.cep
        var logradouro = parsedAddr.logradouro
        var numero = parsedAddr.numero
        var bairro = parsedAddr.bairro

        var hasAllInitial = !!(cep && logradouro && numero && bairro && cidade && estado)
        var addressStatus = hasAllInitial ? 'complete' : 'partial'

        var viaCepData = null
        var wasEnrichedViaCep = false

        // Etapa ViaCEP: só preenche com o que a FONTE confirmar. Sem fonte, sem dado.
        if (!hasAllInitial) {
          if (cep) {
            jsleep(300)
            viaCepData = fetchViaCepByCep(cep)
          } else if (cidade && estado && logradouro) {
            jsleep(300)
            viaCepData = fetchViaCepByAddress(estado, cidade, logradouro)
          }

          if (viaCepData) {
            wasEnrichedViaCep = true
            if (!cep && viaCepData.cep) cep = String(viaCepData.cep).replace(/\D/g, '')
            if (!logradouro && viaCepData.logradouro) logradouro = viaCepData.logradouro
            if (!bairro && viaCepData.bairro) bairro = viaCepData.bairro
            if (!cidade && viaCepData.localidade) cidade = viaCepData.localidade
            if (!estado && viaCepData.uf) estado = viaCepData.uf
          }
        }

        // Validação cruzada: se o CEP confirmado contradiz cidade/UF já conhecidas,
        // marca inconsistente em vez de gravar dado contraditório.
        if (viaCepData) {
          var viaCepUf = String(viaCepData.uf || '').trim()
          var viaCepCity = String(viaCepData.localidade || '').trim()
          var prevCidade = rec.getString('city') || ''
          var prevEstado = rec.getString('state') || ''
          var stateMatch =
            !prevEstado ||
            !viaCepUf ||
            removeAccents(prevEstado).toLowerCase() === removeAccents(viaCepUf).toLowerCase()
          var cityMatch =
            !prevCidade ||
            !viaCepCity ||
            removeAccents(prevCidade).toLowerCase() === removeAccents(viaCepCity).toLowerCase()
          if (!stateMatch || !cityMatch) {
            addressStatus = 'inconsistent'
          } else {
            addressStatus = 'enriched'
          }
        } else if (!hasAllInitial) {
          addressStatus = 'failed'
        }

        // Padronização — NÃO inventar dados: campo sem valor confirmado fica vazio.
        var finalLogradouro = logradouro ? standardizeStreet(logradouro) : ''
        var finalNumero = numero ? String(numero).trim() : ''
        var finalBairro = bairro ? capitalizeWords(bairro) : ''
        var finalCidade = cidade ? capitalizeWords(cidade) : ''
        var finalEstado = estado ? String(estado).toUpperCase().trim() : ''
        var finalCep = cep ? formatCep(cep) : ''

        var standardizedAddress = ''
        if (finalLogradouro || finalCidade) {
          var parts = []
          if (finalLogradouro) {
            var line = finalLogradouro + (finalNumero ? ' ' + finalNumero : '')
            parts.push(line)
          }
          if (finalBairro) parts.push(finalBairro)
          if (finalCidade || finalEstado) {
            parts.push(finalCidade + (finalEstado ? ' - ' + finalEstado : ''))
          }
          if (finalCep) parts.push('CEP: ' + finalCep)
          standardizedAddress = parts.join(', ')
        }

        // Geocodificação — só quando há cidade+UF confirmadas; sem dado, sem coordenada.
        var geocodePrecision = 'failed'
        var lat = 0
        var lng = 0
        var hasExistingCoords = (rec.getFloat('lat') || 0) !== 0 || (rec.getFloat('lng') || 0) !== 0

        if (finalCidade && finalEstado) {
          var geoQuery =
            (finalLogradouro
              ? finalLogradouro + (finalNumero ? ' ' + finalNumero : '') + ' '
              : '') +
            finalCidade +
            ' ' +
            finalEstado +
            ' Brasil'
          jsleep(1100) // rate limit obrigatório do Nominatim
          var geoResult = fetchNominatimGeocode(geoQuery)
          if (geoResult && geoResult.lat && geoResult.lng) {
            lat = geoResult.lat
            lng = geoResult.lng
            geocodePrecision = finalLogradouro ? 'street' : 'city'
          } else if (!finalLogradouro) {
            geocodePrecision = 'failed'
          } else {
            // fallback: geocodificar só a cidade
            jsleep(1100)
            var cityGeoResult = fetchNominatimGeocode(finalCidade + ' ' + finalEstado + ' Brasil')
            if (cityGeoResult && cityGeoResult.lat && cityGeoResult.lng) {
              lat = cityGeoResult.lat
              lng = cityGeoResult.lng
              geocodePrecision = 'city'
            }
          }
        }

        // Persistência — grava só campos confirmados; preserva coordenadas já existentes
        // quando a nova geocodificação falha (não zera o que o usuário já tem).
        var nowIso = new Date().toISOString()
        rec.set('address_status', addressStatus)
        rec.set('enriched_at', nowIso)
        rec.set('geocode_precision', geocodePrecision)
        if (lat !== 0 || lng !== 0) {
          rec.set('lat', lat)
          rec.set('lng', lng)
          rec.set('latitude', lat)
          rec.set('longitude', lng)
        }
        if (standardizedAddress) rec.set('standardized_address', standardizedAddress)
        if (finalCep && !rec.getString('cep')) rec.set('cep', finalCep)
        if (finalLogradouro && !rec.getString('logradouro')) rec.set('logradouro', finalLogradouro)
        if (finalNumero && !rec.getString('numero')) rec.set('numero', finalNumero)
        if (finalBairro && !rec.getString('bairro')) rec.set('bairro', finalBairro)
        if (finalCidade && !rec.getString('city')) rec.set('city', finalCidade)
        if (finalEstado && !rec.getString('state')) rec.set('state', finalEstado)
        $app.save(rec)

        if (wasEnrichedViaCep && addressStatus !== 'failed') totalEnriched++
        if ((lat !== 0 || lng !== 0) && !hasExistingCoords) totalGeocoded++
        if (addressStatus === 'failed') totalFailed++
        if (addressStatus === 'inconsistent') totalInconsistent++

        details.push({
          client_id: recId,
          client_name: recName,
          address_status: addressStatus,
          geocode_precision: geocodePrecision,
        })
      } catch (clientErr) {
        console.error(
          'enrich-client-data: client processing error',
          'client',
          recId,
          'err',
          String(clientErr),
        )
        totalFailed++
        details.push({
          client_id: recId,
          client_name: recName,
          address_status: 'failed',
          geocode_precision: 'failed',
        })
      }
    }

    // ---------- Resumo do chunk ----------

    var remaining = 0
    try {
      remaining = $app.countRecords('factories', "is_deleted != true && address_status ~ ''")
    } catch (_) {
      remaining = 0
    }
    if (mode === 'single') remaining = 0

    var hasMore = false
    if (mode !== 'single') {
      if (force) {
        hasMore = pageOffset + records.length < totalPool
      } else {
        hasMore = remaining > 0
      }
    }

    console.log(
      'enrich-client-data: chunk concluído',
      'processed',
      totalProcessed,
      'enriched',
      totalEnriched,
      'remaining',
      remaining,
      'has_more',
      hasMore,
    )

    // Log de auditoria só no FIM de todo o processo (modo normal, sem mais chunks)
    if (mode !== 'single' && !force && !hasMore && totalProcessed > 0 && remaining === 0) {
      try {
        var logCol = $app.findCollectionByNameOrId('activity_logs')
        var consolidatedLog = new Record(logCol)
        consolidatedLog.set('user', userId)
        consolidatedLog.set('action', 'Enriquecimento de Dados')
        consolidatedLog.set(
          'details',
          'Enriquecimento concluído: ' +
            totalProcessed +
            ' processados neste lote final, ' +
            totalEnriched +
            ' enriquecidos (ViaCEP), ' +
            totalGeocoded +
            ' geocodificados',
        )
        consolidatedLog.set('collectionName', 'factories')
        consolidatedLog.set('target_collection', 'factories')
        $app.save(consolidatedLog)
      } catch (logErr) {
        console.warn('enrich-client-data: falha ao salvar log consolidado', 'err', String(logErr))
      }
    }

    return e.json(200, {
      total_processed: totalProcessed,
      total_enriched: totalEnriched,
      total_geocoded: totalGeocoded,
      total_failed: totalFailed,
      total_inconsistent: totalInconsistent,
      remaining: remaining,
      has_more: hasMore,
      total_pool: totalPool,
      details: details,
    })
  },
  $apis.requireAuth(),
)
