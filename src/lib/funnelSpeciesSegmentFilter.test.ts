import { describe, it, expect } from 'vitest'
import {
  canonicalSpeciesSegmentCategory,
  normalizeTag,
  formatCategoryLabel,
  buildSpeciesSegmentOptions,
  getFactorySpeciesSegmentCategories,
  factoryMatchesSpeciesSegment,
} from './funnelSpeciesSegmentFilter'
import type { Factory } from '@/types'

describe('funnelSpeciesSegmentFilter', () => {
  describe('normalizeTag', () => {
    it('normaliza acentos, trim e caixa alta', () => {
      expect(normalizeTag('  Suínos  ')).toBe('SUINOS')
      expect(normalizeTag('Bovinos')).toBe('BOVINOS')
      expect(normalizeTag('Multiespécie')).toBe('MULTIESPECIE')
      expect(normalizeTag(null)).toBe('')
      expect(normalizeTag(undefined)).toBe('')
    })
  })

  describe('canonicalSpeciesSegmentCategory (Requisito 1: Unificação de Ruminantes e Bovinos)', () => {
    it('unifica Bovinos, Bovino, BOVINOS, Ruminantes, RUMINANTES em "RUMINANTES"', () => {
      expect(canonicalSpeciesSegmentCategory('Bovinos')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('Bovino')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('BOVINOS')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('bovino')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('bovinos')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('Ruminantes')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('Ruminante')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('RUMINANTES')).toBe('RUMINANTES')
      expect(canonicalSpeciesSegmentCategory('ruminante')).toBe('RUMINANTES')
    })

    it('unifica Aves e AVES para "AVES"', () => {
      expect(canonicalSpeciesSegmentCategory('Aves')).toBe('AVES')
      expect(canonicalSpeciesSegmentCategory('AVES')).toBe('AVES')
      expect(canonicalSpeciesSegmentCategory('Ave')).toBe('AVES')
    })

    it('unifica Suínos, Suinos e SUINOS para "SUINOS"', () => {
      expect(canonicalSpeciesSegmentCategory('Suínos')).toBe('SUINOS')
      expect(canonicalSpeciesSegmentCategory('Suinos')).toBe('SUINOS')
      expect(canonicalSpeciesSegmentCategory('SUINOS')).toBe('SUINOS')
      expect(canonicalSpeciesSegmentCategory('Suíno')).toBe('SUINOS')
    })

    it('unifica Pet, Pets, PET, PETS para "PETS"', () => {
      expect(canonicalSpeciesSegmentCategory('Pet')).toBe('PETS')
      expect(canonicalSpeciesSegmentCategory('Pets')).toBe('PETS')
      expect(canonicalSpeciesSegmentCategory('PET')).toBe('PETS')
      expect(canonicalSpeciesSegmentCategory('PETS')).toBe('PETS')
    })

    it('unifica Aqua e AQUA para "AQUA"', () => {
      expect(canonicalSpeciesSegmentCategory('Aqua')).toBe('AQUA')
      expect(canonicalSpeciesSegmentCategory('AQUA')).toBe('AQUA')
    })

    it('trata multiespécie', () => {
      expect(canonicalSpeciesSegmentCategory('Multiespécie')).toBe('MULTIESPECIE')
      expect(canonicalSpeciesSegmentCategory('Multiespécies')).toBe('MULTIESPECIE')
      expect(canonicalSpeciesSegmentCategory('Multi espécie')).toBe('MULTIESPECIE')
    })
  })

  describe('formatCategoryLabel', () => {
    it('retorna labels amigáveis em português', () => {
      expect(formatCategoryLabel('RUMINANTES')).toBe('Ruminantes')
      expect(formatCategoryLabel('AVES')).toBe('Aves')
      expect(formatCategoryLabel('SUINOS')).toBe('Suínos')
      expect(formatCategoryLabel('PETS')).toBe('Pets')
      expect(formatCategoryLabel('AQUA')).toBe('Aqua')
      expect(formatCategoryLabel('MULTIESPECIE')).toBe('Multiespécie')
    })
  })

  describe('buildSpeciesSegmentOptions', () => {
    it('gera lista sem duplicatas onde espécie e segmento equivalente apontam para a mesma opção', () => {
      const mockFactories: Factory[] = [
        {
          id: '1',
          name: 'Cliente 1',
          city: 'Cidade A',
          region: 'Sudeste',
          capacity: 0,
          potentialValue: 100,
          status: 'Atendido',
          lastInteraction: '2026-01-01',
          contactName: 'Contato',
          contactPhone: '11999999999',
          operationTypes: '',
          productInterests: '',
          funnelStage: 'Lead',
          winProbability: 50,
          swot: {
            strengths: '',
            weaknesses: '',
            opportunities: '',
            threats: '',
            generalAttractiveness: 5,
          },
          matrix: {
            financial: 5,
            technical: 5,
            fit: 5,
            openness: 5,
            competition: 5,
            urgency: 5,
            roi: 5,
          },
          animalSpecies: 'Bovinos',
          carteira: 'RUMINANTES',
        },
        {
          id: '2',
          name: 'Cliente 2',
          city: 'Cidade B',
          region: 'Sul',
          capacity: 0,
          potentialValue: 200,
          status: 'Atendido',
          lastInteraction: '2026-01-01',
          contactName: 'Contato',
          contactPhone: '11999999999',
          operationTypes: '',
          productInterests: '',
          funnelStage: 'Lead',
          winProbability: 50,
          swot: {
            strengths: '',
            weaknesses: '',
            opportunities: '',
            threats: '',
            generalAttractiveness: 5,
          },
          matrix: {
            financial: 5,
            technical: 5,
            fit: 5,
            openness: 5,
            competition: 5,
            urgency: 5,
            roi: 5,
          },
          animalSpecies: 'Aves',
          carteira: 'AVES',
        },
      ]

      const options = buildSpeciesSegmentOptions(mockFactories)
      const values = options.map((o) => o.value)

      // RUMINANTES deve estar presente e não deve ter BOVINOS duplicado
      expect(values).toContain('RUMINANTES')
      expect(values).not.toContain('BOVINOS')
      expect(values).toContain('AVES')
      expect(values).toContain('PETS')
      expect(values).toContain('SUINOS')

      // Label de RUMINANTES deve ser 'Ruminantes'
      const ruminantesOpt = options.find((o) => o.value === 'RUMINANTES')
      expect(ruminantesOpt?.label).toBe('Ruminantes')

      // Não há valores duplicados
      const setVals = new Set(values)
      expect(setVals.size).toBe(values.length)
    })
  })

  describe('factoryMatchesSpeciesSegment (Requisitos 1 e 2)', () => {
    const baseFactory: Factory = {
      id: 'f1',
      name: 'Fábrica Teste',
      city: 'São Paulo',
      region: 'Sudeste',
      capacity: 100,
      potentialValue: 1000,
      status: 'Ativo',
      lastInteraction: '2026-01-01',
      contactName: 'José',
      contactPhone: '11999999999',
      operationTypes: '',
      productInterests: '',
      funnelStage: 'Proposta',
      winProbability: 50,
      swot: {
        strengths: '',
        weaknesses: '',
        opportunities: '',
        threats: '',
        generalAttractiveness: 5,
      },
      matrix: {
        financial: 5,
        technical: 5,
        fit: 5,
        openness: 5,
        competition: 5,
        urgency: 5,
        roi: 5,
      },
    }

    it('permite todos quando target for "all" ou vazio', () => {
      expect(factoryMatchesSpeciesSegment(baseFactory, 'all')).toBe(true)
      expect(factoryMatchesSpeciesSegment(baseFactory, '')).toBe(true)
    })

    it('cliente com espécie "Bovinos" casa quando filtro "Ruminantes" (ou RUMINANTES) é selecionado', () => {
      const bovinoFactory: Factory = {
        ...baseFactory,
        animalSpecies: 'Bovinos',
        carteira: '',
      }
      expect(factoryMatchesSpeciesSegment(bovinoFactory, 'Ruminantes')).toBe(true)
      expect(factoryMatchesSpeciesSegment(bovinoFactory, 'RUMINANTES')).toBe(true)
      expect(factoryMatchesSpeciesSegment(bovinoFactory, 'bovinos')).toBe(true)
      expect(factoryMatchesSpeciesSegment(bovinoFactory, 'Suínos')).toBe(false)
    })

    it('cliente com espécie "Ruminantes" casa quando filtro "Ruminantes" é selecionado', () => {
      const ruminanteFactory: Factory = {
        ...baseFactory,
        animalSpecies: 'Ruminantes',
      }
      expect(factoryMatchesSpeciesSegment(ruminanteFactory, 'Ruminantes')).toBe(true)
      expect(factoryMatchesSpeciesSegment(ruminanteFactory, 'RUMINANTES')).toBe(true)
      expect(factoryMatchesSpeciesSegment(ruminanteFactory, 'AVES')).toBe(false)
    })

    it('cliente com segmento "RUMINANTES" casa quando filtro "Ruminantes" é selecionado', () => {
      const segRuminanteFactory: Factory = {
        ...baseFactory,
        animalSpecies: undefined,
        carteira: 'RUMINANTES',
      }
      expect(factoryMatchesSpeciesSegment(segRuminanteFactory, 'Ruminantes')).toBe(true)
      expect(factoryMatchesSpeciesSegment(segRuminanteFactory, 'RUMINANTES')).toBe(true)
      expect(factoryMatchesSpeciesSegment(segRuminanteFactory, 'PETS')).toBe(false)
    })

    it('cliente com segmento "BOVINOS" casa quando filtro "Ruminantes" é selecionado', () => {
      const segBovinoFactory: Factory = {
        ...baseFactory,
        animalSpecies: undefined,
        carteira: 'BOVINOS',
      }
      expect(factoryMatchesSpeciesSegment(segBovinoFactory, 'Ruminantes')).toBe(true)
      expect(factoryMatchesSpeciesSegment(segBovinoFactory, 'RUMINANTES')).toBe(true)
    })

    it('cliente com array de animalSpecies contendo "Bovino" casa com "Ruminantes"', () => {
      const multiSpeciesFactory: Factory = {
        ...baseFactory,
        animalSpecies: ['Bovinos', 'Equinos'],
      }
      expect(factoryMatchesSpeciesSegment(multiSpeciesFactory, 'Ruminantes')).toBe(true)
      expect(factoryMatchesSpeciesSegment(multiSpeciesFactory, 'Equinos')).toBe(true)
      expect(factoryMatchesSpeciesSegment(multiSpeciesFactory, 'Aves')).toBe(false)
    })

    it('filtro único: cliente com espécie "Pet" OU segmento "PETS" casa com "Pets"', () => {
      const petFactory: Factory = {
        ...baseFactory,
        animalSpecies: 'Pet',
        carteira: 'PETS',
      }
      expect(factoryMatchesSpeciesSegment(petFactory, 'Pets')).toBe(true)
      expect(factoryMatchesSpeciesSegment(petFactory, 'PETS')).toBe(true)

      const onlySegPet: Factory = {
        ...baseFactory,
        animalSpecies: 'Aves',
        carteira: 'PETS',
      }
      // Se tiver carteira PETS, casa com PETS ou com AVES
      expect(factoryMatchesSpeciesSegment(onlySegPet, 'Pets')).toBe(true)
      expect(factoryMatchesSpeciesSegment(onlySegPet, 'Aves')).toBe(true)
      expect(factoryMatchesSpeciesSegment(onlySegPet, 'Ruminantes')).toBe(false)
    })
  })
})
