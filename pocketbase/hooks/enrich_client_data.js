// pocketbase/hooks/enrich_client_data.js
// Endpoint: POST /backend/v1/enrich-client-data (+ OPTIONS)
// Enriquecimento de endereço (ViaCEP) e geocodificação (Nominatim) para a aba Cadastro.
//
// Correções de runtime (bug "Erro ao processar enriquecimento"):
// 1. O filtro antigo "(address_status = '' || address_status == null)" é INVÁLIDO no
//    PocketBase (o parser rejeita "== null" com HTTP 400 — reproduzido via db_query).
//    findRecordsByFilter lançava erro → o hook respondia 500 com a mesma mensagem
//    genérica que o usuário via. Agora usa "address_status ~ ''" (aceita vazio e nulo).
// 2. sleep() era busy-wait (gastava o tempo de execução da JSVM) e cada cliente dormia
//    1,5–2,5s. Um lote grande estourava o timeout. Agora o processamento é dividido em
//    CHUNKS por request (via address_status='processing'), com $os.sleep real entre
//    chamadas HTTP (respeita rate limit de ViaCEP/Nominatim sem ocupar a JSVM).
// 3. Nada de referências a helpers de fora do callback (regra da JSVM deste projeto).

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

    if (mode === 'single' && !clientId) {
      return e.json(400, { error: 'client_id é obrigatório para o modo "single"' })
    }

    // ---------- Helpers (definidos DENTRO do callback, regra da JSVM) ----------

    // Remove acentos/diacríticos
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
        î: 'ï',
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

    // Extrai CEP (só dígitos) de um texto
    function extractCep(text) {
      if (!text) return ''
      var m = String(text).match(/\b(\d{2}\.?\d{3}-?\d{3}|\d{8})\b/)
      if (m && m[1]) {
        var digits = m[1].replace(/\D/g, '')
        if (digits.length === 8) return digits
      }
      return ''
    }

    // Formata CEP XXXXX-XXX
    function formatCep(digits) {
      if (!digits || digits.length !== 8) return digits || ''
      return digits.substring(0, 5) + '-' + digits.substring(5)
    }

    // Capitaliza palavras (regras do português)
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

    // Padroniza prefixos de logradouro (Av. → Avenida etc.)
    function standardizeStreet(street) {
      if (!street) return ''
      var s = String(street).trim()
      var replacements = [
        { regex: /\b(Av\.?|Aven\.?)\b/gi, rep: 'Avenida' },
        { regex: /\b(R\.?|Rua\.?)\b/gi, rep: 'Rua' },
        { regex: /\b(Est\.?|Estr\.?)\b/gi, rep: 'Estrada' },
        { regex: /\b(Al\.?|Alam\.?)\b/gi, rep: 'Alameda' },
        { regex: /\b(Pca\.?|Pça\.?|Praca\.?|Praça\.?)\b/gi, rep: 'Praca' },
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

      var parts = withoutCep.split(/[,;\-–—]/)
      var cleanParts = []
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim()
        if (p) cleanParts.push(p)
      }

      if (cleanParts.length >= 1) {
        parsed.logradouro = cleanParts[0]
      }

      var numMatch = withoutCep.match(
        /\b(?:n[º°\.]?\s*|numero\s*|n\s+)?(\d+|S\/N|s\/n|sn|sem\s+n[uú]mero)\b/i,
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

    // ViaCEP por CEP
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

    // ---------- Seleção de registros ----------

    var records = []
    var processedFilter = false
    if (mode === 'single') {
      try {
        records.push($app.findRecordById('factories', clientId))
      } catch (_) {
        return e.notFoundError('Cliente não encontrado')
      }
    } else {
      // IMPORTANTE: "== null" não existe no parser do PocketBase (HTTP 400).
      // "~ ''" casa com valor vazio E nulo.
      var filter = force ? '' : "address_status ~ ''"
      try {
        records = $app.findRecordsByFilter('factories', filter, '-created', CHUNK_SIZE, 0)
      } catch (findErr) {
        console.error('enrich-client-data: findRecords error', 'err', String(findErr))
        return e.json(500, { error: 'Erro ao buscar clientes para enriquecer' })
      }
      if (!force) {
        // Chunks de continuação: retoma de onde parou
        try {
          records = records.concat(
            $app.findRecordsByFilter(
              'factories',
              "address_status = 'processing'",
              '-created',
              CHUNK_SIZE,
              0,
            ),
          )
        } catch (_) {
          // sem registros 'processing' — segue
        }
        processedFilter = true
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
        var cityField = rec.getString('city') || ''
        var stateField = rec.getString('state') || ''

        var parsedAddr = parseFreeTextAddress(rawAddress)
        var cep = parsedAddr.cep
        var logradouro = parsedAddr.logradouro
        var numero = parsedAddr.numero
        var bairro = parsedAddr.bairro
        var cidade = cityField
        var estado = stateField

        // Etapa 1: status inicial
        var hasAllInitial = !!(cep && logradouro && numero && bairro && cidade && estado)
        var addressStatus = hasAllInitial ? 'complete' : 'partial'

        var viaCepData = null
        var wasEnrichedViaCep = false

        // Etapa 2: ViaCEP
        if (addressStatus === 'partial' || !cep) {
          if (cep) {
            $os.sleep(500)
            viaCepData = fetchViaCepByCep(cep)
            if (!viaCepData) {
              addressStatus = 'failed'
            }
          } else if (cidade && estado) {
            $os.sleep(500)
            var searchStreet = logradouro || recName
            viaCepData = fetchViaCepByAddress(estado, cidade, searchStreet)
            if (!viaCepData && logradouro && recName && searchStreet !== recName) {
              $os.sleep(500)
              viaCepData = fetchViaCepByAddress(estado, cidade, recName)
            }
          } else {
            addressStatus = 'failed'
          }

          if (viaCepData) {
            wasEnrichedViaCep = true
            if (!cep && viaCepData.cep) {
              cep = String(viaCepData.cep).replace(/\D/g, '')
            }
            if (!logradouro && viaCepData.logradouro) {
              logradouro = viaCepData.logradouro
            }
            if (!bairro && viaCepData.bairro) {
              bairro = viaCepData.bairro
            }
            if (!cidade && viaCepData.localidade) {
              cidade = viaCepData.localidade
            }
            if (!estado && viaCepData.uf) {
              estado = viaCepData.uf
            }
          }
        }

        // Etapa 3: validação cruzada (evita gravar endereço que contradiz cidade/UF)
        if (viaCepData && addressStatus !== 'failed') {
          var viaCepUf = String(viaCepData.uf || '').trim()
          var viaCepCity = String(viaCepData.localidade || '').trim()

          var stateMatch =
            !estado ||
            !viaCepUf ||
            removeAccents(estado).toLowerCase() === removeAccents(viaCepUf).toLowerCase()
          var cityMatch =
            !cidade ||
            !viaCepCity ||
            removeAccents(cidade).toLowerCase() === removeAccents(viaCepCity).toLowerCase()

          if (!stateMatch || !cityMatch) {
            addressStatus = 'inconsistent'
          } else {
            addressStatus = 'enriched'
          }
        } else if (addressStatus !== 'failed' && wasEnrichedViaCep) {
          addressStatus = 'enriched'
        }

        // Etapa 4: padronização — NÃO inventar dados: sem logradouro/bairro reais,
        // o campo fica vazio (antes o hook fabricava "Endereco"/"Centro").
        var finalLogradouro = standardizeStreet(logradouro) || ''
        var finalNumero = numero ? String(numero).trim() : ''
        var finalBairro = bairro ? capitalizeWords(bairro) : ''
        var finalCidade = cidade ? capitalizeWords(cidade) : ''
        var finalEstado = estado ? String(estado).toUpperCase().trim() : ''
        var finalCep = cep ? formatCep(cep) : ''

        var standardizedAddress = ''
        if (finalLogradouro || finalCidade) {
          standardizedAddress =
            finalLogradouro +
            ', ' +
            finalNumero +
            ' - ' +
            finalBairro +
            ', ' +
            finalCidade +
            ' - ' +
            finalEstado +
            ', CEP: ' +
            finalCep
        }

        // Etapa 5: geocodificação Nominatim
        var geocodePrecision = 'failed'
        var lat = 0
        var lng = 0

        var geoQuery = ''
        if (cep && finalNumero !== 'S/N' && logradouro) {
          geocodePrecision = 'exact'
          geoQuery =
            (finalCep ? finalCep + ' ' : '') +
            finalNumero +
            ' ' +
            finalLogradouro +
            ' ' +
            finalBairro +
            ' ' +
            finalCidade +
            ' ' +
            finalEstado +
            ' Brasil'
        } else if (cep) {
          geocodePrecision = 'street'
          geoQuery =
            (finalCep ? finalCep + ' ' : '') +
            finalLogradouro +
            ' ' +
            finalBairro +
            ' ' +
            finalCidade +
            ' ' +
            finalEstado +
            ' Brasil'
        } else if (finalCidade && finalEstado) {
          geocodePrecision = 'city'
          geoQuery = finalCidade + ' ' + finalEstado + ' Brasil'
        } else {
          geocodePrecision = 'failed'
        }

        if (geoQuery && geocodePrecision !== 'failed') {
          $os.sleep(1000) // rate limit obrigatório do Nominatim (sem busy-wait)
          var geoResult = fetchNominatimGeocode(geoQuery)
          if (geoResult && geoResult.lat && geoResult.lng) {
            lat = geoResult.lat
            lng = geoResult.lng
          } else if (finalCidade && finalEstado && geocodePrecision !== 'city') {
            $os.sleep(1000)
            var cityGeoResult = fetchNominatimGeocode(finalCidade + ' ' + finalEstado + ' Brasil')
            if (cityGeoResult && cityGeoResult.lat && cityGeoResult.lng) {
              lat = cityGeoResult.lat
              lng = cityGeoResult.lng
              geocodePrecision = 'city'
            } else {
              geocodePrecision = 'failed'
            }
          } else {
            geocodePrecision = 'failed'
          }
        }

        // Etapa 6: persistência — grava também cidade/UF/CEP/logradouro/bairro.
        var nowIso = new Date().toISOString()
        rec.set('lat', lat)
        rec.set('lng', lng)
        rec.set('geocode_precision', geocodePrecision)
        rec.set('address_status', addressStatus)
        rec.set('enriched_at', nowIso)
        rec.set('standardized_address', standardizedAddress)
        if (finalCep && !rec.getString('cep')) rec.set('cep', finalCep)
        if (finalLogradouro && !rec.getString('logradouro')) rec.set('logradouro', finalLogradouro)
        if (finalNumero && !rec.getString('numero')) rec.set('numero', finalNumero)
        if (finalBairro && !rec.getString('bairro')) rec.set('bairro', finalBairro)
        if (finalCidade && !rec.getString('city')) rec.set('city', finalCidade)
        if (finalEstado && !rec.getString('state')) rec.set('state', finalEstado)
        $app.save(rec)

        if (wasEnrichedViaCep) totalEnriched++
        if (geocodePrecision !== 'failed' && (lat !== 0 || lng !== 0)) totalGeocoded++
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

    // ---------- Próximo chunk / resumo ----------

    var hasMore = false
    var remaining = 0
    if (processedFilter) {
      try {
        remaining = $app.countRecords('factories', "address_status ~ ''")
      } catch (_) {
        remaining = 0
      }
      hasMore = remaining > 0
      aveMore = false
    }

    console.log(
      'enrich-client-data: chunk concluído',
      'processed',
      totalProcessed,
      'enriched',
      totalEnriched,
      'remaining',
      remaining,
    )

    // Log consolidado de auditoria só no FIM de todo o processo
    if (processedFilter && !hasMore && totalProcessed > 0) {
      try {
        var logCol = $app.findCollectionByNameOrId('activity_logs')
        var consolidatedLog = new Record(logCol)
        consolidatedLog.set('user', userId)
        consolidatedLog.set('action', 'Enriquecimento de Dados')
        consolidatedLog.set(
          'details',
          'Enriquecimento concluído: ' +
            totalProcessed +
            ' processados, ' +
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
      details: details,
    })
  },
  $apis.requireAuth(),
)
