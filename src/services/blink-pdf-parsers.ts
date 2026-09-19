/**
 * Parser especializado para os 3 novos tipos de relatório PDF oficiais da Blink Biotech:
 * 1. "Matriz de venda" (ex.: "Matriz de venda 11-09-26.pdf")
 * 2. "Pedidos em carteira" (ex.: "Pedidos em carteira 11-09-2026.pdf")
 * 3. "Relatório de vendas semanal" (ex.: "Relatório de vendas semanal 11-09-26.pdf")
 */

export interface MatrizVendaItem {
  pais: string
  carteira: string
  grupo_cliente: string
  cliente: string // Razão Social bruta
  mes: string // Nome do mês normalizado (ex.: janeiro, fevereiro...)
  ano: number // Ano derivado do rodapé "REALIZADO AAAA" ou do nome do arquivo
  valor: number // Valor mensal em R$
}

export interface PedidoCarteiraItem {
  cliente: string
  segmento: string // Pet, Ruminantes, Suínos
  mes: string // setembro, outubro, etc.
  ano: number // Ano ajustado com virada de ano (ex.: dez/2026 -> jan/2027)
  valor: number
}

export interface RelatorioSemanalMetaItem {
  periodo_rotulo: string // "RESULTADO SETEMBRO", "RESULTADO Q3", "RESULTADO YTD"
  periodo: string // "2026-09", "2026-Q3", "2026-YTD"
  ano: number
  tipo_bloco: 'semana' | 'trimestre' | 'ytd'
  dimensao_tipo: 'geral' | 'vendedor' | 'novos_clientes'
  canal: string // "BLINK", "BR", "INDUSTRIA", "PREMIXEIRAS", "DISTRIBUIDORAS", "LATAM"
  vendedor_nome?: string
  carteira?: string
  planejado: number
  realizado: number
  atingimento_pct?: number
}

export interface AtendimentoPedidoItem {
  numeroPedido: string
  cliente: string
  envio: 'FOB' | 'CIF' | string
  dataSolicitada?: string // YYYY-MM-DD ou vazio
  dataSolicitadaRaw?: string
  entregaConfirmada?: string // YYYY-MM-DD ou vazio
  entregaConfirmadaRaw?: string
  observacoes: string
  dataAmbigua?: boolean
  clienteResolvidoId?: string
  clienteResolvidoNome?: string
}

const MESES_NOMES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]

const MESES_MAP_NORM: Record<string, string> = {
  janeiro: 'janeiro',
  jan: 'janeiro',
  fevereiro: 'fevereiro',
  fev: 'fevereiro',
  março: 'março',
  marco: 'março',
  mar: 'março',
  abril: 'abril',
  abr: 'abril',
  maio: 'maio',
  mai: 'maio',
  junho: 'junho',
  jun: 'junho',
  julho: 'julho',
  jul: 'julho',
  agosto: 'agosto',
  ago: 'agosto',
  setembro: 'setembro',
  set: 'setembro',
  outubro: 'outubro',
  out: 'outubro',
  novembro: 'novembro',
  nov: 'novembro',
  dezembro: 'dezembro',
  dez: 'dezembro',
}

const MESES_ORDEM: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

/**
 * Normaliza nome de carteira para padrão capitalizado (ex.: AVES -> Aves, PETS -> Pets)
 */
export function normalizeCarteiraName(raw: string): string {
  const clean = (raw || '').trim().toUpperCase()
  if (clean.includes('AVE')) return 'Aves'
  if (clean.includes('PET')) return 'Pets'
  if (clean.includes('RUMINANTE')) return 'Ruminantes'
  if (clean.includes('SUÍNO') || clean.includes('SUINO')) return 'Suínos'
  if (clean.includes('AQUA')) return 'Aqua'
  if (clean.includes('EQUINO')) return 'Equinos'
  return raw.trim()
}

/**
 * Converte valor em formato monetário brasileiro com "$" no final (ou início)
 * Ex.: "111.075,17$" -> 111075.17
 * Ex.: "$ 3.823,08" -> 3823.08
 * Ex.: "-" ou "" -> 0
 */
export function parseBlinkMonetaryValue(val: unknown): number {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val

  let s = String(val).trim()
  if (!s || s === '-' || s === '–' || s === '—') return 0

  // Remover R$, $, US$, etc.
  s = s.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, ' ')
  s = s.replace(/(?:R\$|US\$|U\$|\$|BRL|USD)/gi, '').trim()
  s = s.replace(/\s+/g, '')

  if (!s || s === '-' || s === '–' || s === '—') return 0

  // Tratar padrões brasileiros: 111.075,17 -> 111075.17
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    s = s.replace(',', '.')
  }

  const cleanNum = s.replace(/[^\d.-]/g, '')
  if (!cleanNum || cleanNum === '-' || cleanNum === '.') return 0
  const n = parseFloat(cleanNum)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

