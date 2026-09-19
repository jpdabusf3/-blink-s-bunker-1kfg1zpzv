import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import {
  FATURAMENTO_FIELDS,
  autoSuggestMapping,
  parseDateBR,
  parseClientName,
  parseProductDesc,
  parseFaturamentoPreview,
  importFaturamento,
  isBlinkOfficialTemplate,
  type FaturamentoFieldKey,
  type FaturamentoImportResult,
} from '@/services/import-faturamento'
import { extrairTextoPdf } from '@/services/nfe-service'
import {
  detectBlinkReportType,
  parseMatrizVenda,
  parsePedidosCarteira,
  parseRelatorioVendasSemanal,
  type MatrizVendaItem,
  type PedidoCarteiraItem,
  type RelatorioSemanalMetaItem,
} from '@/services/blink-pdf-parsers'
import {
  executeImportMatrizVenda,
  executeImportPedidosCarteira,
  executeImportRelatorioVendasSemanal,
} from '@/services/maestro-analyze-service'
import { normalizeNumberBR } from '@/lib/utils'

export type DetectedFileType =
  | 'spreadsheet'
  | 'pdf_matriz_venda'
  | 'pdf_pedidos_carteira'
  | 'pdf_relatorio_vendas_semanal'
  | 'document_table'
  | 'unknown'

export interface SmartImportParseResult {
  detectedType: DetectedFileType
  headers: string[]
  rows: Record<string, unknown>[]
  suggestedMapping: Record<string, FaturamentoFieldKey | ''>
  fileName: string
  fileSize: number
  totalRows: number
  rawText?: string
  isBlinkOfficialTemplate?: boolean
  blinkData?: {
    matrizVenda?: MatrizVendaItem[]
    pedidosCarteira?: PedidoCarteiraItem[]
    relatorioSemanal?: RelatorioSemanalMetaItem[]
  }
}

export interface SmartRowValidation {
  index: number
  isValid: boolean
  isDuplicate: boolean
  errors: string[]
  duplicateKey: string
  clientName: string
  date: string
  documentNumber: string
  product: string
  value: number
  valueUsd?: number
}

export interface SmartValidationSummary {
  validCount: number
  invalidCount: number
  duplicateCount: number
  newCount?: number
  rowValidations: SmartRowValidation[]
  validationErrors: Array<{ row: number; reason: string }>
}

/**
 * Gera a chave única de deduplicação conforme regra de negócio:
 * cliente + data + numero_documento + produto
 */
export function buildDuplicateKey(
  cliente: unknown,
  data: unknown,
  numeroDoc: unknown,
  produto: unknown,
): string {
  const norm = (val: unknown) =>
    String(val ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()

  const c = norm(cliente)
  const d = norm(data)
  const n = norm(numeroDoc)
  const p = norm(produto)

  // Deduplicação mandatória:
  // Data Faturamento + Cliente + Produto (+ NF se houver)
  if (n) {
    return `${d}__${c}__${p}__${n}`
  }
  return `${d}__${c}__${p}`
}

/**
 * Converte texto (de DOCX, DOC ou texto plano) em linhas tabulares se houver estrutura reconhecível.
 * Aceita tabelas Markdown (| c1 | c2 |), delimitadas por tabulação (\t) ou ponto e vírgula (;).
 */
export function parseTextToTabularRows(text: string): {
  headers: string[]
  rows: Record<string, unknown>[]
} {
  if (!text || typeof text !== 'string') {
    return { headers: [], rows: [] }
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return { headers: [], rows: [] }
  }

  // 1. Tentar Markdown table (| Col1 | Col2 | Col3 |)
  const mdTableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|'))
  if (mdTableLines.length >= 2) {
    const rawHeader = mdTableLines[0]
    const headerCols = rawHeader
      .split('|')
      .map((c) => c.trim())
      .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1)

    if (headerCols.length >= 2) {
      const rows: Record<string, unknown>[] = []
      for (let i = 1; i < mdTableLines.length; i++) {
        const line = mdTableLines[i]
        // Ignorar separadores como |---|---|
        if (/^\|[\s\-:|]+\|$/.test(line)) continue

        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1)

        if (cells.length > 0) {
          const rowObj: Record<string, unknown> = {}
          headerCols.forEach((col, idx) => {
            rowObj[col] = cells[idx] ?? ''
          })
          rows.push(rowObj)
        }
      }
      if (rows.length > 0) {
        return { headers: headerCols, rows }
      }
    }
  }

  // 2. Tentar CSV / TSV / Linhas separadas por \t ou ;
  const firstLine = lines[0]
  let delimiter: string | null = null
  if (firstLine.includes('\t') && firstLine.split('\t').length >= 2) {
    delimiter = '\t'
  } else if (firstLine.includes(';') && firstLine.split(';').length >= 2) {
    delimiter = ';'
  } else if (firstLine.includes(',') && firstLine.split(',').length >= 2) {
    delimiter = ','
  }

  if (delimiter) {
    const headerCols = firstLine.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''))
    if (headerCols.length >= 2) {
      const rows: Record<string, unknown>[] = []
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''))
        if (parts.some((p) => p !== '')) {
          const rowObj: Record<string, unknown> = {}
          headerCols.forEach((col, idx) => {
            rowObj[col] = parts[idx] ?? ''
          })
          rows.push(rowObj)
        }
      }
      if (rows.length > 0) {
        return { headers: headerCols, rows }
      }
    }
  }

  return { headers: [], rows: [] }
}

