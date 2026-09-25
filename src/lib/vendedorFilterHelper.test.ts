import { describe, it, expect } from 'vitest'
import {
  normalizeStr,
  normalizeSellerName,
  getFactorySellerMatches,
  factoryMatchesVendedor,
  resolveVendedorIdentity,
  type UnifiedVendedorOption,
} from './vendedorFilterHelper'
import type { Factory } from '@/types'

const createMockFactory = (partial: Partial<Factory> & Record<string, any>): Factory => {
  return {
    id: 'f1',
    name: 'Cliente Teste',
    region: 'Sul',
    stateRegion: 'Sul',
    state: 'PR',
    city: 'Curitiba',
    status: 'Ativo',
    priority: 'Alta',
    score: 80,
    potentialValue: 100000,
    winProbability: 50,
    lastInteraction: '2025-01-01',
    funnelStage: 'Proposta Enviada',
    species: ['Bovinos'],
    animalSpecies: ['Bovinos'],
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
    ...partial,
  } as Factory
}

describe('vendedorFilterHelper', () => {
  describe('normalizeSellerName', () => {
    it('normaliza João Pedro e variações para o canônico João Figueiredo', () => {
      expect(normalizeSellerName('João Pedro')).toBe('João Figueiredo')
      expect(normalizeSellerName('joao pedro')).toBe('João Figueiredo')
      expect(normalizeSellerName('JOÃO PEDRO')).toBe('João Figueiredo')
      expect(normalizeSellerName('Joao Figueiredo')).toBe('João Figueiredo')
      expect(normalizeSellerName('joão figueiredo')).toBe('João Figueiredo')
    })

    it('mantém outros nomes preservando formatação sem espaços extras', () => {
      expect(normalizeSellerName('  Carlos Silva  ')).toBe('Carlos Silva')
      expect(normalizeSellerName('')).toBe('')
      expect(normalizeSellerName(null)).toBe('')
    })
  })

  describe('normalizeStr', () => {
    it('remove acentos e transforma em minúsculas', () => {
      expect(normalizeStr('João Figueiredo')).toBe('joao figueiredo')
      expect(normalizeStr('André Gonçalves')).toBe('andre goncalves')
      expect(normalizeStr('ÁÉÍÓÚ âêîôû ãõ ç')).toBe('aeiou aeiou ao c')
    })
  })

  describe('getFactorySellerMatches', () => {
    it('extrai vendedor_id e vendedor_name diretos', () => {
      const factory = createMockFactory({
        vendedor_id: '4urt19q2phjs7fn',
        vendedor_name: 'João Figueiredo',
      })
      const matches = getFactorySellerMatches(factory)
      expect(matches.ids).toContain('4urt19q2phjs7fn')
      expect(matches.names).toContain('João Figueiredo')
    })

    it('extrai campo textual alternativo vendedor (nome com acento)', () => {
      const factory = createMockFactory({
        vendedor: 'João Figueiredo',
      })
      const matches = getFactorySellerMatches(factory)
      expect(matches.names).toContain('João Figueiredo')
    })

    it('converte variação "João Pedro" em vendedor ou vendedor_name para o canônico "João Figueiredo"', () => {
      const factory = createMockFactory({
        vendedor: 'joão pedro',
      })
      const matches = getFactorySellerMatches(factory)
      expect(matches.names).toContain('João Figueiredo')
    })

    it('extrai campo alternativo vendedor se contiver ID de 15 caracteres', () => {
      const factory = createMockFactory({
        vendedor: '4urt19q2phjs7fn',
      })
      const matches = getFactorySellerMatches(factory)
      expect(matches.ids).toContain('4urt19q2phjs7fn')
    })

    it('lida com vendedor e vendedor_id quando vierem como objeto', () => {
      const factory = createMockFactory({
        vendedor_id: { id: 'v123', nome: 'Renato Silva' } as any,
        vendedor: { id: 'v456', name: 'João Pedro' } as any,
      })
      const matches = getFactorySellerMatches(factory)
      expect(matches.ids).toContain('v123')
      expect(matches.ids).toContain('v456')
      expect(matches.names).toContain('Renato Silva')
      expect(matches.names).toContain('João Figueiredo')
    })

    it('lida com expansões em factory.expand', () => {
      const factory = createMockFactory({
        expand: {
          vendedor_id: { id: 'exp_vend_1', nome: 'João Figueiredo' },
          vendedor: { id: 'exp_vend_2', nome: 'Marcos Vinicius' },
        },
      })
      const matches = getFactorySellerMatches(factory)
      expect(matches.ids).toContain('exp_vend_1')
      expect(matches.ids).toContain('exp_vend_2')
      expect(matches.names).toContain('João Figueiredo')
      expect(matches.names).toContain('Marcos Vinicius')
    })
  })

  describe('factoryMatchesVendedor', () => {
    const mockOptions: UnifiedVendedorOption[] = [
      {
        value: '4urt19q2phjs7fn',
        label: 'João Figueiredo',
        gestaoTecnicaId: '4urt19q2phjs7fn',
        userIds: ['rxo1gz5ovha70lu'],
        emails: ['joao.pedro@blinkbiotech.com', 'joao.figueiredo@blinkbiotech.com'],
      },
      {
        value: 'vscx4eb1s06fuiy',
        label: 'Rodrigo Gardinal',
        gestaoTecnicaId: 'vscx4eb1s06fuiy',
        userIds: ['i3jvhfdwufuwfe1', 'gee3174a0a6c6qx'],
        emails: ['rodrigo.gardinal@blinkbiotech.com'],
      },
    ]

    it('retorna true quando o filtro é "all" ou vazio', () => {
      const factory = createMockFactory({ vendedor_id: '4urt19q2phjs7fn' })
      expect(factoryMatchesVendedor(factory, 'all')).toBe(true)
      expect(factoryMatchesVendedor(factory, '')).toBe(true)
      expect(factoryMatchesVendedor(factory, 'Todos')).toBe(true)
    })

    it('reconhece João Figueiredo quando a factory tem apenas vendedor_id', () => {
      const factory = createMockFactory({
        vendedor_id: '4urt19q2phjs7fn',
        salesOwner: undefined,
      })
      expect(factoryMatchesVendedor(factory, '4urt19q2phjs7fn', mockOptions)).toBe(true)
      expect(factoryMatchesVendedor(factory, 'rxo1gz5ovha70lu', mockOptions)).toBe(true)
      expect(factoryMatchesVendedor(factory, 'João Figueiredo', mockOptions)).toBe(true)
    })

    it('reconhece João Figueiredo quando a factory tem apenas vendedor_name com acento ou maiúsculas', () => {
      const factoryWithAccent = createMockFactory({
        vendedor_name: 'JOÃO FIGUEIREDO',
        salesOwner: undefined,
        vendedor_id: undefined,
      })
      expect(factoryMatchesVendedor(factoryWithAccent, '4urt19q2phjs7fn', mockOptions)).toBe(true)
      expect(factoryMatchesVendedor(factoryWithAccent, 'joao figueiredo', mockOptions)).toBe(true)
    })

    it('reconhece João Figueiredo quando a factory tem vendedor_name antigo "João Pedro"', () => {
      const factoryWithOldName = createMockFactory({
        vendedor_name: 'João Pedro',
        salesOwner: undefined,
        vendedor_id: undefined,
      })
      expect(factoryMatchesVendedor(factoryWithOldName, '4urt19q2phjs7fn', mockOptions)).toBe(true)
      expect(factoryMatchesVendedor(factoryWithOldName, 'João Figueiredo', mockOptions)).toBe(true)
    })

    it('reconhece quando factory possui campo alternativo "vendedor" textual', () => {
      const factory = createMockFactory({
        vendedor: 'João Figueiredo',
        salesOwner: undefined,
        vendedor_id: undefined,
      })
      expect(factoryMatchesVendedor(factory, '4urt19q2phjs7fn', mockOptions)).toBe(true)
      expect(factoryMatchesVendedor(factory, 'João Figueiredo', mockOptions)).toBe(true)
    })

    it('filtra corretamente excluindo outros vendedores quando não casam', () => {
      const factoryRodrigo = createMockFactory({
        vendedor_id: 'vscx4eb1s06fuiy',
        vendedor_name: 'Rodrigo Gardinal',
      })
      expect(factoryMatchesVendedor(factoryRodrigo, '4urt19q2phjs7fn', mockOptions)).toBe(false)
      expect(factoryMatchesVendedor(factoryRodrigo, 'vscx4eb1s06fuiy', mockOptions)).toBe(true)
    })
  })

  describe('resolveVendedorIdentity', () => {
    it('resolve alias João Pedro / João Figueiredo para ambos os nomes e IDs conhecidos', () => {
      const id1 = resolveVendedorIdentity('joao pedro')
      expect(id1.names.has('joao figueiredo')).toBe(true)
      expect(id1.names.has('joao pedro')).toBe(true)
      expect(id1.ids.has('4urt19q2phjs7fn')).toBe(true)
      expect(id1.ids.has('rxo1gz5ovha70lu')).toBe(true)

      const id2 = resolveVendedorIdentity('4urt19q2phjs7fn')
      expect(id2.names.has('joao figueiredo')).toBe(true)
      expect(id2.names.has('joao pedro')).toBe(true)
    })
  })
})
