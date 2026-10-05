/**
 * Utilitário e cache de coordenadas geográficas por Cidade e UF
 *
 * 1. Dicionário estático para as principais praças da base da Blink
 * 2. Normalização fonética/alfanumérica simples (sem acentos, minúsculo, traço)
 * 3. Resolução a partir dos próprios clientes com coordenadas válidas
 * 4. Fallback online com Nominatim OpenStreetMap (debounce, rate limit e não bloqueante)
 */

export interface CityCoordinate {
  lat: number
  lng: number
  city?: string
  state?: string
  precision: 'city' | 'state'
  source: 'static' | 'peer_cache' | 'state_fallback' | 'nominatim'
}

/**
 * Normaliza cidade e estado para chave única de busca: "maringa-pr", "campinas-sp", etc.
 */
export function normalizeCityUfKey(city?: string | null, state?: string | null): string {
  if (!city && !state) return ''

  const clean = (val?: string | null) =>
    (val || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      // Remove anotações comuns tipo "(matriz)", "- filial", etc.
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^a-z0-9]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')

  let c = clean(city)
  let s = clean(state)

  // Se a cidade veio no formato "Maringá - PR" ou "Maringá/PR" e o estado estava em branco
  if (c && !s) {
    const parts = c.split(' ')
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1]
      if (lastPart.length === 2) {
        s = lastPart
        c = parts.slice(0, -1).join(' ')
      }
    }
  }

  // Mapeamento simples de nome de estado por extenso para sigla UF
  const STATE_NAMES_TO_UF: Record<string, string> = {
    'sao paulo': 'sp',
    parana: 'pr',
    'santa catarina': 'sc',
    'rio grande do sul': 'rs',
    'riio grande do sul': 'rs',
    'mato grosso do sul': 'ms',
    'mato grosso': 'mt',
    goias: 'go',
    'minas gerais': 'mg',
    'rio de janeiro': 'rj',
    'espirito santo': 'es',
    bahia: 'ba',
    ceara: 'ce',
    pernambuco: 'pe',
    para: 'pa',
    amazonas: 'am',
    'distrito federal': 'df',
  }

  if (STATE_NAMES_TO_UF[s]) {
    s = STATE_NAMES_TO_UF[s]
  } else if (s.length > 2) {
    // Se ainda for longo, mantém primeiras 2 letras se não conhecido
    s = s.slice(0, 2)
  }

  if (!c && !s) return ''
  if (!s) return c
  if (!c) return s
  return `${c}-${s}`
}

/**
 * Coordenadas reais das principais cidades da base de atuação
 */
