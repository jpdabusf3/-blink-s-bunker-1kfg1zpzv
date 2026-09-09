// pocketbase/hooks/enrich_client_data.js
// Endpoint: POST /backend/v1/enrich-client-data and OPTIONS handler
// Native PocketBase pb_hook for address enrichment (ViaCEP) and geocoding (Nominatim OpenStreetMap)

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

    try {
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

      if (mode === 'single' && !clientId) {
        return e.json(400, { error: 'client_id é obrigatório para mode "single"' })
      }

      // Helper: Sleep / delay in ms
      function sleep(ms) {
        if (!ms || ms <= 0) return
        var start = new Date().getTime()
        while (new Date().getTime() - start < ms) {
          // busy wait in JSVM
        }
      }

      // Helper: Remove accents/diacritics
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

      // Helper: Extract CEP from text (digits only)
      function extractCep(text) {
        if (!text) return ''
        var m = String(text).match(/\b(\d{2}\.?\d{3}-?\d{3}|\d{8})\b/)
        if (m && m[1]) {
          var digits = m[1].replace(/\D/g, '')
          if (digits.length === 8) return digits
        }
        return ''
      }

      // Helper: Format CEP XXXXX-XXX
      function formatCep(digits) {
        if (!digits || digits.length !== 8) return digits || ''
        return digits.substring(0, 5) + '-' + digits.substring(5)
      }

      // Helper: Capitalize words (Portuguese rules)
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

      // Helper: Standardize street/logradouro prefixes
      function standardizeStreet(street) {
        if (!street) return ''
        var s = String(street).trim()

        // Replace common abbreviations at word boundaries or start of string
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

        // Clean extra spaces
        s = s.replace(/\s+/g, ' ').trim()
        return capitalizeWords(s)
      }

      // Helper: Parse free-text address into logradouro, numero, bairro, cep
      function parseFreeTextAddress(addrText) {
        var parsed = {
          logradouro: '',
          numero: '',
          bairro: '',
          cep: '',
        }

        if (!addrText) return parsed

        var raw = String(addrText).trim()
        parsed.cep = extractCep(raw)

        // Remove CEP from raw for further parsing
        var withoutCep = raw
          .replace(/\b\d{2}\.?\d{3}-?\d{3}\b|\bCEP:?\s*\d{5}-?\d{3}\b|\bCEP:?\s*\d{8}\b/gi, '')
          .trim()

        // Common pattern: "Rua Exemplo, 123 - Bairro" or "Av. Paulista, 1000, Bela Vista"
        var parts = withoutCep.split(/[,;\-–—]/)
        var cleanParts = []
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i].trim()
          if (p) cleanParts.push(p)
        }

        if (cleanParts.length >= 1) {
          parsed.logradouro = cleanParts[0]
        }

        // Look for number in parts or via regex "nº 123", "n. 123", "123", "S/N"
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

        // Look for bairro if present in parts
        if (cleanParts.length >= 3) {
          // If part[1] is number, part[2] is likely bairro
          if (/^\d+|S\/N$/i.test(cleanParts[1]) && !parsed.bairro) {
            parsed.bairro = cleanParts[2]
          }
        }

        return parsed
      }

      // Helper: Call ViaCEP with CEP
      function fetchViaCepByCep(cepDigits) {
        try {
          var url = 'https://viacep.com.br/ws/' + cepDigits + '/json/'
          var res = $http.send({
            url: url,
            method: 'GET',
            timeout: 10,
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
          if (!data || data.erro === true || data.erro === 'true') {
            return null
          }
          return data
        } catch (err) {
          $app
            .logger()
            .warn('enrich-client-data: ViaCEP cep error', 'cep', cepDigits, 'error', String(err))
          return null
        }
      }

      // Helper: Call ViaCEP with UF / Cidade / Logradouro
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
          var res = $http.send({
            url: url,
            method: 'GET',
            timeout: 10,
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
            var first = data[0]
            if (first && first.erro !== true && first.erro !== 'true') {
              return first
            }
          }
          return null
        } catch (err) {
          $app
            .logger()
            .warn('enrich-client-data: ViaCEP address search error', 'error', String(err))
          return null
        }
      }

      // Helper: Call Nominatim OpenStreetMap for Geocoding
      function fetchNominatimGeocode(query) {
        try {
          var url =
            'https://nominatim.openstreetmap.org/search?q=' +
            encodeURIComponent(query) +
            '&format=json&limit=1&accept-language=pt-BR'
          var res = $http.send({
            url: url,
            method: 'GET',
            headers: {
              'User-Agent': 'BlinkCRM/1.0',
            },
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
              return {
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              }
            }
          }
          return null
        } catch (err) {
          $app
            .logger()
            .warn(
              'enrich-client-data: Nominatim geocode error',
              'query',
              query,
              'error',
              String(err),
            )
          return null
        }
      }

      // Load records to process
      var records = []
      if (mode === 'single') {
        try {
          var singleRec = $app.findRecordById('factories', clientId)
          records.push(singleRec)
        } catch (_) {
          return e.notFoundError('Cliente não encontrado')
        }
      } else {
        try {
          records = $app.findRecordsByFilter('factories', '', '-created', 1000, 0)
        } catch (findErr) {
          $app.logger().error('enrich-client-data: findRecords error', 'error', String(findErr))
          return e.json(500, { error: 'Erro ao processar enriquecimento de dados' })
        }
      }

      var totalProcessed = 0
      var totalEnriched = 0
      var totalGeocoded = 0
      var totalFailed = 0
      var totalInconsistent = 0
      var details = []

      // Process each record with individual try/catch
      for (var i = 0; i < records.length; i++) {
        var rec = records[i]
        var recId = rec.id
        var recName = rec.getString('name') || ''

        try {
          totalProcessed++

          var rawAddress = rec.getString('address') || ''
          var cityField = rec.getString('city') || ''
          var stateField = rec.getString('state') || ''
          var countryField = rec.getString('country') || 'Brasil'

          var parsedAddr = parseFreeTextAddress(rawAddress)
          var cep = parsedAddr.cep
          var logradouro = parsedAddr.logradouro
          var numero = parsedAddr.numero
          var bairro = parsedAddr.bairro
          var cidade = cityField
          var estado = stateField

          // Step 1: Audit initial status
          var hasAllInitial = !!(cep && logradouro && numero && bairro && cidade && estado)
          var initialStatus = hasAllInitial ? 'complete' : 'partial'
          var addressStatus = initialStatus

          var viaCepData = null
          var wasEnrichedViaCep = false

          // Step 2: Enrichment via ViaCEP
          // If partial or missing cep
          if (addressStatus === 'partial' || !cep) {
            if (cep) {
              // Rate limit 500ms before ViaCEP call
              sleep(500)
              viaCepData = fetchViaCepByCep(cep)
              if (!viaCepData) {
                addressStatus = 'failed'
              }
            } else if (cidade && estado) {
              // Rate limit 500ms before ViaCEP call
              sleep(500)
              var searchStreet = logradouro || recName
              viaCepData = fetchViaCepByAddress(estado, cidade, searchStreet)
              if (!viaCepData && logradouro && recName && searchStreet !== recName) {
                sleep(500)
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

          // Step 4: Cross-Validation if ViaCEP was used or CEP + Cidade/Estado available
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

          // Step 3: Standardization
          var finalLogradouro =
            standardizeStreet(logradouro) || (recName ? standardizeStreet(recName) : 'Endereco')
          var finalNumero = numero ? numero.trim() : 'S/N'
          var finalBairro = bairro ? capitalizeWords(bairro) : 'Centro'
          var finalCidade = cidade ? capitalizeWords(cidade) : ''
          var finalEstado = estado ? estado.toUpperCase().trim() : ''
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

          // Step 5: Geocoding via Nominatim
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
            // Mandatory 1000ms rate limit for Nominatim
            sleep(1000)
            var geoResult = fetchNominatimGeocode(geoQuery)
            if (geoResult && geoResult.lat && geoResult.lng) {
              lat = geoResult.lat
              lng = geoResult.lng
            } else {
              // Fallback to city geocoding if street/exact failed
              if (finalCidade && finalEstado && geocodePrecision !== 'city') {
                sleep(1000)
                var cityGeoResult = fetchNominatimGeocode(
                  finalCidade + ' ' + finalEstado + ' Brasil',
                )
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
          }

          // Step 6: Persist
          var nowIso = new Date().toISOString()
          rec.set('lat', lat)
          rec.set('lng', lng)
          rec.set('geocode_precision', geocodePrecision)
          rec.set('address_status', addressStatus)
          rec.set('enriched_at', nowIso)
          rec.set('standardized_address', standardizedAddress)
          $app.save(rec)

          // Update statistics
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
          $app
            .logger()
            .error(
              'enrich-client-data: client processing error',
              'client_id',
              recId,
              'error',
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

      $app
        .logger()
        .info(
          'enrich-client-data: finished',
          'processed',
          totalProcessed,
          'enriched',
          totalEnriched,
          'geocoded',
          totalGeocoded,
        )

      // Log consolidated activity log at the end instead of per-client log
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
        $app
          .logger()
          .warn('enrich-client-data: falha ao salvar log consolidado', 'error', String(logErr))
      }

      // Step 7: Return summary
      return e.json(200, {
        total_processed: totalProcessed,
        total_enriched: totalEnriched,
        total_geocoded: totalGeocoded,
        total_failed: totalFailed,
        total_inconsistent: totalInconsistent,
        details: details,
      })
    } catch (err) {
      $app.logger().error('enrich-client-data: fatal error', 'error', String(err))
      return e.json(500, { error: 'Erro ao processar enriquecimento de dados' })
    }
  },
  $apis.requireAuth(),
)