/**
 * Extrai texto em formato Markdown de um DOCX lendo os arquivos XML internos (word/document.xml).
 * Transforma tabelas <w:tbl> em Markdown tables e parágrafos <w:p> em linhas de texto.
 */
async function extractDocxTextAndTables(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    // XLSX possui utilitário zip integrado ou podemos ler via Uint8Array
    // XLSX.read consegue abrir DOCX como zip se usar type 'array'
    // Mas uma forma robusta é tentar ler via XLSX (muitos arquivos exportados como docx na verdade são xml/html)
    // ou decodificar XMLs
    const textDecoder = new TextDecoder('utf-8', { fatal: false })
    const rawContent = textDecoder.decode(new Uint8Array(arrayBuffer.slice(0, 100000)))

    // Se for um arquivo HTML / XML direto salvo como .doc
    if (rawContent.includes('<table') || rawContent.includes('<html')) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(rawContent, 'text/html')
      const table = doc.querySelector('table')
      if (table) {
        const rows = Array.from(table.querySelectorAll('tr'))
        const mdLines: string[] = []
        rows.forEach((tr, rIdx) => {
          const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
            (c.textContent || '').trim().replace(/[\r\n]+/g, ' '),
          )
          if (cells.length > 0) {
            mdLines.push(`| ${cells.join(' | ')} |`)
            if (rIdx === 0) {
              mdLines.push(`| ${cells.map(() => '---').join(' | ')} |`)
            }
          }
        })
        if (mdLines.length >= 2) {
          return mdLines.join('\n')
        }
      }
    }

    // Tentar XLSX caso seja uma planilha mal renomeada
    try {
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv && csv.trim().length > 10) {
          return csv
        }
      }
    } catch {
      // continua
    }

    // Tentar chamada ao backend PocketBase para conversão via $documents.toMarkdown se disponível
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await pb.send<{ markdown?: string; text?: string }>(
        '/backend/v1/maestro/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            extracted_text: '',
            filePath: file.name,
            mime_type: file.type,
          }),
        },
      )
      if (res && res.markdown) {
        return res.markdown
      }
    } catch {
      // ignore
    }

    return ''
  } catch {
    return ''
  }
}

/**
 * Orquestrador principal da Importação Inteligente.
 * Recebe qualquer File suportado (.xlsx, .xls, .csv, .pdf, .doc, .docx)
 * e devolve colunas detectadas, linhas parseadas, tipo de documento identificado
 * e mapeamento sugerido.
 */