export const STATIC_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'maringa-pr': { lat: -23.420999, lng: -51.933056 },
  'cascavel-pr': { lat: -24.957777, lng: -53.459511 },
  'toledo-pr': { lat: -24.71998, lng: -53.74086 },
  'londrina-pr': { lat: -23.3103, lng: -51.1628 },
  'curitiba-pr': { lat: -25.42778, lng: -49.27306 },
  'indaiatuba-sp': { lat: -23.09028, lng: -47.21806 },
  'sao paulo-sp': { lat: -23.55052, lng: -46.633308 },
  'campo grande-ms': { lat: -20.4697, lng: -54.6201 },
  'dourados-ms': { lat: -22.223056, lng: -54.808056 },
  'chapeco-sc': { lat: -27.0964, lng: -52.6183 },

  // Cidades adicionais muito frequentes no cadastro
  'campinas-sp': { lat: -22.9056, lng: -47.0596 },
  'salto de pirapora-sp': { lat: -23.64925, lng: -47.572946 },
  'salto do pirapora-sp': { lat: -23.66052, lng: -47.580843 },
  'mirassol-sp': { lat: -20.81414, lng: -49.50745 },
  'sao jose do rio preto-sp': { lat: -20.81258, lng: -49.38042 },
  'rio verde-go': { lat: -17.79212, lng: -50.91912 },
  'botucatu-sp': { lat: -22.8858, lng: -48.445 },
  'americana-sp': { lat: -22.7394, lng: -47.3314 },
  'amparo-sp': { lat: -22.7011, lng: -46.7644 },
  'andradina-sp': { lat: -20.8961, lng: -51.3794 },
  'angatuba-sp': { lat: -23.49389, lng: -48.411067 },
  'anapolis-go': { lat: -16.3267, lng: -48.9534 },
  'garibaldi-rs': { lat: -29.2558, lng: -51.5342 },
  'santa cruz do rio pardo-sp': { lat: -22.90607, lng: -49.62773 },
  'braganca paulista-sp': { lat: -22.95202, lng: -46.54185 },
  'acreuna-go': { lat: -17.3972, lng: -50.3756 },
  'alta floresta-mt': { lat: -9.8756, lng: -56.0861 },
  'cabreuva-sp': { lat: -23.3075, lng: -47.1331 },
  'guarei-sp': { lat: -23.3725, lng: -48.3228 },
  'passos-mg': { lat: -20.7186, lng: -46.6097 },
  'vargeao-sc': { lat: -26.8344, lng: -52.1647 },
  'santa maria de jetiba-es': { lat: -20.0406, lng: -40.7461 },
  'rondonopolis-mt': { lat: -16.4674, lng: -54.6361 },
  'barra do bugres-mt': { lat: -15.0731, lng: -57.1811 },
  'santa isabel-sp': { lat: -23.3156, lng: -46.2214 },
  'santa fe do sul-sp': { lat: -20.2117, lng: -50.9258 },
  'santa barbara d oeste-sp': { lat: -22.7539, lng: -47.4144 },
  'santa albertina-sp': { lat: -20.0319, lng: -50.7303 },
  'riolandia-sp': { lat: -19.9972, lng: -49.6806 },
  'ribeirao preto-sp': { lat: -21.1767, lng: -47.8108 },
  'ribeirao dos indios-sp': { lat: -21.5061, lng: -51.6053 },
  'registro-sp': { lat: -24.4967, lng: -47.8447 },
  'arapoti-pr': { lat: -24.1578, lng: -49.8258 },
  'sao pauilo-sp': { lat: -23.55052, lng: -46.633308 }, // Erro de digitação comum no banco
  'cuiaba-mt': { lat: -15.6014, lng: -56.0979 },
  'goiania-go': { lat: -16.6869, lng: -49.2648 },
  'belo horizonte-mg': { lat: -19.9167, lng: -43.9345 },
  'vitoria-es': { lat: -20.3155, lng: -40.3128 },
  'porto alegre-rs': { lat: -30.0346, lng: -51.2177 },
  'florianopolis-sc': { lat: -27.5954, lng: -48.548 },
  'rio de janeiro-rj': { lat: -22.9068, lng: -43.1729 },
  'salvador-ba': { lat: -12.9777, lng: -38.5016 },
  'brasilia-df': { lat: -15.7942, lng: -47.8822 },
  'sorocaba-sp': { lat: -23.5015, lng: -47.4526 },
  'piracicaba-sp': { lat: -22.7253, lng: -47.6492 },
  'limeira-sp': { lat: -22.5647, lng: -47.4017 },
  'aracatuba-sp': { lat: -21.2089, lng: -50.4328 },
  'bauru-sp': { lat: -22.3147, lng: -49.0606 },
  'marilia-sp': { lat: -22.2139, lng: -49.9458 },
  'presidente prudente-sp': { lat: -22.1256, lng: -51.3889 },
  'franca-sp': { lat: -20.5386, lng: -47.4008 },
  'rio claro-sp': { lat: -22.4147, lng: -47.5606 },
  'taubate-sp': { lat: -23.0264, lng: -45.5558 },
  'sao jose dos campos-sp': { lat: -23.1896, lng: -45.8841 },
  'santos-sp': { lat: -23.9608, lng: -46.3336 },
  'jundiai-sp': { lat: -23.1857, lng: -46.8978 },
  'araraquara-sp': { lat: -21.7944, lng: -48.1758 },
  'sao carlos-sp': { lat: -22.0175, lng: -47.8908 },
  'ponta grossa-pr': { lat: -25.0994, lng: -50.1583 },
  'foz do iguacu-pr': { lat: -25.5478, lng: -54.5881 },
  'guarapuava-pr': { lat: -25.3953, lng: -51.4625 },
  'paranagua-pr': { lat: -25.5161, lng: -48.5225 },
  'apucarana-pr': { lat: -23.5511, lng: -51.4614 },
  'arapongas-pr': { lat: -23.4144, lng: -51.4247 },
  'umuarama-pr': { lat: -23.7661, lng: -53.325 },
  'campo mourao-pr': { lat: -24.0458, lng: -52.3786 },
  'patos de minas-mg': { lat: -18.5789, lng: -46.5181 },
  'uberlandia-mg': { lat: -18.9186, lng: -48.2772 },
  'uberaba-mg': { lat: -19.7483, lng: -47.9319 },
  'tres lagoas-ms': { lat: -20.7847, lng: -51.7006 },
  'sinop-mt': { lat: -11.8608, lng: -55.5097 },
  'sorriso-mt': { lat: -12.5425, lng: -55.7214 },
  'lucas do rio verde-mt': { lat: -13.0642, lng: -55.9108 },
  'primavera do leste-mt': { lat: -15.5586, lng: -54.2961 },
  'caxias do sul-rs': { lat: -29.1678, lng: -51.1794 },
  'passo fundo-rs': { lat: -28.2628, lng: -52.4067 },
  'joinville-sc': { lat: -26.3044, lng: -48.8486 },
  'blumenau-sc': { lat: -26.9194, lng: -49.0658 },
  'criciuma-sc': { lat: -28.6775, lng: -49.3703 },
  'itajaí-sc': { lat: -26.9078, lng: -48.6619 },
  'itajai-sc': { lat: -26.9078, lng: -48.6619 },
}

