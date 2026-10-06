import type { Factory } from '@/types'
import { CLIENT_SEGMENTOS } from '@/lib/cnpj'

/**
 * Remove acentos, espaços extras e converte para maiúsculas para correspondência semântica padronizada.
 */
export function normalizeTag(val?: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

/**
 * Normaliza qualquer variação de espécie ou segmento para a categoria canônica padronizada.
 * Regra principal do usuário:
 * "Ruminantes e Bovinos devem ser tratados como uma única categoria — 'RUMINANTES'."
 * Exemplos:
 * - "Bovinos", "Bovino", "BOVINOS", "Ruminantes", "Ruminante", "RUMINANTES" -> "RUMINANTES"
 * - "Aves", "AVES", "Ave" -> "AVES"
 * - "Suínos", "Suinos", "SUINOS", "Suíno", "Suino" -> "SUINOS"
 * - "Pet", "Pets", "PET", "PETS" -> "PETS"
 * - "Aqua", "AQUA", "Aquacultura" -> "AQUA"
 * - "Equinos", "Equino", "EQUINOS" -> "EQUINOS"
 * - "Caprinos", "Caprino", "CAPRINOS" -> "CAPRINOS"
 * - "Ovinos", "Ovino", "OVINOS" -> "OVINOS"
 * - "Multiespécie", "Multiespécies", "Multi espécie", "Multiespecie" -> "MULTIESPECIE"
 */
export function canonicalSpeciesSegmentCategory(val?: unknown): string {
  const norm = normalizeTag(val)
  if (!norm) return ''

  // Unificação de Bovinos e Ruminantes -> RUMINANTES
  if (norm.startsWith('BOVIN') || norm.startsWith('RUMINAN')) {
    return 'RUMINANTES'
  }

  // Aves
  if (norm.startsWith('AVE')) {
    return 'AVES'
  }

  // Suínos / Suinos
  if (norm.startsWith('SUIN')) {
    return 'SUINOS'
  }

  // Pets / Pet
  if (norm === 'PET' || norm === 'PETS' || norm.startsWith('PET ')) {
    return 'PETS'
  }

  // Aqua
  if (norm.startsWith('AQUA')) {
    return 'AQUA'
  }

  // Equinos
  if (norm.startsWith('EQUIN')) {
    return 'EQUINOS'
  }

  // Caprinos
  if (norm.startsWith('CAPRIN')) {
    return 'CAPRINOS'
  }

  // Ovinos
  if (norm.startsWith('OVIN')) {
    return 'OVINOS'
  }

  // Multiespécie
  if (
    norm.includes('MULTIESPECIE') ||
    norm.includes('MULTI ESPECIE') ||
    norm.includes('MULTIESPECIES')
  ) {
    return 'MULTIESPECIE'
  }

  return norm
}

/**
 * Formata a chave canônica para exibição amigável no select (Label),
 * mantendo compatibilidade visual com o que os usuários costumam ver no sistema.
 */
export function formatCategoryLabel(canonicalKey: string): string {
  switch (canonicalKey) {
    case 'RUMINANTES':
      return 'Ruminantes'
    case 'AVES':
      return 'Aves'
    case 'SUINOS':
      return 'Suínos'
    case 'PETS':
      return 'Pets'
    case 'AQUA':
      return 'Aqua'
    case 'EQUINOS':
      return 'Equinos'
    case 'CAPRINOS':
      return 'Caprinos'
    case 'OVINOS':
      return 'Ovinos'
    case 'MULTIESPECIE':
      return 'Multiespécie'
    default:
      // Converte "OUTRO_VALOR" para título Capitalizado
      return canonicalKey.charAt(0).toUpperCase() + canonicalKey.slice(1).toLowerCase()
  }
}

export interface SpeciesSegmentOption {
  value: string
  label: string
}

/**
 * Base de espécies conhecidas do sistema
 */
export const DEFAULT_KNOWN_SPECIES_SEGMENTS = [
  'RUMINANTES',
  'AVES',
  'PETS',
  'SUINOS',
  'AQUA',
  'EQUINOS',
  'CAPRINOS',
  'OVINOS',
  'MULTIESPECIE',
]

/**
 * Coleta todas as opções únicas de espécie e segmento dos clientes + padrões do sistema,
 * mescladas e deduplicadas sob a chave canônica (ex: Aves e AVES viram a mesma opção,
 * Ruminantes e Bovinos viram RUMINANTES).
 */
export function buildSpeciesSegmentOptions(factories: Factory[] = []): SpeciesSegmentOption[] {
  const seenKeys = new Set<string>()

  // 1. Adicionar padrões fixos (garante Ruminantes, Aves, Pets, Suínos, Aqua, etc.)
  for (const defaultKey of DEFAULT_KNOWN_SPECIES_SEGMENTS) {
    const canon = canonicalSpeciesSegmentCategory(defaultKey)
    if (canon) seenKeys.add(canon)
  }

  // 2. Adicionar segmentos oficiais do cadastro (CLIENT_SEGMENTOS: 'AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA')
  for (const seg of CLIENT_SEGMENTOS) {
    const canon = canonicalSpeciesSegmentCategory(seg)
    if (canon) seenKeys.add(canon)
  }

  // 3. Varrer factories para capturar espécies ou segmentos dinâmicos adicionais presentes em dados reais
  for (const f of factories) {
    // Espécie(s)
    const rawSpeciesList: unknown[] = Array.isArray(f.animalSpecies)
      ? f.animalSpecies
      : [f.animalSpecies]
    for (const sp of rawSpeciesList) {
      const canon = canonicalSpeciesSegmentCategory(sp)
      if (canon) seenKeys.add(canon)
    }

    // Segmento (carteira)
    if (f.carteira) {
      const canon = canonicalSpeciesSegmentCategory(f.carteira)
      if (canon) seenKeys.add(canon)
    }
  }

  // Ordem preferencial canônica para as categorias principais
  const priorityOrder: Record<string, number> = {
    RUMINANTES: 1,
    AVES: 2,
    PETS: 3,
    SUINOS: 4,
    AQUA: 5,
    EQUINOS: 6,
    CAPRINOS: 7,
    OVINOS: 8,
    MULTIESPECIE: 9,
  }

  return Array.from(seenKeys)
    .map((key) => ({
      value: key,
      label: formatCategoryLabel(key),
    }))
    .sort((a, b) => {
      const orderA = priorityOrder[a.value] ?? 100
      const orderB = priorityOrder[b.value] ?? 100
      if (orderA !== orderB) return orderA - orderB
      return a.label.localeCompare(b.label, 'pt-BR')
    })
}

/**
 * Retorna todas as categorias canônicas às quais um cliente pertence,
 * avaliando tanto a sua espécie (`animalSpecies`) quanto o seu segmento (`carteira`).
 */
export function getFactorySpeciesSegmentCategories(factory: Factory): Set<string> {
  const categories = new Set<string>()

  // 1. Avalia animalSpecies (string, array ou string com vírgulas/JSON)
  const rawSpecies = factory.animalSpecies
  if (rawSpecies) {
    if (Array.isArray(rawSpecies)) {
      for (const sp of rawSpecies) {
        const canon = canonicalSpeciesSegmentCategory(sp)
        if (canon) categories.add(canon)
      }
    } else if (typeof rawSpecies === 'string') {
      const trimmed = rawSpecies.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (Array.isArray(parsed)) {
            for (const sp of parsed) {
              const canon = canonicalSpeciesSegmentCategory(sp)
              if (canon) categories.add(canon)
            }
          }
        } catch {
          const canon = canonicalSpeciesSegmentCategory(trimmed)
          if (canon) categories.add(canon)
        }
      } else if (trimmed.includes(',')) {
        for (const part of trimmed.split(',')) {
          const canon = canonicalSpeciesSegmentCategory(part)
          if (canon) categories.add(canon)
        }
      } else {
        const canon = canonicalSpeciesSegmentCategory(trimmed)
        if (canon) categories.add(canon)
      }
    }
  }

  // 2. Avalia segmento / carteira
  if (factory.carteira && typeof factory.carteira === 'string') {
    const trimmed = factory.carteira.trim()
    if (trimmed && trimmed.toLowerCase() !== 'none') {
      const canon = canonicalSpeciesSegmentCategory(trimmed)
      if (canon) categories.add(canon)
    }
  }

  return categories
}