export async function smartParseFile(file: File): Promise<SmartImportParseResult> {
  const fileName = file.name || 'arquivo'
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const fileSize = file.size

  // 1. Arquivos Excel ou CSV
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const { headers, rows } = await parseFaturamentoPreview(file, 5000)
    if (headers.length === 0 || rows.length === 0) {
      throw new Error(
        'A planilha não contém dados ou cabeçalhos válidos. Verifique o arquivo e tente novamente.',
      )
    }

    const isOfficial = isBlinkOfficialTemplate(headers)
    const suggested = autoSuggestMapping(headers)

    return {
      detectedType: 'spreadsheet',
      headers,
      rows,
      suggestedMapping: suggested,
      fileName,
      fileSize,
      totalRows: rows.length,
      isBlinkOfficialTemplate: isOfficial,
    }
  }

  // 2. Arquivos PDF (reconhecimento de relatórios Blink ou fallback)
  if (ext === 'pdf') {
    let pdfText = ''
    try {
      pdfText = await extrairTextoPdf(file)
    } catch (err) {
      console.warn('smartParseFile: falha ao extrair texto do PDF localmente', err)
    }

    const blinkType = detectBlinkReportType(pdfText, fileName)

    if (blinkType === 'matriz_venda') {
      const items = parseMatrizVenda(pdfText, fileName)
      if (items.length === 0) {
        throw new Error(
          'Identificamos um relatório de Matriz de Venda da Blink, mas não foi possível extrair dados legíveis das páginas.',
        )
      }

      // Converter itens em formato de linhas compatíveis com faturamento
      const headers = ['Mês', 'Ano', 'Cliente', 'Carteira', 'País', 'Grupo Cliente', 'Valor (R$)']
      const rows = items.map((it) => ({
        Mês: it.mes,
        Ano: it.ano,
        Cliente: it.cliente,
        Carteira: it.carteira,
        País: it.pais,
        'Grupo Cliente': it.grupo_cliente,
        'Valor (R$)': it.valor,
      }))

      const suggested: Record<string, FaturamentoFieldKey | ''> = {
        Mês: 'data',
        Ano: '',
        Cliente: 'cliente',
        Carteira: 'especie',
        País: 'country',
        'Grupo Cliente': 'canal_vendas',
        'Valor (R$)': 'valor',
      }

      return {
        detectedType: 'pdf_matriz_venda',
        headers,
        rows,
        suggestedMapping: suggested,
        fileName,
        fileSize,
        totalRows: rows.length,
        rawText: pdfText,
        blinkData: { matrizVenda: items },
      }
    }

    if (blinkType === 'pedidos_carteira') {
      const items = parsePedidosCarteira(pdfText, fileName)
      if (items.length === 0) {
        throw new Error(
          'Identificamos um relatório de Pedidos em Carteira da Blink, mas não foi possível extrair clientes e valores.',
        )
      }

      const headers = ['Mês', 'Ano', 'Cliente', 'Segmento', 'Valor (R$)']
      const rows = items.map((it) => ({
        Mês: it.mes,
        Ano: it.ano,
        Cliente: it.cliente,
        Segmento: it.segmento,
        'Valor (R$)': it.valor,
      }))

      const suggested: Record<string, FaturamentoFieldKey | ''> = {
        Mês: 'data',
        Ano: '',
        Cliente: 'cliente',
        Segmento: 'especie',
        'Valor (R$)': 'valor',
      }

      return {
        detectedType: 'pdf_pedidos_carteira',
        headers,
        rows,
        suggestedMapping: suggested,
        fileName,
        fileSize,
        totalRows: rows.length,
        rawText: pdfText,
        blinkData: { pedidosCarteira: items },
      }
    }

    if (blinkType === 'relatorio_vendas_semanal') {
      const items = parseRelatorioVendasSemanal(pdfText, fileName)
      if (items.length === 0) {
        throw new Error(
          'Identificamos um Relatório de Vendas Semanal da Blink, mas nenhuma meta/realizado pôde ser estruturada.',
        )
      }

      const headers = [
        'Período',
        'Canal',
        'Vendedor',
        'Carteira',
        'Planejado (R$)',
        'Realizado (R$)',
        'Atingimento (%)',
      ]
      const rows = items.map((it) => ({
        Período: it.periodo_rotulo,
        Canal: it.canal,
        Vendedor: it.vendedor_nome || '—',
        Carteira: it.carteira || '—',
        'Planejado (R$)': it.planejado,
        'Realizado (R$)': it.realizado,
        'Atingimento (%)': it.atingimento_pct ? `${it.atingimento_pct}%` : '—',
      }))

      const suggested: Record<string, FaturamentoFieldKey | ''> = {
        Período: 'data',
        Canal: 'canal_vendas',
        Vendedor: 'vendedor',
        Carteira: 'especie',
        'Planejado (R$)': '',
        'Realizado (R$)': 'valor',
        'Atingimento (%)': '',
      }

      return {
        detectedType: 'pdf_relatorio_vendas_semanal',
        headers,
        rows,
        suggestedMapping: suggested,
        fileName,
        fileSize,
        totalRows: rows.length,
        rawText: pdfText,
        blinkData: { relatorioSemanal: items },
      }
    }

    // PDF comum que não é um dos 3 relatórios Blink
    throw new Error(
      'Não foi possível identificar dados tabulares neste documento. Use XLSX, CSV ou um relatório PDF da Blink (Matriz de venda, Pedidos em carteira ou Relatório de vendas semanal).',
    )
  }

  // 3. Arquivos DOC / DOCX
  if (ext === 'doc' || ext === 'docx') {
    const textContent = await extractDocxTextAndTables(file)
    const { headers, rows } = parseTextToTabularRows(textContent)

    if (headers.length >= 2 && rows.length > 0) {
      const suggested = autoSuggestMapping(headers)
      return {
        detectedType: 'document_table',
        headers,
        rows,
        suggestedMapping: suggested,
        fileName,
        fileSize,
        totalRows: rows.length,
        rawText: textContent,
      }
    }

    throw new Error(
      'Não foi possível identificar dados tabulares neste documento. Use XLSX, CSV ou um relatório PDF da Blink.',
    )
  }

  throw new Error(
    `Formato .${ext} não suportado. Por favor, envie um arquivo .xlsx, .xls, .csv, .pdf, .doc ou .docx.`,
  )
}

