import { describe, it, expect } from 'vitest'
import {
  normalizeCategoryString,
  matchesProfileCategory,
  matchesAnyProfileCategory,
  toCanonicalCategory,
  normalizeProfileValue,
  countClientsByCategory,
} from './clientCategories'

describe('normalizeCategoryString', () => {
  it('handles standard strings with accents and casing', () => {
    expect(normalizeCategoryString('Indústria')).toBe('industria')
    expect(normalizeCategoryString('  Cooperativas  ')).toBe('cooperativas')
    expect(normalizeCategoryString('REVENDAS')).toBe('revendas')
  })

  it('handles null, undefined, boolean, and numbers gracefully without throwing', () => {
    expect(normalizeCategoryString(null)).toBe('')
    expect(normalizeCategoryString(undefined)).toBe('')
    expect(normalizeCategoryString(true)).toBe('')
    expect(normalizeCategoryString(false)).toBe('')
    expect(normalizeCategoryString(123)).toBe('123')
  })

  it('handles arrays and json stringified arrays gracefully', () => {
    expect(normalizeCategoryString(['Indústria', 'Revenda'])).toBe('industria revenda')
    expect(normalizeCategoryString('["Indústria", "Cooperativa"]')).toBe('industria cooperativa')
  })

  it('handles objects with name/label/value', () => {
    expect(normalizeCategoryString({ name: 'Produtor' })).toBe('produtor')
    expect(normalizeCategoryString({ label: 'Indústria' })).toBe('industria')
  })
})

describe('matchesProfileCategory', () => {
  it('matches standard string values', () => {
    expect(matchesProfileCategory('Indústria', 'Indústria')).toBe(true)
    expect(matchesProfileCategory('industria', 'Indústria')).toBe(true)
    expect(matchesProfileCategory('indústrias', 'Indústria')).toBe(true)
    expect(matchesProfileCategory('Cooperativa', 'Cooperativas')).toBe(true)
    expect(matchesProfileCategory('Cooperativas', 'Cooperativas')).toBe(true)
  })

  it('tolerates non-string inputs such as arrays from PocketBase multi-select', () => {
    expect(matchesProfileCategory(['Indústria'], 'Indústria')).toBe(true)
    expect(matchesProfileCategory(['Revenda', 'Indústria'], 'Indústria')).toBe(true)
    expect(matchesProfileCategory(['Revenda'], 'Indústria')).toBe(false)
  })

  it('tolerates null, undefined, empty string, numbers, and boolean without throwing', () => {
    expect(matchesProfileCategory(null, 'Indústria')).toBe(false)
    expect(matchesProfileCategory(undefined, 'Indústria')).toBe(false)
    expect(matchesProfileCategory('', 'Indústria')).toBe(false)
    expect(matchesProfileCategory(123, 'Indústria')).toBe(false)
    expect(matchesProfileCategory(true, 'Indústria')).toBe(false)
    expect(matchesProfileCategory('Indústria', null as any)).toBe(false)
    expect(matchesProfileCategory('Indústria', undefined as any)).toBe(false)
  })

  it('tolerates comma separated strings', () => {
    expect(matchesProfileCategory('Indústria, Revenda', 'Indústria')).toBe(true)
    expect(matchesProfileCategory('Revenda, Cooperativa', 'Indústria')).toBe(false)
  })
})

describe('matchesAnyProfileCategory and countClientsByCategory', () => {
  it('matchesAnyProfileCategory works with array profile_type and selections', () => {
    expect(matchesAnyProfileCategory(['Indústria'], ['Indústria'])).toBe(true)
    expect(matchesAnyProfileCategory('Indústria', ['Indústria'])).toBe(true)
    expect(matchesAnyProfileCategory(null as any, ['Indústria'])).toBe(false)
  })

  it('countClientsByCategory counts properly with various profile_type types', () => {
    const clients = [
      { profile_type: ['Indústria'] },
      { profile_type: 'Cooperativa' },
      { profile_type: null },
      { profile_type: undefined },
      { profile_type: ['Indústria', 'Revenda'] },
    ]
    const counts = countClientsByCategory(clients)
    expect(counts['Indústria']).toBe(2)
    expect(counts['Cooperativas']).toBe(1)
    expect(counts['Revenda']).toBe(1)
  })
})
