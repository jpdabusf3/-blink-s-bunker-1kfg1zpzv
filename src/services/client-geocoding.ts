/**
 * Serviço de busca de CEP via ViaCEP e Geocodificação hierárquica por prioridades:
 * 1. Coordenadas já salvas (latitude / longitude) -> exata
 * 2. Endereço completo (logradouro, numero, cidade, estado) -> rua
 * 3. Apenas CEP -> bairro
 * 4. Apenas cidade e estado -> cidade
 * 5. Nada resolvido -> sem-localizacao
 *
 * Inclui cache em memória e persistência nos registros do PocketBase.
 */

import pb from '@/lib/pocketbase/client'
import { getCityCoordinateSync } from './city-coordinates'
import type { Factory } from '@/types'

export interface ViaCepResult {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string // cidade
  uf: string
  ibge?: string
  gia?: string
  ddd?: string
  siafi?: string
  erro?: boolean
}

export type GeocodePrecisao = 'exata' | 'rua' | 'bairro' | 'cidade' | 'sem-localizacao'

export interface GeocodeResolutionResult {
  latitude: number | undefined
  longitude: number | undefined
  precisao: GeocodePrecisao
}

// Cache em memória para evitar chamadas duplicadas
const viaCepCache = new Map<string, ViaCepResult | null>()
const addressGeocodeCache = new Map<string, { lat: number; lng: number } | null>()
const cepGeocodeCache = new Map<string, { lat: number; lng: number } | null>()
const clientResolutionInProgress = new Map<string, Promise<GeocodeResolutionResult>>()

// Rate limiter / serializador para Nominatim (OSM exige máx 1 req/s)
let lastNominatimTimestamp = 0
async function throttleNominatim(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastNominatimTimestamp
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed))
  }
  lastNominatimTimestamp = Date.now()
}

/**
 * Consulta CEP na API pública ViaCEP: GET https://viacep.com.br/ws/THE_CEP/json/
 * Nunca quebra fluxo: retorna null em caso de erro ou se CEP não for encontrado.
 */
export async function fetchViaCep(cepRaw: string): Promise<ViaCepResult | null> {
  const cleanCep = (cepRaw || '').replace(/\D/g, '')
  if (cleanCep.length !== 8) {
    return null
  }

  if (viaCepCache.has(cleanCep)) {
    return viaCepCache.get(cleanCep) || null
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      viaCepCache.set(cleanCep, null)
      return null
    }

    const data: ViaCepResult = await response.json()
    if (data.erro) {
      viaCepCache.set(cleanCep, null)
      return null
    }

    viaCepCache.set(cleanCep, data)
    return data
  } catch (err) {
    console.warn('[ViaCEP] Falha na consulta de CEP:', err)
    return null
  }
}

/**
 * Geocodifica endereço completo via Nominatim OSM com cache e throttle
 */
async function geocodeNominatimQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return null

  if (addressGeocodeCache.has(trimmed)) {
    return addressGeocodeCache.get(trimmed) || null
  }

  try {
    await throttleNominatim()

    const params = new URLSearchParams({
      format: 'json',
      q: query,
      countrycodes: 'br',
      limit: '1',
    })

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BlinksBunker/1.0 (contact@blinkbiotech.com)',
      },
    })

    if (!resp.ok) {
      addressGeocodeCache.set(trimmed, null)
      return null
    }

    const list = await resp.json()
    if (Array.isArray(list) && list.length > 0 && list[0].lat && list[0].lon) {
      const lat = parseFloat(list[0].lat)
      const lng = parseFloat(list[0].lon)
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const result = { lat, lng }
        addressGeocodeCache.set(trimmed, result)
        return result
      }
    }

    addressGeocodeCache.set(trimmed, null)
    return null
  } catch (err) {
    console.warn('[Nominatim] Erro ao consultar endereço:', query, err)
    return null
  }
}

