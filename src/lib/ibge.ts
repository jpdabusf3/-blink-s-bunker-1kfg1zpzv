import { BRAZILIAN_UFS } from './cnpj'

// Cache em memória de validação de municípios
const ibgeValidatedCache = new Map<string, boolean>()

// Municípios conhecidos com centróides e grafias oficiais para validação instantânea offline
export const KNOWN_IBGE_MUNICIPALITIES: Record<string, string[]> = {
  SP: [
    'São Paulo',
    'Campinas',
    'Indaiatuba',
    'Sorocaba',
    'Ribeirão Preto',
    'São José dos Campos',
    'Santos',
    'São José do Rio Preto',
    'Piracicaba',
    'Bauru',
    'Jundiaí',
    'Franca',
    'Marília',
    'Presidente Prudente',
    'Araraquara',
    'São Carlos',
    'Americana',
    'Botucatu',
    'Amparo',
    'Andradina',
    'Angatuba',
    'Cabreúva',
    'Guareí',
    'Mirassol',
    'Salto de Pirapora',
    'Santa Cruz do Rio Pardo',
    'Bragança Paulista',
    'Santa Isabel',
    'Santa Fé do Sul',
    "Santa Bárbara d'Oeste",
    'Santa Albertina',
    'Riolândia',
    'Ribeirão dos Índios',
    'Registro',
    'Limeira',
    'Rio Claro',
    'Taubaté',
    'Araçatuba',
  ],
  PR: [
    'Maringá',
    'Cascavel',
    'Toledo',
    'Londrina',
    'Curitiba',
    'Ponta Grossa',
    'Foz do Iguaçu',
    'Guarapuava',
    'Paranaguá',
    'Apucarana',
    'Arapongas',
    'Umuarama',
    'Campo Mourão',
    'Arapoti',
    'Castro',
    'Rolândia',
    'Cambé',
    'Paranavaí',
    'Pato Branco',
    'Francisco Beltrão',
    'Telêmaco Borba',
  ],
  SC: [
    'Chapecó',
    'Joinville',
    'Florianópolis',
    'Blumenau',
    'Criciúma',
    'Itajaí',
    'Vargeão',
    'Lages',
    'Jaraguá do Sul',
    'Palhoça',
    'São José',
    'Concórdia',
    'Tubarão',
    'Brusque',
    'Caçador',
  ],
  RS: [
    'Porto Alegre',
    'Caxias do Sul',
    'Passo Fundo',
    'Garibaldi',
    'Pelotas',
    'Canoas',
    'Santa Maria',
    'Gravataí',
    'Viamão',
    'Novo Hamburgo',
    'São Leopoldo',
    'Rio Grande',
    'Alvorada',
    'Bento Gonçalves',
  ],
  MS: [
    'Campo Grande',
    'Dourados',
    'Três Lagoas',
    'Corumbá',
    'Ponta Porã',
    'Naviraí',
    'Nova Andradina',
    'Sidrolândia',
    'Aquidauana',
    'Maracaju',
    'Paranaíba',
  ],
  MT: [
    'Cuiabá',
    'Várzea Grande',
    'Rondonópolis',
    'Sinop',
    'Sorriso',
    'Lucas do Rio Verde',
    'Primavera do Leste',
    'Barra do Bugres',
    'Alta Floresta',
    'Tangará da Serra',
    'Nova Mutum',
    'Campo Novo do Parecis',
  ],
  GO: [
    'Goiânia',
    'Aparecida de Goiânia',
    'Anápolis',
    'Rio Verde',
    'Acreúna',
    'Luziânia',
    'Águas Lindas de Goiás',
    'Valparaíso de Goiás',
    'Trindade',
    'Formosa',
    'Itumbiara',
    'Jataí',
    'Senador Canedo',
  ],
  MG: [
    'Belo Horizonte',
    'Uberlândia',
    'Contagem',
    'Juiz de Fora',
    'Betim',
    'Montes Claros',
    'Ribeirão das Neves',
    'Uberaba',
    'Governador Valadares',
    'Ipatinga',
    'Sete Lagoas',
    'Divinópolis',
    'Passos',
    'Patos de Minas',
  ],
  ES: [
    'Vitória',
    'Vila Velha',
    'Serra',
    'Cariacica',
    'Cachoeiro de Itapemirim',
    'Linhares',
    'São Mateus',
    'Colatina',
    'Santa Maria de Jetibá',
  ],
  RJ: [
    'Rio de Janeiro',
    'São Gonçalo',
    'Duque de Caxias',
    'Nova Iguaçu',
    'Niterói',
    'Belford Roxo',
    'Campos dos Goytacazes',
    'São João de Meriti',
    'Petrópolis',
    'Volta Redonda',
  ],
  BA: [
    'Salvador',
    'Feira de Santana',
    'Vitória da Conquista',
    'Camaçari',
    'Juazeiro',
    'Itabuna',
    'Lauro de Freitas',
    'Ilhéus',
    'Jequié',
    'Teixeira de Freitas',
  ],
  DF: ['Brasília'],
}

