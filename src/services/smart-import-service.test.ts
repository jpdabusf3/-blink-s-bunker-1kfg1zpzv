import { describe, it, expect } from 'vitest'
import {
  buildDuplicateKey,
  validateSmartRows,
  parseTextToTabularRows,
} from './smart-import-service'
import { autoSuggestMapping, parseDateBR } from './import-faturamento'
import { normalizeNumberBR } from '@/lib/utils'

describe('Smart Import Service - Unit Tests', () => {
  describe('Fuzzy / Auto-Suggest Mapping', () => {
    it('reconhece cabeçalhos comuns em português e inglês com acentos ou maiúsculas', () => {
      const headers = [
        'Data Faturamento',
        'Cliente - Razão Social',
        'Doc. Número',
        'Item Descrição',
        'Valor Total (R$)',
        'Vendedor Responsável',
      ]

      const mapping = autoSuggestMapping(headers)
      expect(mapping['Data Faturamento']).toBe('data')
      expect(mapping['Cliente - Razão Social']).toBe('cliente')
      expect(mapping['Doc. Número']).toBe('numero_documento')
      expect(mapping['Item Descrição']).toBe('produto')
      expect(mapping['Valor Total (R$)']).toBe('valor')
      expect(mapping['Vendedor Responsável']).toBe('vendedor')
    })

    it('diferencia corretamente colunas de USD e R$', () => {
      const headers = ['DocDate', 'Customer', 'Amount USD', 'Valor Total R$', 'Sales Rep']
      const mapping = autoSuggestMapping(headers)
      expect(mapping['DocDate']).toBe('data')
      expect(mapping['Customer']).toBe('cliente')
      expect(mapping['Amount USD']).toBe('valor_usd')
      expect(mapping['Valor Total R$']).toBe('valor')
      expect(mapping['Sales Rep']).toBe('vendedor')
    })
  })

  describe('Moeda Brasileira (normalizeNumberBR)', () => {
    it('converte strings monetárias no padrão BR (R$ 1.234,56) para float correto', () => {
      expect(normalizeNumberBR('R$ 1.234,56')).toBe(1234.56)
      expect(normalizeNumberBR('R$  12.345,67')).toBe(12345.67)
      expect(normalizeNumberBR('1.234,56')).toBe(1234.56)
    })

    it('converte strings com ponto decimal simples (1234.56)', () => {
      expect(normalizeNumberBR('1234.56')).toBe(1234.56)
      expect(normalizeNumberBR(500.25)).toBe(500.25)
    })

    it('trata valores vazios, zeros ou inválidos retornando 0', () => {
      expect(normalizeNumberBR('')).toBe(0)
      expect(normalizeNumberBR(null)).toBe(0)
      expect(normalizeNumberBR(undefined)).toBe(0)
      expect(normalizeNumberBR('-')).toBe(0)
    })
  })

  describe('Datas Brasileiras (parseDateBR)', () => {
    it('formata DD/MM/AAAA e DD-MM-AAAA corretamente', () => {
      expect(parseDateBR('15/08/2026')).toBe('15/08/2026')
      expect(parseDateBR('05-09-2026')).toBe('05/09/2026')
    })

    it('formata data em formato ISO (YYYY-MM-DD) para DD/MM/AAAA', () => {
      expect(parseDateBR('2026-08-15')).toBe('15/08/2026')
      expect(parseDateBR('2025-01-01T12:00:00Z')).toBe('01/01/2025')
    })

    it('formata MM/AAAA adicionando primeiro dia do mês', () => {
      expect(parseDateBR('08/2026')).toBe('01/08/2026')
    })

    it('trata valores vazios retornando travessão', () => {
      expect(parseDateBR('')).toBe('—')
      expect(parseDateBR(null)).toBe('—')
      expect(parseDateBR(undefined)).toBe('—')
    })
  })

  describe('Detecção de Duplicata (buildDuplicateKey)', () => {
    it('produz chave determinística normalizada sem acentos e minúscula', () => {
      const key1 = buildDuplicateKey(
        '1001 - Cooperativa Agroindustrial',
        '15/08/2026',
        'NF-1234',
        'Blink Zinc 22',
      )
      const key2 = buildDuplicateKey(
        'Cooperativa Agroindustrial',
        '15/08/2026',
        'nf1234',
        'blink zinc 22',
      )

      expect(key1).toBe(key2)
      expect(key1).toContain('nf1234')
      expect(key1).toContain('blinkzinc22')
      expect(key1).toContain('15082026')
    })

    it('identifica duplicatas em linhas idênticas', () => {
      const keyA = buildDuplicateKey('Cliente X', '10/01/2026', '100', 'Prod Y')
      const keyB = buildDuplicateKey('cliente x', '10/01/2026', '100', 'prod y')
      expect(keyA).toBe(keyB)
    })
  })

  describe('Validação Linha a Linha (validateSmartRows)', () => {
    it('marca linhas com dados válidos e detecta duplicatas no mesmo lote', () => {
      const rows = [
        {
          Data: '15/08/2026',
          Cliente: 'Cooperativa Alpha',
          Documento: '1001',
          Produto: 'Blink Zinc',
          Valor: 'R$ 1.500,00',
        },
        {
          Data: '15/08/2026',
          Cliente: 'Cooperativa Alpha',
          Documento: '1001',
          Produto: 'Blink Zinc',
          Valor: 'R$ 1.500,00',
        },
        {
          Data: '20/08/2026',
          Cliente: 'Fazenda Beta',
          Documento: '1002',
          Produto: 'Blink Copper',
          Valor: '2500.50',
        },
        {
          Data: '',
          Cliente: '',
          Documento: '',
          Produto: '',
          Valor: '0',
        },
      ]

      const mapping = {
        Data: 'data' as const,
        Cliente: 'cliente' as const,
        Documento: 'numero_documento' as const,
        Produto: 'produto' as const,
        Valor: 'valor' as const,
      }

      const summary = validateSmartRows(rows, mapping)

      // 3 primeiras linhas são válidas estruturalmente (a 2ª é duplicata da 1ª), a 4ª é inválida
      expect(summary.validCount).toBe(3)
      expect(summary.invalidCount).toBe(1)
      expect(summary.duplicateCount).toBe(1)
      expect(summary.rowValidations[1].isDuplicate).toBe(true)
      expect(summary.rowValidations[3].isValid).toBe(false)
      expect(summary.validationErrors.length).toBe(1)
    })
  })

  describe('Parsing de Texto Tabular (parseTextToTabularRows)', () => {
    it('converte tabelas Markdown em objetos tabulares', () => {
      const markdown = `
| Data | Cliente | Valor |
| --- | --- | --- |
| 10/08/2026 | Nutri S.A. | R$ 5.000,00 |
| 12/08/2026 | Agro Brasil | R$ 8.500,00 |
`
      const result = parseTextToTabularRows(markdown)
      expect(result.headers).toEqual(['Data', 'Cliente', 'Valor'])
      expect(result.rows.length).toBe(2)
      expect(result.rows[0]['Cliente']).toBe('Nutri S.A.')
    })

    it('converte texto delimitado por ponto e vírgula', () => {
      const csv = `Data;Cliente;Valor\n10/08/2026;Premix Ltda;1200,50\n11/08/2026;Rações Bom Dia;3400,00`
      const result = parseTextToTabularRows(csv)
      expect(result.headers).toEqual(['Data', 'Cliente', 'Valor'])
      expect(result.rows.length).toBe(2)
    })

    it('retorna vazio se o texto não for tabular', () => {
      const text = 'Este é apenas um documento com texto corrido sem formato de tabela.'
      const result = parseTextToTabularRows(text)
      expect(result.rows.length).toBe(0)
    })
  })
})
