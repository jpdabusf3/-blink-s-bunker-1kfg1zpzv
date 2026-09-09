export type FunilVendasStatus = 'Ativo' | 'Inativo' | 'Negociações Encerradas'

export const FUNNEL_STAGES_PERMITIDOS = new Set(['Fechamento', 'Pós-venda', 'Perda'])

export type FunnelCategory = 'Ativos' | 'Prospectos' | 'Inativos' | 'Negociação encerrada'

export const FUNNEL_CATEGORY_OPTIONS: readonly FunnelCategory[] = [
  'Ativos',
  'Prospectos',
  'Inativos',
  'Negociação encerrada',
] as const

export const FUNNEL_CATEGORY_COLORS: Record<FunnelCategory, string> = {
  Ativos: '#2563eb', // Azul
  Prospectos: '#16a34a', // Verde
  Inativos: '#eab308', // Amarelo
  'Negociação encerrada': '#dc2626', // Vermelho
}

export const FUNNEL_CATEGORY_BORDER_COLORS: Record<FunnelCategory, string> = {
  Ativos: '#1d4ed8',
  Prospectos: '#15803d',
  Inativos: '#ca8a04',
  'Negociação encerrada': '#b91c1c',
}

const STAGES_PROSPECCAO = new Set([
  'Lead',
  'Primeiro Contato',
  'Diagnóstico Técnico',
  'Apresentação',
  'Teste/Trial',
  'Proposta',
  'Negociação',
])

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

/**
 * Classificação unificada da categoria do funil de vendas para clientes.
 * Regras:
 * - Fechamento -> Ativos
 * - Pós-venda -> Inativos se ultimo_pedido > 180 dias; senão Ativos
 * - Perda -> Negociação encerrada
 * - Estágios iniciais (Lead, Primeiro Contato, Diagnóstico Técnico, Apresentação, Teste/Trial, Proposta, Negociação) -> Prospectos
 * - Fallbacks: se status_funil estiver preenchido ('Ativo' -> Ativos, 'Inativo' -> Inativos, 'Negociações Encerradas' -> Negociação encerrada);
 *   se status do cliente contiver 'Prospeção' -> Prospectos;
 *   caso contrário -> Prospectos.
 */
export function getFunnelCategory(factory: {
  funnelStage?: string | null
  ultimo_pedido?: string | null
  status_funil?: string | null
  status?: string | string[] | null
}): FunnelCategory {
  const stage = (factory.funnelStage || '').trim()

  if (stage === 'Fechamento') {
    return 'Ativos'
  }

  if (stage === 'Perda') {
    return 'Negociação encerrada'
  }

  if (stage === 'Pós-venda') {
    if (factory.ultimo_pedido) {
      const dataPedido = new Date(factory.ultimo_pedido)
      if (!isNaN(dataPedido.getTime())) {
        const hoje = new Date()
        const diffMs = hoje.getTime() - dataPedido.getTime()
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        if (diffDias > 180) {
          return 'Inativos'
        }
      }
    }
    return 'Ativos'
  }

  if (stage && STAGES_PROSPECCAO.has(stage)) {
    return 'Prospectos'
  }

  // Fallback por status_funil se preenchido
  if (factory.status_funil) {
    const sf = factory.status_funil.trim().toLowerCase()
    if (sf === 'ativo' || sf === 'ativos') return 'Ativos'
    if (sf === 'inativo' || sf === 'inativos') return 'Inativos'
    if (sf.includes('encerrad') || sf.includes('perda')) return 'Negociação encerrada'
  }

  // Fallback por campo status do banco (tratando lista ou texto)
  const statusArray: string[] = Array.isArray(factory.status)
    ? factory.status
    : typeof factory.status === 'string'
      ? factory.status.includes(',')
        ? factory.status.split(',').map((s) => s.trim())
        : [factory.status.trim()]
      : []

  if (
    statusArray.some(
      (s) => s.toLowerCase().includes('prospec') || s.toLowerCase().includes('prospeção'),
    )
  ) {
    return 'Prospectos'
  }
  if (statusArray.some((s) => s.toLowerCase() === 'atendido')) {
    return 'Ativos'
  }
  if (
    statusArray.some(
      (s) => s.toLowerCase().includes('não atendido') || s.toLowerCase().includes('inativo'),
    )
  ) {
    return 'Inativos'
  }

  return 'Prospectos'
}

export const STATUS_TO_FUNNEL_STAGE: Record<
  FunilVendasStatus,
  'Fechamento' | 'Pós-venda' | 'Perda'
> = {
  Ativo: 'Fechamento',
  Inativo: 'Pós-venda',
  'Negociações Encerradas': 'Perda',
}