/**
 * Extrai data/ano do nome do arquivo
 * Ex.: "Matriz de venda 11-09-26.pdf" -> ano 2026, mes 9
 * Ex.: "Pedidos em carteira 11-09-2026.pdf" -> ano 2026, mes 9
 */
export function extractDateFromFileName(fileName: string): { ano: number; mes: number } {
  const now = new Date()
  let ano = now.getFullYear()
  let mes = now.getMonth() + 1

  if (!fileName) return { ano, mes }

  // Procura padrão DD-MM-YYYY ou DD-MM-YY
  const matchFull = fileName.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{2,4})/)
  if (matchFull) {
    const m = parseInt(matchFull[2], 10)
    let y = parseInt(matchFull[3], 10)
    if (y < 100) y += 2000
    if (m >= 1 && m <= 12) mes = m
    if (y >= 2000 && y <= 2100) ano = y
  }

  return { ano, mes }
}

/**
 * Identifica o tipo do documento entre os 3 novos tipos de relatório ou unknown
 */
export function detectBlinkReportType(
  text: string,
  fileName: string = '',
):
  | 'matriz_venda'
  | 'pedidos_carteira'
  | 'relatorio_vendas_semanal'
  | 'atendimento_pedidos'
  | 'unknown' {
  const lowerText = (text || '').toLowerCase()
  const lowerFileName = (fileName || '').toLowerCase()

  // 0. Atendimento a pedidos (carteira):
  // Título "Atendimento a pedidos" ou colunas Nº Pedido, Cliente, Envio, Data Solicitada, Entrega Confirmada
  const hasAtendimentoName =
    lowerFileName.includes('atendimento') ||
    lowerFileName.includes('status de pedido') ||
    (lowerFileName.includes('pedido') && lowerFileName.includes('setembro'))
  const hasAtendimentoTitle =
    lowerText.includes('atendimento a pedidos') ||
    lowerText.includes('atendimento pedidos') ||
    lowerText.includes('atendimento de pedidos')
  const hasAtendimentoColumns =
    (lowerText.includes('pedido') ||
      lowerText.includes('nº pedido') ||
      lowerText.includes('no pedido')) &&
    lowerText.includes('cliente') &&
    (lowerText.includes('envio') || lowerText.includes('fob') || lowerText.includes('cif')) &&
    (lowerText.includes('data solicitada') ||
      lowerText.includes('entrega confirmada') ||
      lowerText.includes('solicitada'))

  if (
    hasAtendimentoTitle ||
    hasAtendimentoColumns ||
    (hasAtendimentoName && (lowerText.includes('fob') || lowerText.includes('cif')))
  ) {
    return 'atendimento_pedidos'
  }

  // 1. Matriz de venda:
  // Rodapé "REALIZADO <ano>" + colunas de meses por extenso, e/ou nome do arquivo
  const hasMatrizName =
    lowerFileName.includes('matriz') &&
    (lowerFileName.includes('venda') || lowerFileName.includes('vendas'))
  const hasRealizadoAno = /realizado\s+20\d{2}/i.test(text)
  const hasMatrizHeader =
    lowerText.includes('pais') &&
    lowerText.includes('carteira') &&
    (lowerText.includes('grupo') || lowerText.includes('cliente')) &&
    (lowerText.includes('janeiro') || lowerText.includes('fevereiro'))

  if (hasMatrizName || (hasRealizadoAno && hasMatrizHeader)) {
    return 'matriz_venda'
  }

  // 2. Pedidos em carteira:
  // "PEDIDOS EM CARTEIRA" no cabeçalho ou rodapé, janela de 6 meses
  const hasPedidosName =
    lowerFileName.includes('pedidos') &&
    (lowerFileName.includes('carteira') || lowerFileName.includes('em carteira'))
  const hasPedidosText =
    lowerText.includes('pedidos em carteira') ||
    (lowerText.includes('total geral') &&
      (lowerText.includes('pet') ||
        lowerText.includes('ruminantes') ||
        lowerText.includes('suinos')) &&
      lowerText.includes('mês'))

  if (hasPedidosName || hasPedidosText) {
    return 'pedidos_carteira'
  }

  // 3. Relatório de vendas semanal:
  // "BLINK GERAL", "PLANEJADO", "REALIZADO", "RESULTADO SETEMBRO", "RESULTADO Q3", "NOVOS CLIENTES"
  const hasSemanalName =
    lowerFileName.includes('relatorio') &&
    lowerFileName.includes('vendas') &&
    (lowerFileName.includes('semanal') || lowerFileName.includes('semana'))
  const hasSemanalText =
    (lowerText.includes('blink geral') || lowerText.includes('geral br')) &&
    lowerText.includes('planejado') &&
    lowerText.includes('realizado') &&
    (lowerText.includes('resultado') || lowerText.includes('novos clientes'))

  if (hasSemanalName || hasSemanalText) {
    return 'relatorio_vendas_semanal'
  }

  return 'unknown'
}

