// pocketbase/hooks/_familia_utils.js
// Mapeamento e resolução centralizada de famílias de produtos Blink Biotech.
// Código fornecido pelo usuário (ordem: prefixo do código -> código de família -> bruto -> '—')

var FAMILIA_MAP = {
  'MI.OR': 'Minerais Orgânicos',
  'MY.CO': 'Adsorventes',
  'MY.ST': 'Ingredientes',
  'MO.BE': 'Prebióticos',
  'MI.XS': 'Blends',
}

var PREFIXO_FAMILIA = {
  'BPMI.OR': 'Minerais Orgânicos',
  'BBMY.CO': 'Adsorventes',
  'BPMY.CO': 'Adsorventes',
  'BPMY.ST': 'Ingredientes',
  'BBMO.BE': 'Prebióticos',
  'BPMO.BE': 'Prebióticos',
  'BBMI.XS': 'Blends',
  'BPMI.XS': 'Blends',
}

function familiaCompleta(codigoProduto, familiaBruta) {
  var cod = String(codigoProduto || '')
    .trim()
    .toUpperCase()
  // 1) Tenta o prefixo do código do produto (mais confiável)
  for (var prefixo in PREFIXO_FAMILIA) {
    if (Object.prototype.hasOwnProperty.call(PREFIXO_FAMILIA, prefixo)) {
      if (cod.indexOf(prefixo) === 0) {
        return PREFIXO_FAMILIA[prefixo]
      }
    }
  }
  // 2) Tenta o código de família do export
  var bruta = String(familiaBruta || '')
    .trim()
    .toUpperCase()
  if (FAMILIA_MAP[bruta]) {
    return FAMILIA_MAP[bruta]
  }
  // 3) Fallback: devolve o valor bruto
  return familiaBruta || '—'
}
