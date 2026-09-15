import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'

export interface FunilImportResult {
  success: boolean
  criados: number
  atualizados: number
  descartados: number
  erros: { cliente: string; erro: string }[]
  total: number
}

export async function importFunil(file: File): Promise<FunilImportResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Planilha sem abas')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
  })
  const res = await pb.send<FunilImportResult>('/backend/v1/importar-funil', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    headers: { 'Content-Type': 'application/json' },
  })
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'funnel_activity_log' } }),
      )
    } catch {
      // ignore
    }
  }
  return res
}