/**
 * Centróides geográficos de todos os Estados brasileiros (UF) para fallback quando a cidade não puder ser resolvida
 */
export const STATE_CENTROID_COORDINATES: Record<
  string,
  { lat: number; lng: number; name: string }
> = {
  sp: { lat: -22.1352, lng: -48.8872, name: 'São Paulo' },
  pr: { lat: -24.89, lng: -51.55, name: 'Paraná' },
  sc: { lat: -27.2423, lng: -50.2189, name: 'Santa Catarina' },
  rs: { lat: -29.7547, lng: -53.776, name: 'Rio Grande do Sul' },
  ms: { lat: -20.51, lng: -54.54, name: 'Mato Grosso do Sul' },
  mt: { lat: -12.64, lng: -55.42, name: 'Mato Grosso' },
  go: { lat: -15.98, lng: -49.86, name: 'Goiás' },
  df: { lat: -15.7998, lng: -47.8645, name: 'Distrito Federal' },
  mg: { lat: -18.1, lng: -44.38, name: 'Minas Gerais' },
  es: { lat: -19.57, lng: -40.67, name: 'Espírito Santo' },
  rj: { lat: -22.25, lng: -42.66, name: 'Rio de Janeiro' },
  ba: { lat: -12.52, lng: -41.69, name: 'Bahia' },
  se: { lat: -10.57, lng: -37.45, name: 'Sergipe' },
  al: { lat: -9.62, lng: -36.82, name: 'Alagoas' },
  pe: { lat: -8.38, lng: -37.86, name: 'Pernambuco' },
  pb: { lat: -7.12, lng: -36.72, name: 'Paraíba' },
  rn: { lat: -5.81, lng: -36.59, name: 'Rio Grande do Norte' },
  ce: { lat: -5.2, lng: -39.53, name: 'Ceará' },
  pi: { lat: -6.6, lng: -42.28, name: 'Piauí' },
  ma: { lat: -5.42, lng: -45.44, name: 'Maranhão' },
  to: { lat: -9.46, lng: -48.26, name: 'Tocantins' },
  pa: { lat: -3.79, lng: -52.48, name: 'Pará' },
  ap: { lat: 1.41, lng: -51.77, name: 'Amapá' },
  rr: { lat: 1.99, lng: -61.33, name: 'Roraima' },
  am: { lat: -3.47, lng: -65.1, name: 'Amazonas' },
  ac: { lat: -9.21, lng: -70.48, name: 'Acre' },
  ro: { lat: -10.9, lng: -62.76, name: 'Rondônia' },
}