/**
 * PARSER 1: MATRIZ DE VENDA
 * Extrai apenas linhas de clientes (ignorando consolidados de País, Carteira e Grupo)
 */
export function parseMatrizVenda(text: string, fileName: string = ''): MatrizVendaItem[] {
  const items: MatrizVendaItem[] = []
  const { ano: fallbackAno } = extractDateFromFileName(fileName)

  // Descobrir o ano do relatório do rodapé "REALIZADO 2026"
  let anoRelatorio = fallbackAno
  const anoMatch = text.match(/REALIZADO\s+(20\d{2})/i)
  if (anoMatch) {
    anoRelatorio = parseInt(anoMatch[1], 10)
  }

  // Identificar os meses presentes no cabeçalho
  // ex.: JANEIRO FEVEREIRO MARÇO ABRIL MAIO JUNHO JULHO AGOSTO SETEMBRO
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let activeMonths: string[] = []
  for (const line of lines) {
    const upperLine = line.toUpperCase()
    const foundMonths: string[] = []
    for (const m of MESES_NOMES) {
      if (upperLine.includes(m)) {
        foundMonths.push(m)
      }
    }
    if (foundMonths.length >= 3) {
      // Ordenar na ordem em que aparecem na linha
      activeMonths = foundMonths.sort((a, b) => upperLine.indexOf(a) - upperLine.indexOf(b))
      break
    }
  }

  if (activeMonths.length === 0) {
    // Default primeiros 9 meses como no exemplo (Jan a Set)
    activeMonths = MESES_NOMES.slice(0, 9)
  }

  // Hierarquia ativa enquanto percorre as linhas
  let currentPais = 'Brasil'
  let currentCarteira = 'Aves'
  let currentGrupo = 'Indústrias'

  const KNOWN_PAISES = [
    'Brasil',
    'Paraguai',
    'Uruguai',
    'Argentina',
    'Chile',
    'Bolívia',
    'Colômbia',
  ]
  const KNOWN_CARTEIRAS = ['AVES', 'PETS', 'RUMINANTES', 'SUÍNOS', 'SUINOS', 'AQUA', 'EQUINOS']
  const KNOWN_GRUPOS = [
    'Indústrias',
    'Industrias',
    'Premixeras',
    'Premixeiras',
    'Produtores Diretos',
    'Distribuidores Diretos',
    'Cooperativas',
  ]

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const lineTrim = rawLine.trim()

    // Ignorar rodapés ou cabeçalhos
    if (
      lineTrim.toUpperCase().startsWith('REALIZADO') ||
      lineTrim.toUpperCase().startsWith('PAIS') ||
      lineTrim.toUpperCase().startsWith('CARTEIRA')
    ) {
      continue
    }

    // 1. Verificar se é linha de País
    let isPaisLine = false
    for (const p of KNOWN_PAISES) {
      if (lineTrim.startsWith(p)) {
        currentPais = p
        isPaisLine = true
        break
      }
    }
    if (isPaisLine) {
      // Linha de total do País: não gravar como cliente
      continue
    }

    // 2. Verificar se é linha de Carteira
    let isCarteiraLine = false
    for (const c of KNOWN_CARTEIRAS) {
      if (lineTrim.startsWith(c)) {
        currentCarteira = normalizeCarteiraName(c)
        isCarteiraLine = true
        break
      }
    }
    if (isCarteiraLine) {
      // Linha de total da Carteira: não gravar
      continue
    }

    // 3. Verificar se é linha de Grupo
    let isGrupoLine = false
    for (const g of KNOWN_GRUPOS) {
      if (lineTrim.startsWith(g)) {
        currentGrupo = g
        isGrupoLine = true
        break
      }
    }
    if (isGrupoLine) {
      // Linha de total do Grupo: não gravar
      continue
    }

    // 4. É linha de Cliente (Razão Social + Valores)
    // Exemplo: "Alivet Saúde Animal Comércio de Alimentos Para Animais Ltda. $ 1.516,85 $ 280,10"
    // Exemplo com nome colado: "Rodrigo Hisashi Ikeda E Outro3.823,08$" ou "Belas Aves Comercio De Cereais Ltda$ 695,69"
    // Regex para extrair valores monetários:
    // Padrão 1: (\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}\$?)
    // Tratar colagem de nome no valor (ex: Outro3.823,08$ -> Outro + 3.823,08$)
    let lineFixed = lineTrim.replace(/([a-zA-ZÀ-ÿ])(\d{1,3}(?:\.\d{3})*,\d{2}\$?)/g, '$1 $2')
    lineFixed = lineFixed.replace(/([a-zA-ZÀ-ÿ])\$(\d)/g, '$1 $ $2')

    // Extrair todos os valores da linha
    const valueRegex = /(?:\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\$?/g
    const matches: Array<{ str: string; num: number; index: number }> = []
    let m: RegExpExecArray | null

    while ((m = valueRegex.exec(lineFixed)) !== null) {
      const parsedVal = parseBlinkMonetaryValue(m[1])
      if (parsedVal > 0) {
        matches.push({
          str: m[0],
          num: parsedVal,
          index: m.index,
        })
      }
    }

    if (matches.length === 0) {
      continue
    }

    // O nome do cliente é o texto antes do primeiro valor monetário
    const firstMatchIndex = matches[0].index
    let clienteNome = lineFixed.substring(0, firstMatchIndex).trim()
    // Limpar possíveis cifrões ou traços do fim do nome
    clienteNome = clienteNome.replace(/[$\-:]+$/, '').trim()

    // Se o nome do cliente for curto demais ou for um dos totais conhecidos, pular
    if (
      clienteNome.length < 3 ||
      KNOWN_CARTEIRAS.some((k) => clienteNome.toUpperCase().startsWith(k)) ||
      KNOWN_GRUPOS.some((k) => clienteNome.toLowerCase().startsWith(k.toLowerCase()))
    ) {
      continue
    }

    // Mapear os valores encontrados para os meses correspondentes.
    // Na Matriz de Venda, se o cliente teve vendas em meses esparsos,
    // o PDF contém posições ou os valores aparecem sequencialmente.
    // Para associar com máxima precisão: se matches.length === 1, atribuir ao mês mais próximo
    // ou dividir igualmente entre os meses das colunas.
    // Na prática da Matriz Blink, cada valor pertence a um mês da coluna.
    // Ex.: se a linha tem 2 valores, o primeiro é do mês que teve venda.
    for (let mIdx = 0; mIdx < matches.length; mIdx++) {
      const matchItem = matches[mIdx]
      // Determina o mês: se tem mesma quantidade de meses ou mapeia pelo índice
      const mesNameUpper = activeMonths[mIdx] || activeMonths[activeMonths.length - 1]
      const mesNorm = MESES_MAP_NORM[mesNameUpper.toLowerCase()] || mesNameUpper.toLowerCase()

      items.push({
        pais: currentPais,
        carteira: normalizeCarteiraName(currentCarteira),
        grupo_cliente: currentGrupo,
        cliente: clienteNome,
        mes: mesNorm,
        ano: anoRelatorio,
        valor: matchItem.num,
      })
    }
  }

  return items
}

