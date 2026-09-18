import type { Factory } from '@/types'
import {
  exportCorporateExcel,
  formatDataBR,
  formatMoedaBRL,
  getLoggedUserName,
  type ExcelColumnDef,
} from './corporateDocuments'

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

  const withoutCep = raw
    .replace(
      /\bCEP:?\s*\d{2}\.?\d{3}-?\d{3}\b|\bCEP:?\s*\d{8}\b|\b\d{2}\.?\d{3}-?\d{3}\b|\b\d{8}\b/gi,
      '',
    )
    .trim()

  const parts = withoutCep
    .split(/[,;\-–—]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (parts.length > 0) {
    result.logradouro = parts[0]
  }

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

  if (parts.length >= 3) {
    if (/^\d+|s\/n|sn$/i.test(parts[1])) {
      result.bairro = parts[2]
    } else if (parts.length >= 2 && !result.bairro) {
      result.bairro = parts[parts.length - 1]
    }
  } else if (parts.length === 2 && !result.bairro) {
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
  return formatDataBR(dateVal)
}

/**
 * Format currency to R$ 1.234,56 (or "-" if null/undefined)
 */
export function formatCurrencyBR(value?: number | null): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '—'
  }
  return formatMoedaBRL(Number(value))
}

/**
 * Replaces null, undefined, empty strings or purely whitespace values with "-"
 */
export function formatStringVal(val?: string | null): string {
  if (val === null || val === undefined) return '—'
  const s = String(val).trim()
  return s.length > 0 ? s : '—'
}

/**
 * Gera conteúdo CSV tradicional com cabeçalhos em maiúsculo (retrocompatibilidade)
 */
export function generateClientsCSV(factories: Factory[]): string {
  const headers = [
    'Razão Social / Nome',
    'CNPJ',
    'Cidade',
    'Estado (UF)',
    'CEP',
    'Logradouro',
    'Número',
    'Bairro',
    'Telefone de Contato',
    'E-mail Corporativo',
    'Gestor Técnico',
    'Vendedor Responsável',
    'Status no Funil',
    'Valor Potencial Estimado (R$)',
    'Precisão do Geocode',
    'Status do Endereço',
    'Data de Enriquecimento',
  ]

  const escapeCsv = (val: string) => {
    const s = String(val ?? '')
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = factories.map((f) => {
    const addr = parseAddress(f.address || f.standardized_address)
    return [
      formatStringVal(f.name),
      formatStringVal(f.cnpj),
      formatStringVal(f.city),
      formatStringVal(f.state),
      formatStringVal(addr.cep),
      formatStringVal(addr.logradouro),
      formatStringVal(addr.numero),
      formatStringVal(addr.bairro),
      formatStringVal(f.contactPhone),
      formatStringVal(f.contact_email),
      formatStringVal(f.gestor_tecnico_name || f.technicalManagerName),
      formatStringVal(f.vendedor_name || f.salesOwnerName),
      formatStringVal(f.status_funil || (typeof f.funnelStage === 'string' ? f.funnelStage : '')),
      formatCurrencyBR(f.potentialValue),
      formatStringVal(f.geocode_precision),
      formatStringVal(f.address_status),
      formatDateBR(f.enriched_at),
    ]
      .map(escapeCsv)
      .join(';')
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
 * Exporta a carteira de clientes para planilha Excel corporativa (.xlsx)
 * com cabeçalhos formais, título executivo e rodapé de totais.
 */
export function exportClientsToCSV(factories: Factory[]): { filename: string; count: number } {
  const columns: ExcelColumnDef[] = [
    { key: 'nome', label: 'Razão Social / Nome do Cliente', width: 34 },
    { key: 'cnpj', label: 'CNPJ', width: 22 },
    { key: 'cidade', label: 'Cidade', width: 18 },
    { key: 'estado', label: 'UF', width: 8 },
    { key: 'cep', label: 'CEP', width: 14 },
    { key: 'logradouro', label: 'Logradouro', width: 26 },
    { key: 'numero', label: 'Número', width: 12 },
    { key: 'bairro', label: 'Bairro', width: 18 },
    { key: 'telefone', label: 'Telefone Corporativo', width: 18 },
    { key: 'email', label: 'E-mail Comercial', width: 26 },
    { key: 'gestorTecnico', label: 'Gestor Técnico Responsável', width: 24 },
    { key: 'vendedor', label: 'Vendedor Responsável', width: 24 },
    { key: 'statusFunil', label: 'Status no Funil Comercial', width: 18 },
    { key: 'valorPotencial', label: 'Valor Potencial Anual (R$)', width: 22, isCurrency: true },
    { key: 'precisaoGeocode', label: 'Precisão Geocode', width: 16 },
    { key: 'statusEndereco', label: 'Status do Endereço', width: 16 },
    { key: 'enriquecidoEm', label: 'Data de Enriquecimento', width: 16 },
  ]

  let somaPotencial = 0

  const rows = factories.map((f) => {
    const addr = parseAddress(f.address || f.standardized_address)
    const pot = Number(f.potentialValue || 0)
    somaPotencial += pot

    return {
      nome: formatStringVal(f.name),
      cnpj: formatStringVal(f.cnpj),
      cidade: formatStringVal(f.city),
      estado: formatStringVal(f.state),
      cep: formatStringVal(addr.cep),
      logradouro: formatStringVal(addr.logradouro),
      numero: formatStringVal(addr.numero),
      bairro: formatStringVal(addr.bairro),
      telefone: formatStringVal(f.contactPhone),
      email: formatStringVal(f.contact_email),
      gestorTecnico: formatStringVal(f.gestor_tecnico_name || f.technicalManagerName),
      vendedor: formatStringVal(f.vendedor_name || f.salesOwnerName),
      statusFunil: formatStringVal(
        f.status_funil || (typeof f.funnelStage === 'string' ? f.funnelStage : ''),
      ),
      valorPotencial: pot,
      precisaoGeocode: formatStringVal(f.geocode_precision),
      statusEndereco: formatStringVal(f.address_status),
      enriquecidoEm: formatDateBR(f.enriched_at),
    }
  })

  exportCorporateExcel({
    slug: 'carteira-clientes',
    metadata: {
      titulo: 'Carteira de Clientes e Indústrias Homologadas',
      subtitulo: 'Cadastro comercial consolidado com localização e enriquecimento de dados',
      origem: 'Base Cadastral de Clientes (/cadastro)',
      periodo: 'Consolidado Geral',
      geradoPor: getLoggedUserName(),
      totalizacoes: [
        { label: 'VALOR POTENCIAL TOTAL ESTIMADO (R$):', valor: somaPotencial },
        {
          label: 'TICKET MÉDIO POTENCIAL (R$):',
          valor: factories.length > 0 ? somaPotencial / factories.length : 0,
        },
      ],
    },
    columns,
    rows,
  })

  const filename = `carteira-clientes-geral-${new Date().toISOString().slice(0, 10)}.xlsx`

  return {
    filename,
    count: factories.length,
  }
}