// In-memory cache de resoluções nesta sessão
const runtimeCityCache = new Map<
  string,
  { lat: number; lng: number; source: CityCoordinate['source'] }
>()

// Inicializa com o dicionário estático
Object.entries(STATIC_CITY_COORDINATES).forEach(([k, coords]) => {
  runtimeCityCache.set(k, { ...coords, source: 'static' })
})

/**
 * Alimenta o cache de cidades a partir da lista de fábricas/clientes que já possuem coordenadas válidas
 */
export function buildPeerCityCache(
  factories: Array<{
    city?: string
    state?: string
    lat?: number
    lng?: number
    coordinates?: { lat: number; lng: number }
  }>,
): void {
  const cityGroups = new Map<string, { sumLat: number; sumLng: number; count: number }>()

  for (const f of factories) {
    const lat = f.lat ?? f.coordinates?.lat
    const lng = f.lng ?? f.coordinates?.lng
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) continue
    if (lat === 0 && lng === 0) continue

    const key = normalizeCityUfKey(f.city, f.state)
    if (!key) continue

    // Se já temos static no cache, não sobrescrevemos a precisão estática, mas acumulamos
    const current = cityGroups.get(key) || { sumLat: 0, sumLng: 0, count: 0 }
    current.sumLat += lat
    current.sumLng += lng
    current.count += 1
    cityGroups.set(key, current)
  }

  // Preenche o cache apenas se não existir ou se não for estático
  cityGroups.forEach((val, key) => {
    if (!runtimeCityCache.has(key)) {
      runtimeCityCache.set(key, {
        lat: Number((val.sumLat / val.count).toFixed(6)),
        lng: Number((val.sumLng / val.count).toFixed(6)),
        source: 'peer_cache',
      })
    }
  })
}

/**
 * Consulta se uma cidade/UF já tem coordenada em memória (estática ou derivada dos outros clientes)
 */
export function getCityCoordinateSync(
  city?: string | null,
  state?: string | null,
): CityCoordinate | null {
  const key = normalizeCityUfKey(city, state)
  if (!key) return null

  const cached = runtimeCityCache.get(key)
  if (cached) {
    return {
      lat: cached.lat,
      lng: cached.lng,
      city: city || '',
      state: state || '',
      precision: 'city',
      source: cached.source,
    }
  }

  // Tenta só pelo nome da cidade se UF faltar
  if (city) {
    const cityOnlyKey = normalizeCityUfKey(city, '')
    // Busca qualquer entrada no cache que comece com "${cityOnlyKey}-"
    for (const [k, v] of runtimeCityCache.entries()) {
      if (k.startsWith(`${cityOnlyKey}-`)) {
        return {
          lat: v.lat,
          lng: v.lng,
          city: city,
          state: state || '',
          precision: 'city',
          source: v.source,
        }
      }
    }
  }

  return null
}

/**
 * Normaliza apenas a UF/Estado (ex: "SP", "São Paulo" -> "sp")
 */