/**
 * PARSER 2: PEDIDOS EM CARTEIRA
 * Colunas: MÊS | SETEMBRO OUTUBRO NOVEMBRO DEZEMBRO JANEIRO FEVEREIRO
 * Hierarquia: segmento (Pet, Ruminantes, Suínos) > cliente
 * Linha final: "Total Geral" (ignorar na gravação)
 */
export function parsePedidosCarteira(text: string, fileName: string = ''): PedidoCarteiraItem[] {
  const items: PedidoCarteiraItem[] = []
  const { ano: baseAno, mes: baseMesNum } = extractDateFromFileName(fileName)

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // 1. Detectar as colunas de meses da janela de 6 meses
  let columnMonths: Array<{ mesNome: string; ano: number }> = []

  for (const line of lines) {
    const upperLine = line.toUpperCase()
    if (upperLine.includes('MÊS') || upperLine.includes('MES')) {
      const found: string[] = []
      for (const m of MESES_NOMES) {
        if (upperLine.includes(m)) {
          found.push(m)
        }
      }
      if (found.length >= 2) {
        found.sort((a, b) => upperLine.indexOf(a) - upperLine.indexOf(b))
        // Atribuir ano: se o mês for menor que o mês base, virou o ano!
        columnMonths = found.map((mName) => {
          const mNorm = MESES_MAP_NORM[mName.toLowerCase()] || mName.toLowerCase()
          const mNum = MESES_ORDEM[mNorm] || 1
          const itemAno = mNum < baseMesNum ? baseAno + 1 : baseAno
          return { mesNome: mNorm, ano: itemAno }
        })
        break
      }
    }
  }

  // Fallback caso não encontre cabeçalho de meses explícito
  if (columnMonths.length === 0) {
    // 6 meses a partir do mês base
    for (let i = 0; i < 6; i++) {
      let targetMNum = baseMesNum + i
      let targetAno = baseAno
      if (targetMNum > 12) {
        targetMNum -= 12
        targetAno = baseAno + 1
      }
      const mesKey =
        Object.keys(MESES_ORDEM).find((k) => MESES_ORDEM[k] === targetMNum) || 'janeiro'
      columnMonths.push({ mesNome: mesKey, ano: targetAno })
    }
  }

  // 2. Segmentos conhecidos: Pet, Ruminantes, Suínos
  const KNOWN_SEGMENTS = [
    'Pet',
    'PET',
    'Ruminantes',
    'RUMINANTES',
    'Suínos',
    'SUÍNOS',
    'Suinos',
    'SUINOS',
  ]
  let currentSegment = 'Pet'

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const lineTrim = rawLine.trim()

    // Ignorar rodapés ou linhas de cabeçalho
    if (
      lineTrim.toUpperCase().startsWith('PEDIDOS EM CARTEIRA') ||
      lineTrim.toUpperCase().startsWith('MÊS') ||
      lineTrim.toUpperCase().startsWith('MES')
    ) {
      continue
    }

    // Linha final "Total Geral" -> ignorar
    if (lineTrim.toLowerCase().startsWith('total geral')) {
      continue
    }

    // Verificar se é linha de cabeçalho de segmento
    let isSegmentHeader = false
    for (const seg of KNOWN_SEGMENTS) {
      if (lineTrim.startsWith(seg)) {
        currentSegment = normalizeCarteiraName(seg)
        isSegmentHeader = true
        break
      }
    }

    // Se a linha for só o nome do segmento e totais do segmento, não é cliente bruto
    // Ex.: "Pet $ 6.825,80 $ 97.445,93 $ 63.224,30 $ 60.000,00"
    if (isSegmentHeader) {
      continue
    }

    // Linha de cliente com valores
    // Ex.: "Special Dog $ 60.000,03 $ 60.000,00 $ 60.000,00"
    // Ex.: "Brenntag Química Brasil Ltda $ 50.258,61"
    let lineFixed = lineTrim.replace(/([a-zA-ZÀ-ÿ])(\d{1,3}(?:\.\d{3})*,\d{2}\$?)/g, '$1 $2')

    const valueRegex = /(?:\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\$?/g
    const matches: Array<{ str: string; num: number; index: number }> = []
    let m: RegExpExecArray | null

    while ((m = valueRegex.exec(lineFixed)) !== null) {
      const parsedVal = parseBlinkMonetaryValue(m[1])
      if (parsedVal > 0) {
        matches.push({
          str: m[0],
          num: parsedVal,
          index: m.index,
        })
      }
    }

    if (matches.length === 0) continue

    const firstMatchIdx = matches[0].index
    let clienteNome = lineFixed.substring(0, firstMatchIdx).trim()
    clienteNome = clienteNome.replace(/[$\-:]+$/, '').trim()

    if (clienteNome.length < 2) continue

    // Distribuir valores nas colunas de meses da janela
    for (let mIdx = 0; mIdx < matches.length; mIdx++) {
      const matchItem = matches[mIdx]
      const colInfo = columnMonths[mIdx] || columnMonths[columnMonths.length - 1]

      items.push({
        cliente: clienteNome,
        segmento: currentSegment,
        mes: colInfo.mesNome,
        ano: colInfo.ano,
        valor: matchItem.num,
      })
    }
  }

  return items
}

