import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'

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
 * expected by the backend: nome, CNPJ, espécie, cidade, estado, contato,
 * status_contato, funil (etapa), valor, gestor, vendedor.
 */
export function downloadImportTemplate(): void {
  const template = [
    {
      nome: 'Exemplo Indústria',
      CNPJ: '12.345.678/0001-90',
      especie: 'Ruminantes',
      cidade: 'São Paulo',
      estado: 'SP',
      contato: '(11) 99999-9999',
      status_contato: 'Decisor',
      funil: 'prospeccao',
      valor: 50000,
      gestor: 'Rodrigo Garginal',
      vendedor: 'Felipe Leão',
    },
    {
      nome: 'Exemplo Distribuidor',
      CNPJ: '98.765.432/0001-10',
      especie: 'Aves',
      cidade: 'Cascavel',
      estado: 'PR',
      contato: '(45) 98888-7777',
      status_contato: 'Champion',
      funil: 'qualificacao',
      valor: 25000,
      gestor: 'Maria Silva',
      vendedor: 'João Souza',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(template)
  // column widths
  ws['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 8 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo Importação')
  XLSX.writeFile(wb, 'modelo_importacao_clientes.xlsx')
}
