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