/**
 * Verifica se um cliente corresponde ao filtro de espécie/segmento selecionado.
 * Se targetCategory for 'all' ou vazio, aceita qualquer cliente.
 * Caso contrário, retorna verdadeiro se a espécie OU o segmento do cliente
 * pertencer à categoria selecionada (com unificação de Ruminantes/Bovinos).
 */
export function factoryMatchesSpeciesSegment(
  factory: Factory,
  targetCategory: string | string[],
): boolean {
  if (!targetCategory) return true

  // Suporte a seleção múltipla (array de categorias ou 'all')
  if (Array.isArray(targetCategory)) {
    if (
      targetCategory.length === 0 ||
      targetCategory.includes('all') ||
      targetCategory.includes('Todos')
    ) {
      return true
    }
    const normalizedTargets = targetCategory.map(canonicalSpeciesSegmentCategory).filter(Boolean)
    if (normalizedTargets.length === 0) return true

    const factoryCategories = getFactorySpeciesSegmentCategories(factory)
    // Lógica OR: corresponde se o cliente pertencer a QUALQUER uma das opções escolhidas
    return normalizedTargets.some((target) => factoryCategories.has(target))
  }

  if (targetCategory === 'all' || targetCategory === 'Todos') {
    return true
  }

  const normalizedTarget = canonicalSpeciesSegmentCategory(targetCategory)
  if (!normalizedTarget) return true

  const factoryCategories = getFactorySpeciesSegmentCategories(factory)
  return factoryCategories.has(normalizedTarget)
}
