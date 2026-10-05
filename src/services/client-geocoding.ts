/**
 * Serviço de busca de CEP via ViaCEP e Geocodificação hierárquica por prioridades:
 * 1. Coordenadas já salvas (latitude / longitude) -> exata
 * 2. PRIORIDADE BASE LOCAL: normalizar município e UF e consultar base embutida IBGE / city-coordinates.
 *    Se correspondido -> retorna imediatamente sem nenhuma requisição HTTP ('cidade').
 * 3. Endereço completo (logradouro, numero, cidade, estado) via Nominatim com timeout curto e 1 retry -> rua
 * 4. Apenas CEP via ViaCEP + Nominatim com timeout curto -> bairro
 * 5. Fallback cidade/estado se não resolvido localmente via Nominatim -> cidade
 * 6. Falhando ou dados inválidos -> marcar como 'sem-localizacao' (nunca 0,0 nem coordenada inventada)
 *
 * Inclui cache estrito por cidade+UF, persistência em lote no PocketBase e proteção por AbortController.
 */

import pb from '@/lib/pocketbase/client'
import {
  getCityCoordinateSync,
  normalizeCityUfKey,
  resolveLocationFallbackSync,
} from './city-coordinates'
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

// Caches em memória para evitar chamadas duplicadas na sessão
const viaCepCache = new Map<string, ViaCepResult | null>()
const addressGeocodeCache = new Map<string, { lat: number; lng: number } | null>()
const cepGeocodeCache = new Map<string, { lat: number; lng: number } | null>()
const cityUfResolvedCache = new Map<
  string,
  { lat: number; lng: number; precisao: GeocodePrecisao } | null
>()
const clientResolutionInProgress = new Map<string, Promise<GeocodeResolutionResult>>()

// Rate limiter / serializador para chamadas externas (OSM exige máx ~1 req/s)
let lastExternalTimestamp = 0
async function throttleExternal(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastExternalTimestamp
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed))
  }
  lastExternalTimestamp = Date.now()
}

/**
 * Utilitário fetch com timeout usando AbortController nativo (~3,5s).
 * Inclui retry rápido único se a requisição falhar ou expirar.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3500,
  retries = 1,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      if (attempt >= retries) {
        // Log leve apenas se falhou todas as tentativas
        console.warn(`[Geocoding] Timeout ou erro ao consultar ${url.split('?')[0]}:`, err)
        return null
      }
      // Pequena pausa antes do retry rápido
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return null
}

/**
 * Consulta CEP na API pública ViaCEP com timeout de ~3,5s e no máx 1 retry.
 * Nunca quebra o fluxo: retorna null em caso de erro ou se CEP não for encontrado.
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
    const response = await fetchWithTimeout(
      `https://viacep.com.br/ws/${cleanCep}/json/`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      3500,
      1,
    )

    if (!response || !response.ok) {
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
  } catch {
    viaCepCache.set(cleanCep, null)
    return null
  }
}

/**
 * Geocodifica endereço completo via Nominatim OSM com cache, throttle e timeout de ~3,5s
 */
async function geocodeNominatimQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return null

  if (addressGeocodeCache.has(trimmed)) {
    return addressGeocodeCache.get(trimmed) || null
  }

  try {
    await throttleExternal()

    const params = new URLSearchParams({
      format: 'json',
      q: query,
      countrycodes: 'br',
      limit: '1',
    })

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const resp = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BlinksBunker/1.0 (contact@blinkbiotech.com)',
        },
      },
      3500,
      1,
    )

    if (!resp || !resp.ok) {
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
  } catch {
    addressGeocodeCache.set(trimmed, null)
    return null
  }
}

/**
 * Geocodifica a área de um CEP (prioridade 4: precisao = 'bairro')
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

  // Tenta pelo CEP postal code no OSM com timeout curto
  try {
    await throttleExternal()

    const params = new URLSearchParams({
      format: 'json',
      postalcode: `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
      country: 'Brazil',
      limit: '1',
    })
    if (cidade) params.append('city', cidade)
    if (estado && estado.length <= 3) params.append('state', estado)

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const resp = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BlinksBunker/1.0 (contact@blinkbiotech.com)',
        },
      },
      3500,
      1,
    )

    if (resp && resp.ok) {
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
  } catch {
    // ignora
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
 * Consulta síncrona na base local embutida (IBGE / static / peer cache) com normalização
 */
