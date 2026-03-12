import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Factory } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
    maximumFractionDigits: 0,
  }).format(value)
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
