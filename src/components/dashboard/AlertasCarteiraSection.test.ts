import { describe, it, expect } from 'vitest'
import { computePortfolioAlerts } from './AlertasCarteiraSection'
import type { PedidoCarteira } from '@/services/pedidos-carteira'

describe('computePortfolioAlerts', () => {
  it('gera alerta crítico para mês vazio (Regra C)', () => {
    const pedidos: PedidoCarteira[] = [
      {
        id: '1',
        marca: 'Special Dog',
        mes: 'setembro',
        valor: 50000,
        total_geral: 50000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
    ]

    const result = computePortfolioAlerts({
      pedidosCarteira: pedidos,
      currentYear: 2026,
      currentMonth: 9, // setembro
      windowMonths: 3, // set, out, nov
    })

    // Outubro e Novembro devem gerar alerta crítico
    const criticos = result.alerts.filter((a) => a.severity === 'critical')
    expect(criticos.length).toBe(2)
    expect(criticos[0].message).toContain('Nenhum pedido em carteira para')
  })

  it('gera alerta de risco para concentração de cliente > 80% (Regra B)', () => {
    const pedidos: PedidoCarteira[] = [
      {
        id: '1',
        marca: 'Mega Cliente S/A',
        mes: 'setembro',
        valor: 90000,
        total_geral: 90000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
      {
        id: '2',
        marca: 'Cliente Pequeno',
        mes: 'setembro',
        valor: 10000,
        total_geral: 10000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
    ]

    const result = computePortfolioAlerts({
      pedidosCarteira: pedidos,
      currentYear: 2026,
      currentMonth: 9,
      windowMonths: 1,
    })

    const riscos = result.alerts.filter((a) => a.severity === 'risk')
    expect(riscos.length).toBe(1)
    expect(riscos[0].message).toContain('Mega Cliente S/A')
    expect(riscos[0].message).toContain('90%')
  })

  it('gera alerta de warning para queda projetada < 70% da média (Regra A)', () => {
    // 3 meses:
    // M1: 100.000
    // M2: 100.000
    // M3: 30.000 (média dos outros = 100.000; 30.000 < 70.000 -> queda de 70%)
    const pedidos: PedidoCarteira[] = [
      {
        id: '1',
        marca: 'A',
        mes: 'setembro',
        valor: 100000,
        total_geral: 100000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
      {
        id: '2',
        marca: 'B',
        mes: 'outubro',
        valor: 100000,
        total_geral: 100000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
      {
        id: '3',
        marca: 'C',
        mes: 'novembro',
        valor: 30000,
        total_geral: 30000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
    ]

    const result = computePortfolioAlerts({
      pedidosCarteira: pedidos,
      currentYear: 2026,
      currentMonth: 9,
      windowMonths: 3,
    })

    const warnings = result.alerts.filter((a) => a.severity === 'warning')
    expect(warnings.length).toBe(1)
    expect(warnings[0].message).toContain('Novembro')
    expect(warnings[0].message).toContain(
      'queda de 70% versus a media da carteira'.replace('media', 'média'),
    )
  })

  it('ordena por severidade: critical > risk > warning', () => {
    // Cenário com os 3 tipos
    const pedidos: PedidoCarteira[] = [
      {
        id: '1',
        marca: 'Dominante',
        mes: 'setembro',
        valor: 85000,
        total_geral: 85000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
      {
        id: '2',
        marca: 'Outro',
        mes: 'outubro',
        valor: 15000,
        total_geral: 15000,
        atualizado_em: '2026-08-01',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
      // M3 novembro vazio -> critical
    ]

    const result = computePortfolioAlerts({
      pedidosCarteira: pedidos,
      currentYear: 2026,
      currentMonth: 9,
      windowMonths: 3,
    })

    expect(result.alerts.length).toBeGreaterThanOrEqual(2)
    expect(result.alerts[0].severity).toBe('critical')
  })
})