/**
 * PARSER 3: RELATÓRIO DE VENDAS SEMANAL
 * Cabeçalhos: BLINK GERAL | BR | INDUSTRIA | PREMIXEIRAS | DISTRIBUIDORAS | LATAM
 * Linhas: PLANEJADO, REALIZADO e %
 * Blocos: RESULTADO SETEMBRO (semana), RESULTADO Q3, RESULTADO YTD e TOTAL
 * Vendedores: Rodrigo Garginal Ruminantes, Jessica Dilkin Aves, Tais Fauro Suínos, Wagner Zacatei Pets, etc.
 * Contagens: NOVOS CLIENTES
 */
export function parseRelatorioVendasSemanal(
  text: string,
  fileName: string = '',
): RelatorioSemanalMetaItem[] {
  const items: RelatorioSemanalMetaItem[] = []
  const { ano: fallbackAno } = extractDateFromFileName(fileName)

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Identificar blocos no texto
  // "RESULTADO SETEMBRO", "RESULTADO Q3", "RESULTADO YTD"
  let currentBloco = 'RESULTADO SETEMBRO'
  let currentTipoBloco: 'semana' | 'trimestre' | 'ytd' = 'semana'
  let currentPeriodoStr = `${fallbackAno}-09`

  const CANAIS = ['BLINK', 'BR', 'INDUSTRIA', 'PREMIXEIRAS', 'DISTRIBUIDORAS', 'LATAM']

  const KNOWN_SELLERS: Array<{ nome: string; carteira: string }> = [
    { nome: 'Rodrigo Gardinal', carteira: 'Ruminantes' },
    { nome: 'Rodrigo Garginal', carteira: 'Ruminantes' },
    { nome: 'Jessica Dilkin', carteira: 'Aves' },
    { nome: 'Jéssica Dilkin', carteira: 'Aves' },
    { nome: 'Tais Fauro', carteira: 'Suínos' },
    { nome: 'Wagner Zacatei', carteira: 'Pets' },
    { nome: 'A definir', carteira: 'Equinos' },
    { nome: 'A definir Aqua', carteira: 'Aqua' },
    { nome: 'A definir Diversos', carteira: 'Diversos' },
  ]

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const upperLine = line.toUpperCase()

    // 1. Detecção de troca de bloco
    if (upperLine.includes('RESULTADO SETEMBRO') || upperLine.includes('RESULTADO SEMANAL')) {
      currentBloco = 'RESULTADO SETEMBRO'
      currentTipoBloco = 'semana'
      currentPeriodoStr = `${fallbackAno}-09`
    } else if (upperLine.includes('RESULTADO Q3')) {
      currentBloco = 'RESULTADO Q3'
      currentTipoBloco = 'trimestre'
      currentPeriodoStr = `${fallbackAno}-Q3`
    } else if (upperLine.includes('RESULTADO YTD')) {
      currentBloco = 'RESULTADO YTD'
      currentTipoBloco = 'ytd'
      currentPeriodoStr = `${fallbackAno}-YTD`
    }

    // 2. Detecção de linha TOTAL (Geral da Blink)
    if (upperLine.startsWith('TOTAL') || upperLine === 'TOTAL') {
      // As próximas 2 linhas geralmente são PLANEJADO e REALIZADO
      let planVals: number[] = []
      let realVals: number[] = []

      for (let j = 1; j <= 4 && i + j < lines.length; j++) {
        const nextLine = lines[i + j]
        if (nextLine.toUpperCase().startsWith('PLANEJADO')) {
          planVals = extractMonetaryValues(nextLine)
        } else if (nextLine.toUpperCase().startsWith('REALIZADO')) {
          realVals = extractMonetaryValues(nextLine)
        }
      }

      if (planVals.length > 0 || realVals.length > 0) {
        for (let cIdx = 0; cIdx < CANAIS.length; cIdx++) {
          const canalName = CANAIS[cIdx]
          const pVal = planVals[cIdx] || 0
          const rVal = realVals[cIdx] || 0
          const pct = pVal > 0 ? Math.round((rVal / pVal) * 100) : 0

          items.push({
            periodo_rotulo: currentBloco,
            periodo: currentPeriodoStr,
            ano: fallbackAno,
            tipo_bloco: currentTipoBloco,
            dimensao_tipo: 'geral',
            canal: canalName,
            planejado: pVal,
            realizado: rVal,
            atingimento_pct: pct,
          })
        }
      }
    }

    // 3. Detecção de vendedor com carteira
    // Ex.: "Rodrigo Garginal Ruminantes PLANEJADO $ 145.791,37 ..."
    for (const seller of KNOWN_SELLERS) {
      if (upperLine.includes(seller.nome.toUpperCase())) {
        // Encontrou vendedor: extrair valores de planejado e realizado para cada canal
        let planVals: number[] = []
        let realVals: number[] = []

        for (let j = 0; j <= 3 && i + j < lines.length; j++) {
          const sLine = lines[i + j]
          if (sLine.toUpperCase().includes('PLANEJADO')) {
            planVals = extractMonetaryValues(sLine)
          } else if (sLine.toUpperCase().includes('REALIZADO')) {
            realVals = extractMonetaryValues(sLine)
          }
        }

        if (planVals.length > 0 || realVals.length > 0) {
          for (let cIdx = 0; cIdx < CANAIS.length; cIdx++) {
            const canalName = CANAIS[cIdx]
            const pVal = planVals[cIdx] || 0
            const rVal = realVals[cIdx] || 0
            const pct = pVal > 0 ? Math.round((rVal / pVal) * 100) : 0

            items.push({
              periodo_rotulo: currentBloco,
              periodo: currentPeriodoStr,
              ano: fallbackAno,
              tipo_bloco: currentTipoBloco,
              dimensao_tipo: 'vendedor',
              canal: canalName,
              vendedor_nome: seller.nome === 'Rodrigo Garginal' ? 'Rodrigo Gardinal' : seller.nome,
              carteira: seller.carteira,
              planejado: pVal,
              realizado: rVal,
              atingimento_pct: pct,
            })
          }
        }
        break
      }
    }

    i++
  }

  return items
}

