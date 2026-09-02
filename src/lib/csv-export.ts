import type { Factory } from '@/types'
import { formatCurrency } from '@/lib/utils'

export interface ParsedAddress {
  cep: string
  logradouro: string
  numero: string
  bairro: string
}

/**
 * Helper to extract 8-digit CEP (formatted as XXXXX-XXX) from raw address text.
 */
export function extractCep(text?: string | null): string {
  if (!text) return ''
  const match = String(text).match(/\b(\d{2}\.?\d{3}-?\d{3}|\d{8})\b/)
  if (match && match[1]) {
    const digits = match[1].replace(/\D/g, '')
    if (digits.length === 8) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`
    }
  }
  return ''
}

/**
 * Parses free-text address into CEP, logradouro, numero, bairro.
 * Examples handled:
 * - "Rua das Flores, 123, Centro, CEP 12345-678"
 * - "Av. Paulista, 1000 - Bela Vista"
 * - "Rodovia BR 101, Km 50, s/n - Zona Rural"
 * - "Rua Exemplo, S/N, Bairro Alto"
 */
export function parseAddress(rawAddress?: string | null): ParsedAddress {
  const result: ParsedAddress = {
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
  }

  if (!rawAddress) return result

  const raw = String(rawAddress).trim()
  result.cep = extractCep(raw)

  // Remove CEP substrings
  const withoutCep = raw
    .replace(
      /\bCEP:?\s*\d{2}\.?\d{3}-?\d{3}\b|\bCEP:?\s*\d{8}\b|\b\d{2}\.?\d{3}-?\d{3}\b|\b\d{8}\b/gi,
      '',
    )
    .trim()

  // Split by common delimiters (comma, hyphen, dash, semicolon)
  const parts = withoutCep
    .split(/[,;\-–—]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (parts.length > 0) {
    result.logradouro = parts[0]
  }

  // Regex for number / s/n / sem número
  const numRegex =
    /\b(?:n[º°.]?\s*|n[uú]mero\s*|n\s+)?(\d+[a-zA-Z]?|S\/N|s\/n|sn|sem\s+n[uú]mero)\b/i
  const numMatch = withoutCep.match(numRegex)
  if (numMatch && numMatch[1]) {
    const nStr = numMatch[1].trim()
    if (/^(sn|s\/n|sem\s+n[uú]mero)$/i.test(nStr)) {
      result.numero = 'S/N'
    } else {
      result.numero = nStr
    }
  }

  // Look for bairro in parts
  if (parts.length >= 3) {
    // If part 1 is number, part 2 is likely bairro
    if (/^\d+|s\/n|sn$/i.test(parts[1])) {
      result.bairro = parts[2]
    } else if (parts.length >= 2 && !result.bairro) {
      result.bairro = parts[parts.length - 1]
    }
  } else if (parts.length === 2 && !result.bairro) {
    // If second part is not just a number, it could be the bairro
    if (!/^\d+$/i.test(parts[1])) {
      result.bairro = parts[1]
    }
  }

  return result
}

/**
 * Format date to DD/MM/YYYY
 */
export function formatDateBR(dateVal?: string | number | Date | null): string {
  if (!dateVal) return '-'
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (isNaN(d.getTime())) return '-'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Format currency to R$ 1.234,56 (or "-" if null/undefined)
 */
export function formatCurrencyBR(value?: number | null): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '-'
  }
  return formatCurrency(Number(value))
}

/**
 * Replaces null, undefined, empty strings or purely whitespace values with "-"
 */
export function formatStringVal(val?: string | null): string {
  if (val === null || val === undefined) return '-'
  const s = String(val).trim()
  return s.length > 0 ? s : '-'
}

/**
 * Escapes CSV field for semicolon separated files with double quotes
 */
function escapeCsvCell(cell: string): string {
  const needsQuotes =
    cell.includes(';') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')
  const escaped = cell.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

/**
 * Columns in exact order:
 * 1. Nome
 * 2. CNPJ
 * 3. Cidade
 * 4. Estado
 * 5. CEP
 * 6. Logradouro
 * 7. Numero
 * 8. Bairro
 * 9. Telefone
 * 10. Email
 * 11. Gestor Tecnico
 * 12. Vendedor
 * 13. Status Funil
 * 14. Valor Potencial
 * 15. Precisao Geocode
 * 16. Status Endereco
 * 17. Enriquecido Em
 */
export function generateClientsCSV(factories: Factory[]): string {
  const headers = [
    'Nome',
    'CNPJ',
    'Cidade',
    'Estado',
    'CEP',
    'Logradouro',
    'Numero',
    'Bairro',
    'Telefone',
    'Email',
    'Gestor Tecnico',
    'Vendedor',
    'Status Funil',
    'Valor Potencial',
    'Precisao Geocode',
    'Status Endereco',
    'Enriquecido Em',
  ]

  const rows = factories.map((f) => {
    // Address parsing from free-text `address` or fallback
    const addr = parseAddress(f.address || f.standardized_address)

    const nome = formatStringVal(f.name)
    const cnpj = formatStringVal(f.cnpj)
    const cidade = formatStringVal(f.city)
    const estado = formatStringVal(f.state)
    const cep = formatStringVal(addr.cep)
    const logradouro = formatStringVal(addr.logradouro)
    const numero = formatStringVal(addr.numero)
    const bairro = formatStringVal(addr.bairro)
    const telefone = formatStringVal(f.contactPhone)
    const email = formatStringVal(f.contact_email)
    const gestorTecnico = formatStringVal(f.gestor_tecnico_name || f.technicalManagerName)
    const vendedor = formatStringVal(f.vendedor_name || f.salesOwnerName)
    const statusFunil = formatStringVal(
      f.status_funil || (typeof f.funnelStage === 'string' ? f.funnelStage : ''),
    )
    const valorPotencial = formatCurrencyBR(f.potentialValue)
    const precisaoGeocode = formatStringVal(f.geocode_precision)
    const statusEndereco = formatStringVal(f.address_status)
    const enriquecidoEm = formatDateBR(f.enriched_at)

    const rowValues = [
      nome,
      cnpj,
      cidade,
      estado,
      cep,
      logradouro,
      numero,
      bairro,
      telefone,
      email,
      gestorTecnico,
      vendedor,
      statusFunil,
      valorPotencial,
      precisaoGeocode,
      statusEndereco,
      enriquecidoEm,
    ]

    return rowValues.map(escapeCsvCell).join(';')
  })

  return [headers.join(';'), ...rows].join('\r\n')
}

/**
 * Triggers CSV file download in browser
 */
export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/**
 * Generates and downloads the clients CSV
 * File name: clientes-export-YYYY-MM-DD.csv
 */
export function exportClientsToCSV(factories: Factory[]): { filename: string; count: number } {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const filename = `clientes-export-${yyyy}-${mm}-${dd}.csv`

  const csv = generateClientsCSV(factories)
  downloadCSV(filename, csv)

  return {
    filename,
    count: factories.length,
  }
}
