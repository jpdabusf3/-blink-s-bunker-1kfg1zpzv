/**
 * Exportador CSV para a tela de Dashboard (Blink Biotech)
 *
 * Colunas obrigatórias da especificação:
 * - Cliente (cliente_nome / clientName)
 * - Cidade (cidade / city)
 * - Estado (estado / state)
 * - Segmento (segmento / sector)
 * - Família de Produtos (familia_produto / productFamily)
 * - Data do Pedido (data_pedido / orderDate formatada como DD/MM/YYYY)
 * - Mês de Entrega (mes_entrega formatada como MM/YYYY se for apenas mês)
 * - Quantidade (quantidade)
 * - Valor Total (valor_total formatado como R$ 1.234,56 com vírgula decimal)
 *
 * Regras:
 * - Separador ponto e vírgula (;)
 * - Escape de campos contendo ; aspas ou nova linha
 * - UTF-8 com BOM (\uFEFF) para correta abertura no Excel
 * - Nome do arquivo: dashboard-vendas-YYYY-MM-DD.csv
 * - Vendedor canônico: João Figueiredo (João Pedro -> João Figueiredo)
 */

export interface DashboardSalesExportRow {
  cliente: string
  cidade: string
  estado: string
  segmento: string
  familiaProduto: string
  dataPedido: string // DD/MM/YYYY
  mesEntrega: string // MM/YYYY
  quantidade: number | string
  valorTotal: number
}

function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return ''
  const str = String(val).trim()
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function formatCurrencyBRL(val: number | undefined | null): string {
  const num = Number(val || 0)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDateDDMMYYYY(dateVal: string | Date | undefined | null): string {
  if (!dateVal) return ''
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) {
      // Se já estiver no formato YYYY-MM-DD
      const str = String(dateVal).split('T')[0]
      const parts = str.split('-')
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
      return String(dateVal)
    }
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const year = d.getUTCFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return String(dateVal)
  }
}

export function formatMonthDelivery(val: string | number | undefined | null): string {
  if (!val) return ''
  const str = String(val).trim()
  // Se for "2024-05" ou "05/2024" ou número do mês ou data ISO
  if (/^\d{4}-\d{2}/.test(str)) {
    const [y, m] = str.split('-')
    return `${m}/${y}`
  }
  if (/^\d{2}\/\d{4}$/.test(str)) {
    return str
  }
  if (/^\d{1,2}$/.test(str)) {
    const m = String(str).padStart(2, '0')
    const currentYear = new Date().getFullYear()
    return `${m}/${currentYear}`
  }
  try {
    const d = new Date(str)
    if (!isNaN(d.getTime())) {
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const y = d.getUTCFullYear()
      return `${m}/${y}`
    }
  } catch {
    // fallback
  }
  return str
}

export function generateDashboardSalesCSV(rows: DashboardSalesExportRow[]): string {
  const headers = [
    'Cliente',
    'Cidade',
    'Estado',
    'Segmento',
    'Família de Produtos',
    'Data do Pedido',
    'Mês de Entrega',
    'Quantidade',
    'Valor Total',
  ]

  const csvRows = rows.map((r) => {
    return [
      escapeCsvField(r.cliente),
      escapeCsvField(r.cidade),
      escapeCsvField(r.estado),
      escapeCsvField(r.segmento),
      escapeCsvField(r.familiaProduto),
      escapeCsvField(r.dataPedido),
      escapeCsvField(r.mesEntrega),
      escapeCsvField(r.quantidade),
      escapeCsvField(formatCurrencyBRL(r.valorTotal)),
    ].join(';')
  })

  return [headers.join(';'), ...csvRows].join('\r\n')
}

export function downloadDashboardSalesCSV(filename: string, csvContent: string): void {
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