/**
 * Função auxiliar para extrair múltiplos valores numéricos de uma linha
 */
function extractMonetaryValues(line: string): number[] {
  const vals: number[] = []
  // Substituir traços soltos por 0
  const normalized = line.replace(/(\s|^)[-–—](\s|$)/g, ' 0 ')
  const valueRegex = /(?:\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\b\d+\b)\$?|\b0\b/g
  let m: RegExpExecArray | null

  while ((m = valueRegex.exec(normalized)) !== null) {
    const parsed = parseBlinkMonetaryValue(m[0])
    vals.push(parsed)
  }

  return vals
}

/**
 * PARSER 4: ATENDIMENTO A PEDIDOS (CARTEIRA SETEMBRO/OUTUBRO)
 * Layout da tabela:
 * Nº Pedido | Cliente | Envio | Data Solicitada | Entrega Confirmada | Obs
 * Linhas com número textual como "Cotação" são suportadas.
 * "Aguardando data" vira data vazia (não rejeitado).
 * Tratamento de datas com formato dia/mês ambíguo ou padrão BR (DD/MM/AAAA) / US (MM/DD/AAAA)
 * e flag `dataAmbigua` para notificação na prévia.
 */
export function parseAtendimentoPedidosDate(rawDateStr: string): {
  isoDate?: string
  raw: string
  isAmbigua: boolean
} {
  const s = (rawDateStr || '').trim()
  if (!s || /aguardando/i.test(s) || s === '-' || s === '–') {
    return { raw: s, isAmbigua: false }
  }

  // Tentar encontrar DD/MM/AAAA ou MM/DD/AAAA ou DD/MM/YY
  // Também tolerar digitação sem barra antes do ano (ex: 09/102026 -> 09/10/2026)
  let normalized = s.replace(/(\d{2})\/(\d{2})(\d{4})/, '$1/$2/$3')
  const match = normalized.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (!match) {
    return { raw: s, isAmbigua: false }
  }

  let p1 = parseInt(match[1], 10)
  let p2 = parseInt(match[2], 10)
  let year = parseInt(match[3], 10)
  if (year < 100) year += 2000

  let day = p1
  let month = p2
  let isAmbigua = false

  // Se p2 > 12 e p1 <= 12, com certeza é formato MM/DD/YYYY (ex: 10/15/2026 -> 15 de Outubro)
  if (p2 > 12 && p1 <= 12) {
    month = p1
    day = p2
    isAmbigua = true // Marcamos como ambiguidade tratada
  } else if (p1 > 12 && p2 <= 12) {
    // Formato claro DD/MM/YYYY
    day = p1
    month = p2
  } else if (p1 <= 12 && p2 <= 12 && p1 !== p2) {
    // Ambos <= 12: ex 05/10 ou 10/05
    // No Brasil o padrão geral é DD/MM.
    // Mas se o arquivo contiver padrão invertido evidente (como 10/05 ao lado de 05/10),
    // marcamos como ambígua para transparência na prévia.
    day = p1
    month = p2
    isAmbigua = true
  }

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { isoDate: iso, raw: s, isAmbigua }
}