export function resolveLocalCityCoordinate(
  cidade?: string | null,
  estado?: string | null,
): { lat: number; lng: number; precisao: GeocodePrecisao } | null {
  if (!cidade && !estado) return null

  // Chave normalizada cidade+UF
  const cityKey = normalizeCityUfKey(cidade, estado)
  if (cityKey && cityUfResolvedCache.has(cityKey)) {
    return cityUfResolvedCache.get(cityKey) || null
  }

  // 1. Tenta na base de coordenadas embutida
  const match = getCityCoordinateSync(cidade, estado)
  if (match) {
    const res = { lat: match.lat, lng: match.lng, precisao: 'cidade' as GeocodePrecisao }
    if (cityKey) cityUfResolvedCache.set(cityKey, res)
    return res
  }

  // 2. Tenta no fallback do centróide do estado se houver estado e a cidade for desconhecida
  const fallback = resolveLocationFallbackSync(cidade, estado)
  if (fallback) {
    const res = { lat: fallback.lat, lng: fallback.lng, precisao: 'cidade' as GeocodePrecisao }
    if (cityKey) cityUfResolvedCache.set(cityKey, res)
    return res
  }

  return null
}

/**
 * Resolve a localização de um cliente estritamente pela ordem de prioridade:
 *
 * 1. Já tem coordenadas salvas (latitude / longitude válidas) -> retorna imediatamente ('exata')
 * 2. PRIORIDADE BASE LOCAL:
 *    Antes de QUALQUER chamada de rede, normaliza município e UF e consulta a base embutida
 *    IBGE/city-coordinates. Se encontrada -> retorna imediatamente com precisão 'cidade', SEM NENHUMA requisição HTTP.
 * 3. Endereço completo (logradouro, número, cidade, estado) via Nominatim com timeout curto e retry -> 'rua'
 * 4. Apenas CEP -> geocodificar área via ViaCEP / Nominatim com timeout curto -> 'bairro'
 * 5. Se não estava na base local e não tem logradouro/CEP, tenta Nominatim online para cidade -> 'cidade'
 * 6. Falhando ou sem dados suficientes -> 'sem-localizacao' (nunca 0,0 nem inventada)
 */