export function normalizeStateUf(state?: string | null): string {
  if (!state) return ''
  const clean = state
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, ' ')
    .trim()

  const STATE_NAMES_TO_UF: Record<string, string> = {
    'sao paulo': 'sp',
    parana: 'pr',
    'santa catarina': 'sc',
    'rio grande do sul': 'rs',
    'riio grande do sul': 'rs',
    'mato grosso do sul': 'ms',
    'mato grosso': 'mt',
    goias: 'go',
    'minas gerais': 'mg',
    'rio de janeiro': 'rj',
    'espirito santo': 'es',
    bahia: 'ba',
    ceara: 'ce',
    pernambuco: 'pe',
    para: 'pa',
    amazonas: 'am',
    'distrito federal': 'df',
    sergipe: 'se',
    alagoas: 'al',
    paraiba: 'pb',
    'rio grande do norte': 'rn',
    piaui: 'pi',
    maranhao: 'ma',
    tocantins: 'to',
    amapa: 'ap',
    roraima: 'rr',
    acre: 'ac',
    rondonia: 'ro',
  }

  if (STATE_NAMES_TO_UF[clean]) return STATE_NAMES_TO_UF[clean]
  if (clean.length === 2 && STATE_CENTROID_COORDINATES[clean]) return clean
  return ''
}

/**
 * Consulta fallback por centróide do estado quando cidade não for encontrada
 */
export function getStateCentroidSync(state?: string | null): CityCoordinate | null {
  const uf = normalizeStateUf(state)
  if (!uf) return null
  const coord = STATE_CENTROID_COORDINATES[uf]
  if (!coord) return null

  return {
    lat: coord.lat,
    lng: coord.lng,
    state: uf.toUpperCase(),
    precision: 'state',
    source: 'state_fallback',
  }
}

/**
 * Fallback em camadas para resolver localização aproximada:
 * 1. Procura cidade/UF no cache estático e peer_cache
 * 2. Se não encontrar, tenta pelo centro do Estado/UF
 */
export function resolveLocationFallbackSync(
  city?: string | null,
  state?: string | null,
): CityCoordinate | null {
  const cityMatch = getCityCoordinateSync(city, state)
  if (cityMatch) return cityMatch

  const stateMatch = getStateCentroidSync(state)
  if (stateMatch) return stateMatch

  return null
}

// Fila e rate limit para Nominatim (OpenStreetMap requer no máx ~1 req/s)
let lastNominatimRequestTime = 0
const pendingNominatimRequests = new Map<string, Promise<CityCoordinate | null>>()

/**
 * Fallback via Nominatim OpenStreetMap para cidades ainda não resolvidas
 */
export async function fetchCityCoordinateNominatim(
  city: string,
  state?: string,
): Promise<CityCoordinate | null> {
  const key = normalizeCityUfKey(city, state)
  if (!key) return null

  // Se já temos no cache, retorna imediatamente
  const syncMatch = getCityCoordinateSync(city, state)
  if (syncMatch) return syncMatch

  // Evita disparar requisições idênticas em paralelo
  if (pendingNominatimRequests.has(key)) {
    return pendingNominatimRequests.get(key)!
  }

  const task = (async (): Promise<CityCoordinate | null> => {
    try {
      // Throttle simples para respeitar os termos do OSM (mínimo 1000ms entre chamadas)
      const now = Date.now()
      const timeSinceLast = now - lastNominatimRequestTime
      if (timeSinceLast < 1000) {
        await new Promise((r) => setTimeout(r, 1000 - timeSinceLast))
      }
      lastNominatimRequestTime = Date.now()

      const params = new URLSearchParams({
        format: 'json',
        city: city.trim(),
        country: 'Brazil',
        limit: '1',
      })
      if (state && state.trim().length <= 3) {
        params.append('state', state.trim())
      }

      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
      const resp = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BlinksBunker/1.0 (contact@blinkbiotech.com)',
        },
      })

      if (!resp.ok) return null
      const data = await resp.json()

      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          const coord: CityCoordinate = {
            lat,
            lng,
            city,
            state,
            precision: 'city',
            source: 'nominatim',
          }
          runtimeCityCache.set(key, { lat, lng, source: 'nominatim' })
          return coord
        }
      }
      return null
    } catch {
      return null
    } finally {
      pendingNominatimRequests.delete(key)
    }
  })()

  pendingNominatimRequests.set(key, task)
  return task
}