export function parseAtendimentoPedidos(
  text: string,
  rows?: Array<Record<string, unknown>>,
): AtendimentoPedidoItem[] {
  const items: AtendimentoPedidoItem[] = []

  // 1. Se vierem rows estruturadas (planilha ou JSON extraído)
  if (Array.isArray(rows) && rows.length > 0) {
    for (const r of rows) {
      const keys = Object.keys(r)
      const findKey = (candidates: string[]) =>
        keys.find((k) =>
          candidates.some((c) =>
            k
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .includes(c),
          ),
        )

      const pedidoKey = findKey(['pedido', 'nº pedido', 'no pedido', 'numero'])
      const clienteKey = findKey(['cliente', 'razao', 'nome'])
      const envioKey = findKey(['envio', 'frete', 'modalidade'])
      const solicitadaKey = findKey(['data solicitada', 'solicitada'])
      const confirmadaKey = findKey(['entrega confirmada', 'confirmada', 'entrega'])
      const obsKey = findKey(['obs', 'observac', 'observacoes', 'nota'])

      const numPedido = String(r[pedidoKey || ''] || '').trim()
      const cliente = String(r[clienteKey || ''] || '').trim()

      if (!numPedido && !cliente) continue
      // Pular linha se for o cabeçalho repetido
      if (/^n[ºo]?\s*pedido$/i.test(numPedido) || /^cliente$/i.test(cliente)) continue

      const envio = String(r[envioKey || ''] || '')
        .trim()
        .toUpperCase()
      const rawSolicitada = String(r[solicitadaKey || ''] || '').trim()
      const rawConfirmada = String(r[confirmadaKey || ''] || '').trim()
      const obs = String(r[obsKey || ''] || '').trim()

      const parsedSol = parseAtendimentoPedidosDate(rawSolicitada)
      const parsedConf = parseAtendimentoPedidosDate(rawConfirmada)

      items.push({
        numeroPedido: numPedido,
        cliente,
        envio: envio.includes('FOB') ? 'FOB' : envio.includes('CIF') ? 'CIF' : envio,
        dataSolicitada: parsedSol.isoDate,
        dataSolicitadaRaw: parsedSol.raw,
        entregaConfirmada: parsedConf.isoDate,
        entregaConfirmadaRaw: parsedConf.raw,
        observacoes: obs,
        dataAmbigua: parsedSol.isAmbigua || parsedConf.isAmbigua,
      })
    }

    if (items.length > 0) return items
  }

  // 2. Extração de texto tabular / PDF / OCR
  const lines = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const cleanLine = rawLine.replace(/[\t]+/g, ' | ')

    // Ignorar título ou cabeçalhos
    const lower = cleanLine.toLowerCase()
    if (
      lower.includes('atendimento a pedidos') ||
      lower.includes('atendimento pedidos') ||
      (lower.includes('pedido') && lower.includes('cliente') && lower.includes('envio'))
    ) {
      continue
    }

    // Casos separados por pipe (|)
    if (cleanLine.includes('|')) {
      const parts = cleanLine.split('|').map((p) => p.trim())
      if (parts.length >= 3) {
        const numPedido = parts[0]
        const cliente = parts[1]
        const envio = parts[2].toUpperCase()
        const rawSol = parts[3] || ''
        const rawConf = parts[4] || ''
        const obs = parts.slice(5).join(' ') || ''

        if (numPedido && cliente) {
          const parsedSol = parseAtendimentoPedidosDate(rawSol)
          const parsedConf = parseAtendimentoPedidosDate(rawConf)
          items.push({
            numeroPedido: numPedido,
            cliente,
            envio: envio.includes('FOB') ? 'FOB' : envio.includes('CIF') ? 'CIF' : envio,
            dataSolicitada: parsedSol.isoDate,
            dataSolicitadaRaw: parsedSol.raw,
            entregaConfirmada: parsedConf.isoDate,
            entregaConfirmadaRaw: parsedConf.raw,
            observacoes: obs,
            dataAmbigua: parsedSol.isAmbigua || parsedConf.isAmbigua,
          })
          continue
        }
      }
    }

    // Casos em que as colunas vêm separadas por espaços múltiplos ou regex:
    // Padrão: (Numero ou "Cotação") + (Razão Social) + (FOB|CIF) + (Data ou "Aguardando data") + ...
    const rowMatch = cleanLine.match(/^(\d+|cota[cç][aã]o)\s+(.+?)\s+(FOB|CIF)\s+(.+)$/i)
    if (rowMatch) {
      const numPedido = rowMatch[1]
      const cliente = rowMatch[2].trim()
      const envio = rowMatch[3].toUpperCase()
      const rest = rowMatch[4].trim()

      // Tentar separar as duas datas e obs no resto da linha
      // Datas podem ser: "28/08/2026", "Aguardando data", "09/102026", "10/15/2026"
      const dateTokenRegex = /(\d{1,2}[/\-.]\d{1,2}[/\-.]?\d{2,4}|aguardando(?:\s+data)?)/gi
      const dateTokens: string[] = []
      let dMatch: RegExpExecArray | null
      let lastIndex = 0

      while ((dMatch = dateTokenRegex.exec(rest)) !== null) {
        dateTokens.push(dMatch[0])
        lastIndex = dMatch.index + dMatch[0].length
      }

      const rawSol = dateTokens[0] || ''
      const rawConf = dateTokens[1] || ''
      const obs = rest.substring(lastIndex).trim()

      const parsedSol = parseAtendimentoPedidosDate(rawSol)
      const parsedConf = parseAtendimentoPedidosDate(rawConf)

      items.push({
        numeroPedido: numPedido,
        cliente,
        envio: envio.includes('FOB') ? 'FOB' : 'CIF',
        dataSolicitada: parsedSol.isoDate,
        dataSolicitadaRaw: parsedSol.raw,
        entregaConfirmada: parsedConf.isoDate,
        entregaConfirmadaRaw: parsedConf.raw,
        observacoes: obs,
        dataAmbigua: parsedSol.isAmbigua || parsedConf.isAmbigua,
      })
    }
  }

  return items
}