function normalizeStr(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Valida a UF contra os 27 estados e DF oficiais do Brasil
 */
export function isValidUF(uf?: string | null): boolean {
  if (!uf) return false
  const cleanUf = uf.trim().toUpperCase()
  return (BRAZILIAN_UFS as readonly string[]).includes(cleanUf)
}

/**
 * Valida se um município e UF são consistentes com o cadastro do IBGE.
 * 1. Primeiro checa localmente nos municípios frequentes e centróides da base.
 * 2. Faz fallback transparente contra a API pública do IBGE (com cache local) se for um município do interior não listado.
 */
export async function validateMunicipioIBGE(
  cidade?: string | null,
  uf?: string | null,
): Promise<{
  isValid: boolean
  normalizedCidade?: string
  normalizedUf?: string
  message?: string
}> {
  if (!cidade || !cidade.trim()) {
    return { isValid: false, message: 'Cidade é obrigatória.' }
  }
  if (!uf || !uf.trim()) {
    return { isValid: false, message: 'UF/Estado é obrigatório.' }
  }

  const cleanUf = uf.trim().toUpperCase()
  if (!isValidUF(cleanUf)) {
    return { isValid: false, message: `UF '${cleanUf}' não é um estado brasileiro válido.` }
  }

  const cleanCity = cidade.trim()
  const cacheKey = `${cleanUf}:${normalizeStr(cleanCity)}`

  if (ibgeValidatedCache.has(cacheKey)) {
    const valid = ibgeValidatedCache.get(cacheKey)!
    return {
      isValid: valid,
      normalizedCidade: cleanCity,
      normalizedUf: cleanUf,
      message: valid
        ? undefined
        : `Cidade '${cleanCity}' não encontrada na base do IBGE para o estado ${cleanUf}.`,
    }
  }

  // 1. Verificação local rápida
  const localList = KNOWN_IBGE_MUNICIPALITIES[cleanUf] || []
  const targetNorm = normalizeStr(cleanCity)
  const localMatch = localList.find((m) => normalizeStr(m) === targetNorm)
  if (localMatch) {
    ibgeValidatedCache.set(cacheKey, true)
    return {
      isValid: true,
      normalizedCidade: localMatch,
      normalizedUf: cleanUf,
    }
  }

  // 2. Consulta via API pública do IBGE para municípios de qualquer UF
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const resp = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cleanUf}/municipios`,
      { signal: controller.signal },
    )
    clearTimeout(timeout)

    if (resp.ok) {
      const municipios: Array<{ id: number; nome: string }> = await resp.json()
      const found = municipios.find((m) => normalizeStr(m.nome) === targetNorm)
      if (found) {
        ibgeValidatedCache.set(cacheKey, true)
        return {
          isValid: true,
          normalizedCidade: found.nome,
          normalizedUf: cleanUf,
        }
      } else {
        ibgeValidatedCache.set(cacheKey, false)
        return {
          isValid: false,
          message: `Cidade '${cleanCity}' não foi localizada no estado ${cleanUf} conforme base oficial do IBGE.`,
        }
      }
    }
  } catch (err) {
    console.warn(
      '[validateMunicipioIBGE] Falha ao consultar IBGE online, adotando validação não bloqueante:',
      err,
    )
  }

  // Se a requisição online ao IBGE falhar (offline / timeout), aceita cidade não-vazia com UF válida
  ibgeValidatedCache.set(cacheKey, true)
  return {
    isValid: true,
    normalizedCidade: cleanCity,
    normalizedUf: cleanUf,
  }
}
