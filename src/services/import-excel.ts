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
  erros: ImportError[]
  total: number
}

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

export function downloadImportTemplate(): void {
  const template = [
    {
      nome: 'Exemplo Indústria',
      tipo: 'Prospecto',
      cnpj: '12.345.678/0001-90',
      carteira: 'RUMINANTES',
      grupo_cliente: 'Indústrias',
      cidade: 'São Paulo',
      estado: 'SP',
      telefone: '(11) 99999-9999',
      email: 'contato@exemplo.com',
      etapa_funil: 'prospeccao',
      valor_potencial: 50000,
      observacoes: 'Cliente em potencial',
      gestor_tecnico: 'Rodrigo Garginal',
      vendedor: 'Felipe Leão',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  XLSX.writeFile(wb, 'template_importacao.xlsx')
}
