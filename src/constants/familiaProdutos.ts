// Mapeamento centralizado de famílias de produtos Blink Biotech
// Usado em importações, relatórios e exibições para converter códigos brutos em nomes completos

// FAMILIA_MAP — formato real do export (familia_de_produtos)
export const FAMILIA_MAP: Record<string, string> = {
  'MI.OR': 'Minerais Orgânicos',
  'MY.CO': 'Adsorventes',
  'MY.ST': 'Ingredientes',
  'MO.BE': 'Prebióticos',
  'MI.XS': 'Blends',
}

// Fallback por prefixo do código do produto (cobre variações do export)
export const PREFIXO_FAMILIA: Record<string, string> = {
  'BPMI.OR': 'Minerais Orgânicos',
  'BBMY.CO': 'Adsorventes',
  'BPMY.CO': 'Adsorventes',
  'BPMY.ST': 'Ingredientes',
  'BBMO.BE': 'Prebióticos',
  'BPMO.BE': 'Prebióticos',
  'BBMI.XS': 'Blends',
  'BPMI.XS': 'Blends',
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
  // 2) Tenta o código de família do export
  const bruta = String(familiaBruta || '')
    .trim()
    .toUpperCase()
  if (FAMILIA_MAP[bruta]) return FAMILIA_MAP[bruta]
  // 3) Fallback: devolve o valor bruto ou '—'
  return familiaBruta?.trim() || '—'
}
