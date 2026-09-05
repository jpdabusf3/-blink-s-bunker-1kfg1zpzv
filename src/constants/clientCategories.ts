/**
 * Categorias fixas de clientes para filtros de Perfil / Carteira.
 * Ordem e nomes padronizados com inicial maiúscula conforme especificação:
 * 1. Cooperativas
 * 2. Distribuidores
 * 3. Indústria
 * 4. Integradora
 * 5. Produtor
 * 6. Premixeiras
 * 7. Revenda
 * 8. Representantes
 */
export const CLIENT_PROFILE_CATEGORIES = [
  'Cooperativas',
  'Distribuidores',
  'Indústria',
  'Integradora',
  'Produtor',
  'Premixeiras',
  'Revenda',
  'Representantes',
] as const

export type ClientProfileCategory = (typeof CLIENT_PROFILE_CATEGORIES)[number]

/**
 * Remove acentos e converte para minúsculas para comparação semântica.
 */
export function normalizeCategoryString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Mapeamento canônico das 8 categorias para uma chave normalizada simplificada.
 * Suporta tolerância a acentos, maiúsculas/minúsculas e variações singular/plural
 * (ex: "cooperativa" <-> "Cooperativas", "industria" / "industrias" <-> "Indústria",
 * "premixeira" / "premixeiras" <-> "Premixeiras", "revenda" / "revendas" <-> "Revenda",
 * "distribuidor" / "distribuidores" <-> "Distribuidores", "produtor" / "produtores" <-> "Produtor",
 * "representante" / "representantes" <-> "Representantes", "integradora" / "integradoras" <-> "Integradora").
 */
const CANONICAL_KEYS: Record<ClientProfileCategory, string> = {
  Cooperativas: 'cooperativ',
  Distribuidores: 'distribuidor',
  Indústria: 'industri',
  Integradora: 'integrador',
  Produtor: 'produtor',
  Premixeiras: 'premixeir',
  Revenda: 'revend',
  Representantes: 'representant',
}

/**
 * Mapeia um valor bruto qualquer de perfil para uma das 8 categorias canônicas
 * usando correspondência tolerante a acentos, caixa e singular/plural.
 * Se nenhuma das 8 categorias casar, retorna null.
 */
export function toCanonicalCategory(
  rawProfileValue: string | null | undefined,
): ClientProfileCategory | null {
  if (!rawProfileValue || !rawProfileValue.trim()) return null
  const clean = rawProfileValue.trim()

  for (const cat of CLIENT_PROFILE_CATEGORIES) {
    if (matchesProfileCategory(clean, cat)) {
      return cat
    }
  }

  return null
}

/**
 * Normaliza um valor de perfil: se corresponder a uma das 8 categorias canônicas,
 * retorna o nome canônico exato. Caso contrário, preserva a string original intacta.
 */
export function normalizeProfileValue(rawProfileValue: string): string {
  const canonical = toCanonicalCategory(rawProfileValue)
  return canonical || rawProfileValue
}

/**
 * Normaliza uma lista de perfis:
 * 1. Mapeia cada elemento para a categoria canônica caso haja casamento tolerante
 * 2. Preserva elementos sem correspondência
 * 3. Remove duplicatas mantendo a ordem
 */
export function normalizeProfileList(profiles: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const p of profiles) {
    if (p === null || p === undefined) continue
    const trimmed = String(p).trim()
    if (!trimmed) continue

    const normalized = normalizeProfileValue(trimmed)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }

  return result
}

/**
 * Retorna true se um valor de perfil/carteira fornecido (ex: "Cooperativa", "industria", "Revendas", etc.)
 * corresponde à categoria canônica de destino.
 */
export function matchesProfileCategory(
  rawProfileValue: string | null | undefined,
  targetCategory: string,
): boolean {
  if (!rawProfileValue || !targetCategory) return false

  const normalizedVal = normalizeCategoryString(rawProfileValue)
  const normalizedTarget = normalizeCategoryString(targetCategory)

  // Comparação direta exata normalizada (sem acentos e case-insensitive)
  if (normalizedVal === normalizedTarget) return true

  // Verifica através do stem canônico se o target pertence às 8 categorias
  const canonicalStem = CANONICAL_KEYS[targetCategory as ClientProfileCategory]
  if (canonicalStem) {
    if (normalizedVal.startsWith(canonicalStem)) return true
    if (normalizedTarget.startsWith(normalizedVal) && normalizedVal.length >= 4) return true
  }

  // Tolerância geral de plural/singular simples (removendo 's' / 'es')
  const stem = (s: string) => {
    if (s.endsWith('es')) return s.slice(0, -2)
    if (s.endsWith('s')) return s.slice(0, -1)
    return s
  }

  const sVal = stem(normalizedVal)
  const sTarget = stem(normalizedTarget)

  return sVal === sTarget || sVal.startsWith(sTarget) || sTarget.startsWith(sVal)
}

/**
 * Verifica se alguma entrada na lista de perfis do cliente corresponde a alguma categoria selecionada.
 */
export function matchesAnyProfileCategory(
  clientProfiles: string[],
  selectedCategories: string[],
): boolean {
  if (selectedCategories.length === 0) return true
  if (clientProfiles.length === 0) return false

  return selectedCategories.some((selected) =>
    clientProfiles.some((cp) => matchesProfileCategory(cp, selected)),
  )
}

/**
 * Conta clientes por categoria canônica usando o mesmo casamento tolerante.
 * Aceita uma lista de clientes que tenham a propriedade profile_type (e opcionalmente carteira).
 */
export function countClientsByCategory<
  T extends { profile_type?: string[] | string; carteira?: string },
>(clients: T[]): Record<ClientProfileCategory, number> {
  const counts = CLIENT_PROFILE_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = 0
      return acc
    },
    {} as Record<ClientProfileCategory, number>,
  )

  for (const client of clients) {
    const rawList: string[] = []
    if (Array.isArray(client.profile_type)) {
      rawList.push(...client.profile_type.filter(Boolean))
    } else if (typeof client.profile_type === 'string' && client.profile_type.trim()) {
      rawList.push(client.profile_type.trim())
    }

    if (client.carteira && client.carteira.trim() && !rawList.includes(client.carteira.trim())) {
      rawList.push(client.carteira.trim())
    }

    // Para cada categoria canônica, verifica se este cliente pertence a ela
    for (const cat of CLIENT_PROFILE_CATEGORIES) {
      if (rawList.some((p) => matchesProfileCategory(p, cat))) {
        counts[cat]++
      }
    }
  }

  return counts
}