/**
 * Geocodifica a área de um CEP (prioridade 3: precisao = 'bairro')
 */
async function geocodeCepArea(
  cep: string,
  cidade?: string,
  estado?: string,
): Promise<{ lat: number; lng: number } | null> {
  const cleanCep = (cep || '').replace(/\D/g, '')
  if (cleanCep.length !== 8) return null

  const cacheKey = `${cleanCep}-${(cidade || '').toLowerCase()}-${(estado || '').toLowerCase()}`
  if (cepGeocodeCache.has(cacheKey)) {
    return cepGeocodeCache.get(cacheKey) || null
  }

  // Tenta pelo CEP postal code no OSM
  try {
    await throttleNominatim()

    const params = new URLSearchParams({
      format: 'json',
      postalcode: `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
      country: 'Brazil',
      limit: '1',
    })
    if (cidade) params.append('city', cidade)
    if (estado && estado.length <= 3) params.append('state', estado)

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BlinksBunker/1.0 (contact@blinkbiotech.com)',
      },
    })

    if (resp.ok) {
      const list = await resp.json()
      if (Array.isArray(list) && list.length > 0 && list[0].lat && list[0].lon) {
        const lat = parseFloat(list[0].lat)
        const lng = parseFloat(list[0].lon)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          const res = { lat, lng }
          cepGeocodeCache.set(cacheKey, res)
          return res
        }
      }
    }
  } catch (err) {
    console.warn('[Nominatim] Falha geocodificando CEP:', cleanCep, err)
  }

  // Se o Nominatim pelo CEP não achou diretamente, tenta obter o bairro via ViaCEP
  const viaCep = await fetchViaCep(cleanCep)
  if (viaCep && viaCep.bairro && viaCep.localidade) {
    const query = `${viaCep.bairro}, ${viaCep.localidade}, ${viaCep.uf || estado || ''}, Brasil`
    const bairroRes = await geocodeNominatimQuery(query)
    if (bairroRes) {
      cepGeocodeCache.set(cacheKey, bairroRes)
      return bairroRes
    }
  }

  cepGeocodeCache.set(cacheKey, null)
  return null
}

/**
 * Resolve a localização de um cliente estritamente pela ordem de prioridade descrita na especificação:
 * 1. Se já tem latitude/longitude válidas salvos -> usar como estão e definir precisao = exata
 * 2. Se há endereço completo com logradouro, numero, cidade e estado -> geocodificar e definir precisao = rua
 * 3. Se há apenas CEP -> geocodificar a área do CEP e definir precisao = bairro
 * 4. Se há apenas cidade e estado -> geocodificar centro da cidade e definir precisao = cidade
 * 5. Se nada resolver -> definir precisao = sem-localizacao e deixar latitude/longitude vazios
 */
export async function resolveClientCoordinates(
  client: Partial<Factory>,
): Promise<GeocodeResolutionResult> {
  const clientId = client.id || ''
  if (clientId && clientResolutionInProgress.has(clientId)) {
    return clientResolutionInProgress.get(clientId)!
  }

  const promise = (async (): Promise<GeocodeResolutionResult> => {
    // 1. Já tem coordenadas salvas
    const rawLat = client.latitude ?? client.lat
    const rawLng = client.longitude ?? client.lng
    const hasValidCoords =
      typeof rawLat === 'number' &&
      typeof rawLng === 'number' &&
      !isNaN(rawLat) &&
      !isNaN(rawLng) &&
      rawLat !== 0 &&
      rawLng !== 0

    if (hasValidCoords) {
      const existingPrecision = (client.precisao as GeocodePrecisao) || 'exata'
      return {
        latitude: rawLat,
        longitude: rawLng,
        precisao: existingPrecision === 'sem-localizacao' ? 'exata' : existingPrecision,
      }
    }

    const logradouro = (client.logradouro || '').trim()
    const numero = (client.numero || '').trim()
    const cidade = (client.city || '').trim()
    const estado = (client.state || '').trim()
    const cep = (client.cep || '').trim()

    // 2. Endereço completo com logradouro, número, cidade e estado
    if (logradouro && numero && cidade && estado) {
      const fullAddressQuery = `${logradouro}, ${numero}, ${cidade} - ${estado}, Brasil`
      const resolved = await geocodeNominatimQuery(fullAddressQuery)
      if (resolved) {
        return {
          latitude: resolved.lat,
          longitude: resolved.lng,
          precisao: 'rua',
        }
      }
      // Tentativa sem o número caso OSM não tenha numeração predial exata
      const streetQuery = `${logradouro}, ${cidade} - ${estado}, Brasil`
      const resolvedStreet = await geocodeNominatimQuery(streetQuery)
      if (resolvedStreet) {
        return {
          latitude: resolvedStreet.lat,
          longitude: resolvedStreet.lng,
          precisao: 'rua',
        }
      }
    } else if (logradouro && cidade && estado) {
      // Logradouro com cidade e estado
      const streetQuery = `${logradouro}, ${cidade} - ${estado}, Brasil`
      const resolvedStreet = await geocodeNominatimQuery(streetQuery)
      if (resolvedStreet) {
        return {
          latitude: resolvedStreet.lat,
          longitude: resolvedStreet.lng,
          precisao: 'rua',
        }
      }
    }

    // 3. Apenas CEP
    if (cep) {
      const cepCoord = await geocodeCepArea(cep, cidade, estado)
      if (cepCoord) {
        return {
          latitude: cepCoord.lat,
          longitude: cepCoord.lng,
          precisao: 'bairro',
        }
      }
    }

    // 4. Apenas cidade e estado
    if (cidade) {
      const syncMatch = getCityCoordinateSync(cidade, estado)
      if (syncMatch) {
        return {
          latitude: syncMatch.lat,
          longitude: syncMatch.lng,
          precisao: 'cidade',
        }
      }

      // Tenta geocodificar cidade via Nominatim se não estiver na tabela estática
      const cityQuery = `${cidade}, ${estado || ''}, Brasil`
      const cityResolved = await geocodeNominatimQuery(cityQuery)
      if (cityResolved) {
        return {
          latitude: cityResolved.lat,
          longitude: cityResolved.lng,
          precisao: 'cidade',
        }
      }
    }

    // 5. Se nada resolver
    return {
      latitude: undefined,
      longitude: undefined,
      precisao: 'sem-localizacao',
    }
  })()

  if (clientId) {
    clientResolutionInProgress.set(clientId, promise)
  }

  try {
    return await promise
  } finally {
    if (clientId) {
      clientResolutionInProgress.delete(clientId)
    }
  }
}

/**
 * Persiste as coordenadas resolvidas de volta no registro do PocketBase caso o cliente ainda não as tenha salvas.
 */
export async function persistResolvedCoordinates(
  clientId: string,
  resolved: GeocodeResolutionResult,
): Promise<void> {
  if (!clientId) return
  try {
    const payload: Record<string, any> = {
      precisao: resolved.precisao,
    }
    if (typeof resolved.latitude === 'number' && typeof resolved.longitude === 'number') {
      payload.latitude = resolved.latitude
      payload.longitude = resolved.longitude
      payload.lat = resolved.latitude
      payload.lng = resolved.longitude
      payload.geocode_precision =
        resolved.precisao === 'exata'
          ? 'exact'
          : resolved.precisao === 'rua'
            ? 'street'
            : resolved.precisao === 'cidade'
              ? 'city'
              : 'street'
    } else {
      payload.latitude = null
      payload.longitude = null
      payload.lat = null
      payload.lng = null
    }

    await pb.collection('factories').update(clientId, payload)
  } catch (err) {
    console.warn('[Geocoding] Falha ao persistir coordenadas no cliente:', clientId, err)
  }
}
