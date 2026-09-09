import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'
import { generateClientImportTemplateXlsx } from './xlsx-template'

export interface ImportError {
  linha: number
  erro: string
}

export interface ImportResult {
  success: boolean
  criados: number
  atualizados: number
  duplicatas?: number
  erros: ImportError[]
  total: number
}

/**
 * Parse a .xlsx/.xls/.csv File into an array of row objects (only for preview).
 */
export async function parseExcelPreview(
  file: File,
  maxRows = 10,
): Promise<Record<string, unknown>[]> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Planilha sem abas')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
  })
  return rows.slice(0, maxRows)
}

/**
 * Parse the full file and submit all rows to the backend `importar_excel` hook.
 */
export async function importExcel(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Planilha sem abas')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
  })
  return pb.send('/backend/v1/importar-excel', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Generate and download the standard import template (.xlsx) with the headers
 * expected by the backend: Nome, CNPJ, Espécie, Cidade, Estado, Contato,
 * Status Contato, Funil, Valor, Gestor, Vendedor.
 */

export function downloadImportTemplate(): void {
  const bytes = generateClientImportTemplateXlsx()
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo_importacao_clientes.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
