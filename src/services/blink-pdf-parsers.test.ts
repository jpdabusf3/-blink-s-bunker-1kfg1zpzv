import { describe, it, expect } from 'vitest'
import {
  parseBlinkMonetaryValue,
  normalizeCarteiraName,
  detectBlinkReportType,
  parseMatrizVenda,
  parsePedidosCarteira,
  parseRelatorioVendasSemanal,
} from './blink-pdf-parsers'

describe('Blink PDF Parsers', () => {
  it('converte valores monetários brasileiros com "$" no final ou início e traços como zero', () => {
    expect(parseBlinkMonetaryValue('111.075,17$')).toBe(111075.17)
    expect(parseBlinkMonetaryValue('$ 3.823,08')).toBe(3823.08)
    expect(parseBlinkMonetaryValue('0,05')).toBe(0.05)
    expect(parseBlinkMonetaryValue('-')).toBe(0)
    expect(parseBlinkMonetaryValue('–')).toBe(0)
    expect(parseBlinkMonetaryValue('')).toBe(0)
  })

  it('normaliza nomes de carteira para padrão capitalizado', () => {
    expect(normalizeCarteiraName('AVES')).toBe('Aves')
    expect(normalizeCarteiraName('PETS')).toBe('Pets')
    expect(normalizeCarteiraName('RUMINANTES')).toBe('Ruminantes')
    expect(normalizeCarteiraName('SUÍNOS')).toBe('Suínos')
    expect(normalizeCarteiraName('SUINOS')).toBe('Suínos')
  })

  it('detecta os 3 tipos de relatório pelo texto ou nome do arquivo', () => {
    expect(
      detectBlinkReportType(
        'Pais Carteira Grupo Cliente Razao Social JANEIRO FEVEREIRO REALIZADO 2026',
        'Matriz de venda 11-09-26.pdf',
      ),
    ).toBe('matriz_venda')

    expect(
      detectBlinkReportType(
        'MÊS SETEMBRO OUTUBRO Pet Ruminantes Suinos Total Geral PEDIDOS EM CARTEIRA',
        'Pedidos em carteira 11-09-2026.pdf',
      ),
    ).toBe('pedidos_carteira')

    expect(
      detectBlinkReportType(
        'BLINK GERAL BR INDUSTRIA PREMIXEIRAS DISTRIBUIDORAS LATAM PLANEJADO REALIZADO RESULTADO SETEMBRO',
        'Relatório de vendas semanal 11-09-26.pdf',
      ),
    ).toBe('relatorio_vendas_semanal')
  })

  it('extrai linhas de cliente na Matriz de Venda sem duplicar totais', () => {
    const sampleText = `
Pais Carteira Grupo Cliente Razão Social JANEIRO FEVEREIRO MARÇO ABRIL MAIO JUNHO JULHO AGOSTO SETEMBRO
Brasil $111.075,17 $ 56.225,73 $ 173.748,59
AVES $ 3.823,08 $ 1.516,85
Indústrias $ 1.516,85
Alivet Saúde Animal Comércio de Alimentos Para Animais Ltda. $ 1.516,85 $ 280,10
Rodrigo Hisashi Ikeda E Outro3.823,08$
REALIZADO 2026
`
    const items = parseMatrizVenda(sampleText, 'Matriz de venda 11-09-26.pdf')
    expect(items.length).toBeGreaterThan(0)
    const alivetItems = items.filter((i) => i.cliente.includes('Alivet'))
    expect(alivetItems.length).toBe(2)
    expect(alivetItems[0].valor).toBe(1516.85)
    expect(alivetItems[0].ano).toBe(2026)

    const rodrigoItems = items.filter((i) => i.cliente.includes('Rodrigo Hisashi'))
    expect(rodrigoItems.length).toBe(1)
    expect(rodrigoItems[0].valor).toBe(3823.08)
  })

  it('extrai linhas de Pedidos em Carteira tratando virada de ano', () => {
    const sampleText = `
MÊS SETEMBRO OUTUBRO NOVEMBRO DEZEMBRO JANEIRO FEVEREIRO
Pet $ 6.825,80 $ 97.445,93
Special Dog $ 60.000,03 $ 60.000,00 $ 60.000,00
Suínos $ 30.228,01 $ 60.456,04
Alibem Alimentos S.A $ 30.228,01 $ 60.456,04 $ 60.456,03 $ 74.196,02 $ 60.456,02
Total Geral $ 57.084,41 $ 127.673,94
PEDIDOS EM CARTEIRA
`
    const items = parsePedidosCarteira(sampleText, 'Pedidos em carteira 11-09-2026.pdf')
    expect(items.length).toBeGreaterThan(0)
    const specialDog = items.filter((i) => i.cliente === 'Special Dog')
    expect(specialDog.length).toBe(3)

    const alibemJan = items.filter((i) => i.cliente.includes('Alibem') && i.mes === 'janeiro')
    if (alibemJan.length > 0) {
      expect(alibemJan[0].ano).toBe(2027)
    }
  })

  it('extrai metas e comparativos do Relatório Semanal preservando canal e vendedor', () => {
    const sampleText = `
BLINK GERAL BR INDUSTRIA PREMIXEIRAS DISTRIBUIDORAS LATAM
TOTAL
PLANEJADO 551.711,89 $ $ 143.680,28 331.518,87 $ 66.303,77 $ 121.534,82 $ 220.193,01 $
REALIZADO $ 96.908,28 96.908,28 $ 96.908,28 $ - $ - $ - $
Rodrigo Garginal Ruminantes
PLANEJADO $ 99.952,53 145.791,37 $ 43.319,43 $ 19.990,51 $ 36.642,60 $ 45.838,83 $
REALIZADO $ 722,20 722,20 $ 722,20 $
RESULTADO SETEMBRO
`
    const items = parseRelatorioVendasSemanal(
      sampleText,
      'Relatório de vendas semanal 11-09-26.pdf',
    )
    expect(items.length).toBeGreaterThan(0)
    const totalItem = items.find((i) => i.dimensao_tipo === 'geral' && i.canal === 'BLINK')
    expect(totalItem).toBeDefined()
    expect(totalItem?.planejado).toBeGreaterThan(0)

    const rodrigoItem = items.find(
      (i) => i.dimensao_tipo === 'vendedor' && i.carteira === 'Ruminantes',
    )
    expect(rodrigoItem).toBeDefined()
    expect(rodrigoItem?.vendedor_nome).toBe('Rodrigo Gardinal')
  })
})