/**
 * Valida linha a linha a estrutura tabular antes de gravar:
 * - Valida e normaliza moedas brasileiras (R$ e USD) via normalizeNumberBR
 * - Valida formato de datas (DD/MM/AAAA, MM/AAAA, ISO) via parseDateBR
 * - Identifica possíveis duplicatas pela chave cliente + data + numero_documento + produto
 * - Linhas inválidas NÃO bloqueiam a importação
 */
export function validateSmartRows(
  rows: Record<string, unknown>[],
  mapping: Record<string, FaturamentoFieldKey | ''>,
  existingDuplicateKeys: Set<string> = new Set(),
): SmartValidationSummary {
  const rowValidations: SmartRowValidation[] = []
  const validationErrors: Array<{ row: number; reason: string }> = []
  const seenBatchKeys = new Set<string>()

  // Inverter mapping para lookup rápido: campo CRM -> header da planilha
  const crmToHeader = new Map<FaturamentoFieldKey, string>()
  Object.entries(mapping).forEach(([header, crmField]) => {
    if (crmField) {
      crmToHeader.set(crmField, header)
    }
  })

  const dataHeader = crmToHeader.get('data')
  const clienteHeader = crmToHeader.get('cliente')
  const docHeader = crmToHeader.get('numero_documento')
  const produtoHeader = crmToHeader.get('produto')
  const produtoCodigoHeader = crmToHeader.get('produto_codigo')
  const cnpjHeader = crmToHeader.get('cnpj')
  const valorBrlHeader = crmToHeader.get('valor')
  const valorUsdHeader = crmToHeader.get('valor_usd')

  let validCount = 0
  let invalidCount = 0
  let duplicateCount = 0
  let newCount = 0

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1
    const errors: string[] = []

    // 1. Validar Cliente
    const rawCliente = clienteHeader ? row[clienteHeader] : undefined
    const cleanCliente = parseClientName(rawCliente)
    if (!clienteHeader || !cleanCliente || cleanCliente === '—') {
      errors.push('Cliente não informado ou vazio')
    }

    // 1.1 Validar CNPJ se presente (apenas formato, sem bloquear)
    const rawCnpj = cnpjHeader ? String(row[cnpjHeader] || '').trim() : ''
    const cleanCnpjDigits = rawCnpj.replace(/\D/g, '')
    const hasCnpj = cleanCnpjDigits.length === 14

    // 2. Validar Data
    const rawData = dataHeader ? row[dataHeader] : undefined
    const parsedData = parseDateBR(rawData)
    if (!dataHeader || !parsedData || parsedData === '—') {
      errors.push('Data inválida ou não informada')
    }

    // 3. Validar Valor (deve ter ao menos um valor numérico válido > 0 em USD ou BRL)
    const rawValBrl = valorBrlHeader ? row[valorBrlHeader] : undefined
    const rawValUsd = valorUsdHeader ? row[valorUsdHeader] : undefined

    const numBrl = normalizeNumberBR(rawValBrl)
    const numUsd = normalizeNumberBR(rawValUsd)

    const hasValidValue =
      (valorBrlHeader && numBrl > 0) ||
      (valorUsdHeader && numUsd > 0) ||
      (!valorBrlHeader && !valorUsdHeader && false)

    if (!hasValidValue && (valorBrlHeader || valorUsdHeader)) {
      errors.push('Valor numérico inválido ou zerado')
    } else if (!valorBrlHeader && !valorUsdHeader) {
      errors.push('Nenhuma coluna de valor associada')
    }

    // 4. Checar duplicata
    const rawDoc = docHeader ? row[docHeader] : ''
    const rawProd = produtoHeader ? row[produtoHeader] : ''
    const rawProdCod = produtoCodigoHeader ? row[produtoCodigoHeader] : ''
    const cleanProd = parseProductDesc(rawProd) || String(rawProdCod || '')

    const duplicateKey = buildDuplicateKey(cleanCliente, parsedData, rawDoc, cleanProd)
    // Chave secundária por código de produto caso venha código e descrição separados
    const altDuplicateKey = rawProdCod
      ? buildDuplicateKey(cleanCliente, parsedData, rawDoc, rawProdCod)
      : ''

    const isDuplicate =
      Boolean(duplicateKey) &&
      (existingDuplicateKeys.has(duplicateKey) ||
        seenBatchKeys.has(duplicateKey) ||
        (Boolean(altDuplicateKey) &&
          (existingDuplicateKeys.has(altDuplicateKey) || seenBatchKeys.has(altDuplicateKey))))

    if (duplicateKey) {
      seenBatchKeys.add(duplicateKey)
    }
    if (altDuplicateKey) {
      seenBatchKeys.add(altDuplicateKey)
    }

    const isValid = errors.length === 0

    if (isValid) {
      validCount++
    } else {
      invalidCount++
      validationErrors.push({
        row: rowNumber,
        reason: errors.join('; ') + ` na linha ${rowNumber}`,
      })
    }

    if (isDuplicate) {
      duplicateCount++
    } else if (isValid) {
      newCount++
    }

    rowValidations.push({
      index: idx,
      isValid,
      isDuplicate,
      errors,
      duplicateKey,
      clientName: cleanCliente,
      date: parsedData,
      documentNumber: rawDoc ? String(rawDoc) : '—',
      product: cleanProd,
      value: numBrl,
      valueUsd: numUsd,
    })
  })

  return {
    validCount,
    invalidCount,
    duplicateCount,
    newCount,
    rowValidations,
    validationErrors,
  }
}

