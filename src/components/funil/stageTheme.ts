import type { FunnelStage } from '@/types'

/**
 * Identidade visual dos 10 estágios do funil.
 * Apenas apresentação: nenhum nome, ordem ou lógica de estágio é alterado —
 * cada estágio ganha um tom dourado distinguível na borda superior da coluna,
 * um pequeno dot no cabeçalho e um anel sutil no card.
 * Tons derivados do dourado primário (#E5B64E), mais escuros nos estágios
 * iniciais (descoberta) e mais claros/saturados em Fechamento.
 */
export const STAGE_THEME: Record<
  FunnelStage,
  { topBar: string; dot: string; cardRing: string; dropBg: string }
> = {
  Lead: {
    topBar: 'bg-zinc-600/70',
    dot: 'bg-zinc-500',
    cardRing: 'ring-zinc-500/20',
    dropBg: 'bg-zinc-500/10',
  },
  'Primeiro Contato': {
    topBar: 'bg-slate-500/70',
    dot: 'bg-slate-400',
    cardRing: 'ring-slate-400/20',
    dropBg: 'bg-slate-400/10',
  },
  'Diagnóstico Técnico': {
    topBar: 'bg-stone-500/70',
    dot: 'bg-stone-400',
    cardRing: 'ring-stone-400/20',
    dropBg: 'bg-stone-400/10',
  },
  Apresentação: {
    topBar: 'bg-amber-700/60',
    dot: 'bg-amber-600',
    cardRing: 'ring-amber-600/25',
    dropBg: 'bg-amber-600/10',
  },
  'Teste/Trial': {
    topBar: 'bg-amber-600/60',
    dot: 'bg-amber-500',
    cardRing: 'ring-amber-500/25',
    dropBg: 'bg-amber-500/10',
  },
  Proposta: {
    topBar: 'bg-yellow-600/60',
    dot: 'bg-yellow-500',
    cardRing: 'ring-yellow-500/25',
    dropBg: 'bg-yellow-500/10',
  },
  Negociação: {
    topBar: 'bg-[#E5B64E]/55',
    dot: 'bg-[#E5B64E]',
    cardRing: 'ring-[#E5B64E]/30',
    dropBg: 'bg-[#E5B64E]/10',
  },
  Fechamento: {
    topBar: 'bg-emerald-600/60',
    dot: 'bg-emerald-400',
    cardRing: 'ring-emerald-400/30',
    dropBg: 'bg-emerald-400/10',
  },
  'Pós-venda': {
    topBar: 'bg-sky-600/60',
    dot: 'bg-sky-400',
    cardRing: 'ring-sky-400/30',
    dropBg: 'bg-sky-400/10',
  },
  Perda: {
    topBar: 'bg-red-700/60',
    dot: 'bg-red-500',
    cardRing: 'ring-red-500/25',
    dropBg: 'bg-red-500/10',
  },
}

export function getStageTheme(stage: string) {
  return STAGE_THEME[stage as FunnelStage] ?? STAGE_THEME.Lead
}
