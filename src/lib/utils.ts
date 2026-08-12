import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Factory } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeArray(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    if (val.startsWith('[') && val.endsWith(']')) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parsed
      } catch {
        /* intentionally ignored */
      }
    }
    return val
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean)
  }
  return [String(val)]
}

export function isStale(dateStr?: string) {
  if (!dateStr) return false
  const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 15
}

export function isApproachingDeadline(dateStr?: string) {
  if (!dateStr) return false
  const diffTime = new Date(dateStr).getTime() - new Date().getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 7
}

export function isPassedDeadline(dateStr?: string) {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < new Date().getTime()
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDateTime(value: string | number | Date) {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCompactCurrency(value: number) {
  const isNegative = value < 0
  const absValue = Math.abs(value)
  let formatted = ''

  if (absValue >= 1e9) {
    formatted = `R$ ${(absValue / 1e9).toFixed(1).replace('.', ',').replace(',0', '')}B`
  } else if (absValue >= 1e6) {
    formatted = `R$ ${(absValue / 1e6).toFixed(1).replace('.', ',').replace(',0', '')}M`
  } else if (absValue >= 1e3) {
    formatted = `R$ ${(absValue / 1e3).toFixed(1).replace('.', ',').replace(',0', '')}k`
  } else {
    return formatCurrency(value)
  }

  return isNegative ? `-${formatted}` : formatted
}

export function getMatrixScore(matrix: Factory['matrix']) {
  const vals = Object.values(matrix) as number[]
  const sum = vals.reduce((a, b) => a + b, 0)
  return Number((sum / vals.length).toFixed(1))
}

export function getMatrixClassification(score: number) {
  if (score > 8) return 'Alta Prioridade'
  if (score >= 5) return 'Média'
  return 'Baixa'
}

export function exportToCSV(filename: string, rows: any[]) {
  if (!rows || !rows.length) return
  const separator = ','
  const keys = Object.keys(rows[0])
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k]
            cell =
              cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""')
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`
            }
            return cell
          })
          .join(separator)
      })
      .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export function generateGoogleCalendarLink(title: string, description: string, dateStr?: string) {
  const text = encodeURIComponent(title)
  const details = encodeURIComponent(description)

  let dates = ''
  if (dateStr) {
    const d = new Date(dateStr)
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')

    const nextD = new Date(d)
    nextD.setUTCDate(nextD.getUTCDate() + 1)
    const nextYyyy = nextD.getUTCFullYear()
    const nextMm = String(nextD.getUTCMonth() + 1).padStart(2, '0')
    const nextDd = String(nextD.getUTCDate()).padStart(2, '0')

    dates = `&dates=${yyyy}${mm}${dd}/${nextYyyy}${nextMm}${nextDd}`
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}${dates}`
}

export function generateOutlookCalendarLink(title: string, description: string, dateStr?: string) {
  const subject = encodeURIComponent(title)
  const body = encodeURIComponent(description)

  let startdt = ''
  let enddt = ''
  if (dateStr) {
    const d = new Date(dateStr)
    startdt = d.toISOString()
    const nextD = new Date(d)
    nextD.setUTCDate(nextD.getUTCDate() + 1)
    enddt = nextD.toISOString()
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${subject}&body=${body}&startdt=${startdt}&enddt=${enddt}&allday=true`
}