/**
 * Executa a gravação da importação inteligente de forma idempotente, segura e em modo APPEND.
 * Reutiliza os caminhos oficiais existentes:
 * - importFaturamento para planilhas / tabelas
 * - executeImportMatrizVenda / executeImportPedidosCarteira / executeImportRelatorioVendasSemanal para relatórios PDF Blink
 */
export interface ExecuteSmartImportOptions {
  parseResult: SmartImportParseResult
  mapping: Record<string, FaturamentoFieldKey | ''>
  ignoreDuplicates: boolean
  autoCreateClients?: boolean
  rowsToImportOverride?: Record<string, unknown>[]
  onProgress?: (current: number, total: number) => void
}

export async function executeSmartImport(params: ExecuteSmartImportOptions): Promise<{
  success: boolean
  totalRead: number
  imported: number
  duplicatesIgnored: number
  errorsCount: number
  totalValue?: number
  skippedRows?: number
  errorDetails: Array<{ row: number; reason: string }>
  message: string
}> {
  const {
    parseResult,
    mapping,
    ignoreDuplicates,
    autoCreateClients = true,
    rowsToImportOverride,
    onProgress,
  } = params

  // 1. Relatórios PDF oficiais da Blink identificados
  if (parseResult.detectedType === 'pdf_matriz_venda' && parseResult.blinkData?.matrizVenda) {
    const res = await executeImportMatrizVenda(
      parseResult.blinkData.matrizVenda,
      parseResult.fileName,
    )
    return {
      success: res.success,
      totalRead: parseResult.blinkData.matrizVenda.length,
      imported: res.inserted || 0,
      duplicatesIgnored: res.skippedDuplicates || 0,
      errorsCount: res.errorsCount || 0,
      errorDetails: res.errorDetails || [],
      message: res.message,
    }
  }

  if (
    parseResult.detectedType === 'pdf_pedidos_carteira' &&
    parseResult.blinkData?.pedidosCarteira
  ) {
    const res = await executeImportPedidosCarteira(
      parseResult.blinkData.pedidosCarteira,
      parseResult.fileName,
    )
    return {
      success: res.success,
      totalRead: parseResult.blinkData.pedidosCarteira.length,
      imported: res.inserted || 0,
      duplicatesIgnored: res.skippedDuplicates || 0,
      errorsCount: res.errorsCount || 0,
      errorDetails: res.errorDetails || [],
      message: res.message,
    }
  }

  if (
    parseResult.detectedType === 'pdf_relatorio_vendas_semanal' &&
    parseResult.blinkData?.relatorioSemanal
  ) {
    const res = await executeImportRelatorioVendasSemanal(
      parseResult.blinkData.relatorioSemanal,
      parseResult.fileName,
    )
    return {
      success: res.success,
      totalRead: parseResult.blinkData.relatorioSemanal.length,
      imported: res.inserted || 0,
      duplicatesIgnored: res.skippedDuplicates || 0,
      errorsCount: res.errorsCount || 0,
      errorDetails: res.errorDetails || [],
      message: res.message,
    }
  }

  // 2. Planilhas (XLSX, XLS, CSV) ou Documentos com tabelas (DOCX)
  // Filtrar duplicatas em memória antes de enviar se a opção ignoreDuplicates estiver ativada
  const validation = validateSmartRows(parseResult.rows, mapping)

  // Se o chamador especificou explicitamente as linhas a processar (ex: após filtro de ignoradas)
  let rowsToProcess: Record<string, unknown>[]
  if (rowsToImportOverride) {
    rowsToProcess = rowsToImportOverride
  } else {
    // Filtrar apenas linhas válidas (linhas inválidas não bloqueiam)
    rowsToProcess = parseResult.rows.filter((_, idx) => {
      const rowVal = validation.rowValidations[idx]
      if (!rowVal || !rowVal.isValid) return false
      if (ignoreDuplicates && rowVal.isDuplicate) return false
      return true
    })

    // Se o usuário selecionou "Importar mesmo assim"
    if (!ignoreDuplicates) {
      rowsToProcess = parseResult.rows.filter((_, idx) => {
        const rowVal = validation.rowValidations[idx]
        return rowVal && rowVal.isValid
      })
    }
  }

  if (rowsToProcess.length === 0) {
    // Registrar falha de importação em import_history
    try {
      const fName = parseResult.fileName || 'smart_import.xlsx'
      const parts = fName.split('.')
      const fType = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'xlsx'
      const errSummary =
        validation.validationErrors
          .map((e) => `Linha ${e.row}: ${e.reason}`)
          .slice(0, 10)
          .join('\n') || 'Nenhuma linha válida após validação de dados.'

      await pb.collection('import_history').create({
        file_name: fName,
        file_type: fType,
        imported_at: new Date().toISOString(),
        total_rows: parseResult.rows.length,
        imported_rows: 0,
        error_rows: validation.invalidCount,
        status: 'erro',
        details: errSummary,
      })
    } catch {
      /* intentionally ignored */
    }

    return {
      success: false,
      totalRead: parseResult.rows.length,
      imported: 0,
      duplicatesIgnored: ignoreDuplicates ? validation.duplicateCount : 0,
      errorsCount: validation.invalidCount,
      skippedRows: ignoreDuplicates ? validation.duplicateCount : 0,
      totalValue: 0,
      errorDetails: validation.validationErrors,
      message:
        'Nenhuma linha válida restante para importação após validação de dados e duplicatas.',
    }
  }

  // Gerar arquivo XLSX em memória a partir das linhas válidas para usar o importFaturamento oficial
  const ws = XLSX.utils.json_to_sheet(rowsToProcess)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Importacao')
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const memoryFile = new File([wbOut], parseResult.fileName || 'smart_import.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const importRes = await importFaturamento(memoryFile, mapping, {
    criarClienteNaoEncontrado: autoCreateClients,
    fileName: parseResult.fileName,
    onProgress,
  })

  const errorDetails = [
    ...validation.validationErrors,
    ...(importRes.erros || []).map((e) => ({ row: e.linha, reason: e.erro })),
  ]

  const importedCount = importRes.faturamentoImportados ?? importRes.criados ?? 0
  const dupCount =
    (importRes.faturamentoDuplicatas ?? importRes.duplicatasIgnoradas ?? 0) +
    (ignoreDuplicates ? validation.duplicateCount : 0)
  const totalValue = importRes.totalValorImportadoBrl ?? importRes.total_value ?? 0
  const skippedCount = dupCount + (importRes.skipped_zero ?? 0)

  return {
    success: importRes.success,
    totalRead: parseResult.rows.length,
    imported: importedCount,
    duplicatesIgnored: dupCount,
    errorsCount: errorDetails.length,
    totalValue,
    skippedRows: skippedCount,
    errorDetails,
    message: `Importação concluída com sucesso: ${importedCount} registros gravados, ${dupCount} duplicata(s) ignoradas e ${errorDetails.length} linha(s) com erro.`,
  }
}
