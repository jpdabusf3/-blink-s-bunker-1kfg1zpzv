import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Factory } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isStale(dateStr: string) {
  if (!dateStr) return false
  const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 15
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
