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
 * Trata graciosamente valores não-string (arrays, null, undefined, números, etc.) sem lançar exceções.
 */
export function normalizeCategoryString(str: unknown): string {
  if (str === null || str === undefined) return ''

  if (Array.isArray(str)) {
    return str
      .map((item) => normalizeCategoryString(item))
      .filter(Boolean)
      .join(' ')
  }

  if (typeof str === 'boolean') return ''

  if (typeof str === 'object') {
    const candidate =
      (str as Record<string, unknown>).name ??
      (str as Record<string, unknown>).label ??
      (str as Record<string, unknown>).value ??
      (str as Record<string, unknown>).title
    if (candidate !== undefined && candidate !== null) {
      return normalizeCategoryString(candidate)
    }
  }

  let s = typeof str === 'string' ? str : String(str)

  const trimmed = s.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeCategoryString(item))
          .filter(Boolean)
          .join(' ')
      }
    } catch {
      // continua com s normal
    }
  }

  s = trimmed.replace(/^["']+|["']+$/g, '')

  return s
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
export function toCanonicalCategory(rawProfileValue: unknown): ClientProfileCategory | null {
  if (rawProfileValue === null || rawProfileValue === undefined) return null

  if (Array.isArray(rawProfileValue)) {
    for (const item of rawProfileValue) {
      const cat = toCanonicalCategory(item)
      if (cat) return cat
    }
    return null
  }

  const clean =
    typeof rawProfileValue === 'string' ? rawProfileValue.trim() : String(rawProfileValue).trim()
  if (!clean) return null

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
export function normalizeProfileValue(rawProfileValue: unknown): string {
  if (rawProfileValue === null || rawProfileValue === undefined) return ''
  if (Array.isArray(rawProfileValue)) {
    return rawProfileValue
      .map((item) => normalizeProfileValue(item))
      .filter(Boolean)
      .join(', ')
  }
  const clean = typeof rawProfileValue === 'string' ? rawProfileValue : String(rawProfileValue)
  const canonical = toCanonicalCategory(clean)
  return canonical || clean
}

/**
 * Normaliza uma lista de perfis:
 * 1. Mapeia cada elemento para a categoria canônica caso haja casamento tolerante
 * 2. Preserva elementos sem correspondência
 * 3. Remove duplicatas mantendo a ordem
 */
export function normalizeProfileList(profiles: unknown): string[] {
  if (!profiles) return []
  const list = Array.isArray(profiles) ? profiles : [profiles]
  const seen = new Set<string>()
  const result: string[] = []

  for (const p of list) {
    if (p === null || p === undefined) continue
    if (Array.isArray(p)) {
      for (const sub of normalizeProfileList(p)) {
        if (!seen.has(sub)) {
          seen.add(sub)
          result.push(sub)
        }
      }
      continue
    }
    const trimmed = String(p).trim()
    if (!trimmed) continue

    const normalized = normalizeProfileValue(trimmed)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }

  return result
}

/**
 * Retorna true se um valor de perfil/carteira fornecido (ex: "Cooperativa", "industria", "Revendas", etc.)
 * corresponde à categoria canônica de destino.
 * Tolerante a arrays (multi-select), strings separadas por vírgula, objetos, null/undefined e tipos variados.
 */
export function matchesProfileCategory(rawProfileValue: unknown, targetCategory: unknown): boolean {
  if (
    rawProfileValue === null ||
    rawProfileValue === undefined ||
    targetCategory === null ||
    targetCategory === undefined
  ) {
    return false
  }

  // Se for array de perfis (ex: campo multi-select do PocketBase), testa cada item
  if (Array.isArray(rawProfileValue)) {
    return rawProfileValue.some((item) => matchesProfileCategory(item, targetCategory))
  }

  // Se o alvo for array, verifica se corresponde a qualquer um dos alvos
  if (Array.isArray(targetCategory)) {
    return targetCategory.some((item) => matchesProfileCategory(rawProfileValue, item))
  }

  // Se for string com formato de array JSON: "[...]"
  if (typeof rawProfileValue === 'string') {
    const trimmed = rawProfileValue.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.some((item) => matchesProfileCategory(item, targetCategory))
        }
      } catch {
        // prossegue como string normal
      }
    }

    // Se for string com múltiplos valores separados por vírgula ou ponto-e-vírgula
    if (trimmed.includes(',') || trimmed.includes(';')) {
      const separator = trimmed.includes(';') ? ';' : ','
      const parts = trimmed
        .split(separator)
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length > 1) {
        return parts.some((part) => matchesProfileCategory(part, targetCategory))
      }
    }
  }

  // Se for objeto com propriedade name/label/value
  if (typeof rawProfileValue === 'object') {
    const candidate =
      (rawProfileValue as Record<string, unknown>).name ??
      (rawProfileValue as Record<string, unknown>).label ??
      (rawProfileValue as Record<string, unknown>).value ??
      (rawProfileValue as Record<string, unknown>).title
    if (candidate !== undefined && candidate !== null) {
      return matchesProfileCategory(candidate, targetCategory)
    }
  }

  const normalizedVal = normalizeCategoryString(rawProfileValue)
  const normalizedTarget = normalizeCategoryString(targetCategory)

  if (!normalizedVal || !normalizedTarget) return false

  // Comparação direta exata normalizada (sem acentos e case-insensitive)
  if (normalizedVal === normalizedTarget) return true

  // Verifica através do stem canônico se o target pertence às 8 categorias
  const targetKey = (
    typeof targetCategory === 'string' ? targetCategory : String(targetCategory)
  ) as ClientProfileCategory
  const canonicalStem =
    CANONICAL_KEYS[targetKey] ||
    Object.entries(CANONICAL_KEYS).find(
      ([cat]) => normalizeCategoryString(cat) === normalizedTarget,
    )?.[1]

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
  clientProfiles: unknown,
  selectedCategories: unknown,
): boolean {
  const selectedArr: string[] = []
  if (Array.isArray(selectedCategories)) {
    for (const item of selectedCategories) {
      if (item !== null && item !== undefined && String(item).trim()) {
        selectedArr.push(String(item).trim())
      }
    }
  } else if (
    selectedCategories !== null &&
    selectedCategories !== undefined &&
    String(selectedCategories).trim()
  ) {
    selectedArr.push(String(selectedCategories).trim())
  }

  if (selectedArr.length === 0) return true

  const clientArr: unknown[] = []
  if (Array.isArray(clientProfiles)) {
    clientArr.push(...clientProfiles)
  } else if (clientProfiles !== null && clientProfiles !== undefined) {
    clientArr.push(clientProfiles)
  }

  if (clientArr.length === 0) return false

  return selectedArr.some((selected) =>
    clientArr.some((cp) => matchesProfileCategory(cp, selected)),
  )
}

/**
 * Conta clientes por categoria canônica usando o mesmo casamento tolerante.
 * Aceita uma lista de clientes que tenham a propriedade profile_type (e opcionalmente carteira).
 */
export function countClientsByCategory<T extends { profile_type?: unknown; carteira?: string }>(
  clients: T[],
): Record<ClientProfileCategory, number> {
  const counts = CLIENT_PROFILE_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = 0
      return acc
    },
    {} as Record<ClientProfileCategory, number>,
  )

  if (!Array.isArray(clients)) return counts

  for (const client of clients) {
    if (!client) continue
    const rawList: unknown[] = []
    if (Array.isArray(client.profile_type)) {
      rawList.push(...client.profile_type.filter((p) => p !== null && p !== undefined))
    } else if (client.profile_type !== null && client.profile_type !== undefined) {
      const s = String(client.profile_type).trim()
      if (s) rawList.push(s)
    }

    if (
      client.carteira &&
      typeof client.carteira === 'string' &&
      client.carteira.trim() &&
      !rawList.includes(client.carteira.trim())
    ) {
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
