export type FunilVendasStatus = 'Ativo' | 'Inativo' | 'Negociações Encerradas'

export const FUNNEL_STAGES_PERMITIDOS = new Set(['Fechamento', 'Pós-venda', 'Perda'])

export function deriveFunilVendasStatus(
  funnelStage: string | undefined,
  ultimoPedido?: string | null,
): FunilVendasStatus | null {
  if (!funnelStage || !FUNNEL_STAGES_PERMITIDOS.has(funnelStage)) {
    return null
  }

  if (funnelStage === 'Fechamento') {
    return 'Ativo'
  }

  if (funnelStage === 'Perda') {
    return 'Negociações Encerradas'
  }

  // funnelStage === 'Pós-venda'
  if (ultimoPedido) {
    const dataPedido = new Date(ultimoPedido)
    if (!isNaN(dataPedido.getTime())) {
      const hoje = new Date()
      const diffMs = hoje.getTime() - dataPedido.getTime()
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDias > 180) {
        return 'Inativo'
      }
    }
  }

  return 'Ativo'
}

export const STATUS_TO_FUNNEL_STAGE: Record<
  FunilVendasStatus,
  'Fechamento' | 'Pós-venda' | 'Perda'
> = {
  Ativo: 'Fechamento',
  Inativo: 'Pós-venda',
  'Negociações Encerradas': 'Perda',
}
