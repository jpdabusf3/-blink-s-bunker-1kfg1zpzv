// Mapeamento centralizado de famílias de produtos Blink Biotech
// Usado em importações, relatórios e exibições para converter códigos brutos em nomes completos

// FAMILIA_MAP — formato do export (familia_de_produtos) e códigos canônicos
export const FAMILIA_MAP: Record<string, string> = {
  // Códigos pontuados do export
  'MI.OR': 'Minerais Orgânicos',
  'MY.CO': 'Mycolink',
  'MY.ST': 'Leveduras',
  'MO.BE': 'Mos/BetaLink',
  'MI.XS': 'Blends',
  // Novos códigos canônicos com traço
  'MI-OR': 'Minerais Orgânicos',
  'MY-CO': 'Mycolink',
  'MY-ST': 'Leveduras',
  'MO-BE': 'Mos/BetaLink',
  'MI-XS': 'Blends',
  // Legados para compatibilidade
  Adsorventes: 'Mycolink',
  Aditivos: 'Mos/BetaLink',
  'Minerais Organicos': 'Minerais Orgânicos',
  Suplementos: 'Leveduras',
  Prebióticos: 'Mos/BetaLink',
  Ingredientes: 'Leveduras',
}

// Mapeamento por código canônico para rótulo oficial
export const CODIGO_CANONICO_ROTULO: Record<string, string> = {
  'MI-XS': 'Blends',
  'MO-BE': 'Mos/BetaLink',
  'MY-CO': 'Mycolink',
  'MI-OR': 'Minerais Orgânicos',
  'MY-ST': 'Leveduras',
}

/**
 * Converte o nome ou código de família recebido para o código canônico Blink:
 * MI-XS (Blends), MO-BE (Mos/BetaLink), MY-CO (Mycolink), MI-OR (Minerais Orgânicos), MY-ST (Leveduras)
 */
export function mapearFamiliaParaCodigoCanonico(
  codigoProduto?: string | null,
  familiaBruta?: string | null,
): string {
  const cod = String(codigoProduto || '')
    .trim()
    .toUpperCase()
  // 1) Pelo prefixo do código do produto (ex: BPMI.OR035 -> MI-OR)
  for (const [prefixo, codCanonico] of Object.entries(PREFIXO_CODIGO_CANONICO)) {
    if (cod.startsWith(prefixo)) return codCanonico
  }

  const bruta = String(familiaBruta || '').trim()
  if (!bruta) return ''

  const upper = bruta.toUpperCase()
  if (['MI-OR', 'MI-XS', 'MO-BE', 'MY-CO', 'MY-ST'].includes(upper)) {
    return upper
  }
  if (upper === 'MI.OR') return 'MI-OR'
  if (upper === 'MI.XS') return 'MI-XS'
  if (upper === 'MO.BE') return 'MO-BE'
  if (upper === 'MY.CO') return 'MY-CO'
  if (upper === 'MY.ST') return 'MY-ST'

  const norm = upper
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')

  if (
    norm.includes('MINERAISORGANICOS') ||
    norm.includes('MINERALORGANICO') ||
    norm.includes('MIOR')
  ) {
    return 'MI-OR'
  }
  if (norm.includes('MIXIS') || norm.includes('MIX') || norm.includes('BLEND')) {
    return 'MI-XS'
  }
  if (
    norm.includes('MOSBETALINK') ||
    norm.includes('BETALINK') ||
    norm.includes('MOBE') ||
    norm.includes('MOS')
  ) {
    return 'MO-BE'
  }
  if (
    norm.includes('MYCOLINK') ||
    norm.includes('MICOLINK') ||
    norm.includes('MYCO') ||
    norm.includes('ADSORVENT')
  ) {
    return 'MY-CO'
  }
  if (norm.includes('LEVEDURA') || norm.includes('MYST') || norm.includes('YEAST')) {
    return 'MY-ST'
  }

  return bruta
}

// Prefixo do código do produto para o código canônico
export const PREFIXO_CODIGO_CANONICO: Record<string, string> = {
  'BBMI.XS': 'MI-XS',
  'BPMI.XS': 'MI-XS',
  'BBMO.BE': 'MO-BE',
  'BPMO.BE': 'MO-BE',
  'BBMY.CO': 'MY-CO',
  'BPMY.CO': 'MY-CO',
  'BPMI.OR': 'MI-OR',
  'BBMI.OR': 'MI-OR',
  'BPMY.ST': 'MY-ST',
  'BBMY.ST': 'MY-ST',
}

// Fallback por prefixo do código do produto (cobre variações do export)
export const PREFIXO_FAMILIA: Record<string, string> = {
  'BBMI.XS': 'Blends',
  'BPMI.XS': 'Blends',
  'BBMO.BE': 'Mos/BetaLink',
  'BPMO.BE': 'Mos/BetaLink',
  'BBMY.CO': 'Mycolink',
  'BPMY.CO': 'Mycolink',
  'BPMI.OR': 'Minerais Orgânicos',
  'BBMI.OR': 'Minerais Orgânicos',
  'BPMY.ST': 'Leveduras',
  'BBMY.ST': 'Leveduras',
}

/**
 * Ordem de resolução obrigatória:
 * 1) prefixo do código do produto (mais confiável)
 * 2) código de família do export
 * 3) valor bruto
 * 4) '—'
 */
export function familiaCompleta(
  codigoProduto?: string | null,
  familiaBruta?: string | null,
): string {
  const cod = String(codigoProduto || '')
    .trim()
    .toUpperCase()
  // 1) Tenta o prefixo do código do produto (mais confiável)
  for (const [prefixo, nome] of Object.entries(PREFIXO_FAMILIA)) {
    if (cod.startsWith(prefixo)) return nome
  }
  // 2) Tenta o código de família do export ou código canônico
  const bruta = String(familiaBruta || '')
    .trim()
    .toUpperCase()
  if (FAMILIA_MAP[bruta]) return FAMILIA_MAP[bruta]
  // 3) Verifica no dicionário exato
  for (const [key, val] of Object.entries(FAMILIA_MAP)) {
    if (key.toUpperCase() === bruta) return val
  }
  // 4) Fallback: devolve o valor bruto se válido ou 'Não identificado'
  const fallback = String(familiaBruta || '').trim()
  if (!fallback || fallback === '—' || fallback === '-' || fallback === '?') {
    return 'Não identificado'
  }
  return fallback
}