export async function resolveClientCoordinates(
  client: Partial<Factory>,
): Promise<GeocodeResolutionResult> {
  const clientId = client.id || ''
  if (clientId && clientResolutionInProgress.has(clientId)) {
    return clientResolutionInProgress.get(clientId)!
  }

  const promise = (async (): Promise<GeocodeResolutionResult> => {
    // 1. Já tem coordenadas salvas válidas
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

    const cidade = (client.city || '').trim()
    const estado = (client.state || '').trim()
    const logradouro = (client.logradouro || '').trim()
    const numero = (client.numero || '').trim()
    const cep = (client.cep || '').trim()

    // 2. PRIORIDADE BASE LOCAL: Se temos cidade/estado conhecidos localmente, retorna SEM rede!
    // (A menos que o usuário tenha um logradouro + número explícito configurado e queira tentar precisão de rua)
    const localCoord = resolveLocalCityCoordinate(cidade, estado)

    // Se temos endereço completo (rua + número), tentamos a rede apenas se houver endereço específico;
    // caso não haja logradouro/número, a base local já resolve imediatamente sem rede:
    if (!logradouro && localCoord) {
      return {
        latitude: localCoord.lat,
        longitude: localCoord.lng,
        precisao: 'cidade',
      }
    }

    // 3. Endereço completo com logradouro, número, cidade e estado
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
      // Tentativa sem o número
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

    // Se falhou endereço de rua mas temos a base local para a cidade, use-a agora sem chamar mais nada!
    if (localCoord) {
      return {
        latitude: localCoord.lat,
        longitude: localCoord.lng,
        precisao: 'cidade',
      }
    }

    // 4. Apenas CEP
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

    // 5. Tenta cidade via Nominatim online se não estava na base local
    if (cidade) {
      const cityKey = normalizeCityUfKey(cidade, estado)
      if (cityKey && cityUfResolvedCache.has(cityKey)) {
        const cached = cityUfResolvedCache.get(cityKey)
        if (cached) {
          return {
            latitude: cached.lat,
            longitude: cached.lng,
            precisao: 'cidade',
          }
        }
      }

      const cityQuery = `${cidade}, ${estado || ''}, Brasil`
      const cityResolved = await geocodeNominatimQuery(cityQuery)
      if (cityResolved) {
        if (cityKey) {
          cityUfResolvedCache.set(cityKey, {
            lat: cityResolved.lat,
            lng: cityResolved.lng,
            precisao: 'cidade',
          })
        }
        return {
          latitude: cityResolved.lat,
          longitude: cityResolved.lng,
          precisao: 'cidade',
        }
      } else if (cityKey) {
        cityUfResolvedCache.set(cityKey, null)
      }
    }

    // 6. Nada resolveu ou cliente sem cidade/estado válidos: marcar sem-localizacao
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
 * Aplica um offset determinístico suave para clientes que compartilham as mesmas coordenadas (ex.: mesmo centróide de cidade).
 * Evita sobreposição perfeita sem alterar a coordenada original persistida.
 */
export function applyDeterministicCoordinateOffset<
  T extends { id?: string; latitude?: number; longitude?: number; precisao?: string },
>(items: T[]): (T & { displayLat: number; displayLng: number; hasOffset: boolean })[] {
  const groups = new Map<string, T[]>()

  items.forEach((item) => {
    const lat = item.latitude
    const lng = item.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return
    }
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    const list = groups.get(key) || []
    list.push(item)
    groups.set(key, list)
  })

  return items.map((item) => {
    const lat = item.latitude ?? 0
    const lng = item.longitude ?? 0
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    const group = groups.get(key) || []

    if (group.length <= 1) {
      return {
        ...item,
        displayLat: lat,
        displayLng: lng,
        hasOffset: false,
      }
    }

    const sortedGroup = [...group].sort((a, b) => (a.id || '').localeCompare(b.id || ''))
    const idx = sortedGroup.findIndex((g) => (g.id || '') === (item.id || ''))
    const safeIdx = idx >= 0 ? idx : 0

    if (safeIdx === 0) {
      return {
        ...item,
        displayLat: lat,
        displayLng: lng,
        hasOffset: false,
      }
    }

    const angle = (safeIdx * 137.5 * Math.PI) / 180
    const radiusMeters = 0.0018 + Math.floor(safeIdx / 6) * 0.0012
    const offsetLat = Math.sin(angle) * radiusMeters
    const offsetLng = Math.cos(angle) * radiusMeters

    return {
      ...item,
      displayLat: lat + offsetLat,
      displayLng: lng + offsetLng,
      hasOffset: true,
    }
  })
}

/**
 * Cria o payload padrão para atualização de coordenadas de uma fábrica no PocketBase.
 */
export function createCoordinateUpdatePayload(resolved: GeocodeResolutionResult) {
  const payload: {
    precisao: GeocodePrecisao
    latitude?: number | null
    longitude?: number | null
    lat?: number | null
    lng?: number | null
    geocode_precision?: string
  } = {
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

  return payload
}

/**
 * Persiste um único cliente no PocketBase (usado por fluxos individuais ou pontuais)
 */
export async function persistResolvedCoordinates(
  clientId: string,
  resolved: GeocodeResolutionResult,
): Promise<void> {
  if (!clientId) return
  try {
    const payload = createCoordinateUpdatePayload(resolved)
    await pb.collection('factories').update(clientId, payload)
  } catch (err: unknown) {
    console.warn('[Geocoding] Falha ao persistir coordenadas no cliente:', clientId, err)
  }
}

/**
 * Persiste uma lista de resoluções em lotes (chunks de 10 a 20) usando Promise.allSettled
 * para evitar sobrecarga de rede e atualizar com segurança sem travar o cliente.
 */
export async function persistResolvedCoordinatesBatch(
  items: Array<{ clientId: string; resolved: GeocodeResolutionResult }>,
  chunkSize = 15,
): Promise<{ successCount: number; failCount: number }> {
  if (!items || items.length === 0) return { successCount: 0, failCount: 0 }

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const promises = chunk.map((item) => {
      const payload = createCoordinateUpdatePayload(item.resolved)
      return pb.collection('factories').update(item.clientId, payload)
    })

    const results = await Promise.allSettled(promises)
    results.forEach((res) => {
      if (res.status === 'fulfilled') {
        successCount++
      } else {
        failCount++
        console.warn('[Geocoding Batch] Falha ao persistir registro:', res.reason)
      }
    })
  }

  return { successCount, failCount }
}
