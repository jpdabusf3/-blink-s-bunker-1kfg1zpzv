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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function importExcel(file: File): Promise<ImportResult> {
  const base64 = await fileToBase64(file)
  if (!base64) throw new Error('Não foi possível ler o arquivo')
  return pb.send<ImportResult>('/backend/v1/importar-excel', {
    method: 'POST',
    body: JSON.stringify({ base64, filename: file.name }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function downloadImportTemplate() {
  const headers = [
    'nome',
    'cnpj',
    'tipo',
    'cidade',
    'estado',
    'telefone',
    'email',
    'etapa_funil',
    'valor_potencial',
    'observacoes',
  ]
  const example = [
    'Fábrica Exemplo Ltda',
    '11.222.333/0001-81',
    'prospecto',
    'São Paulo',
    'SP',
    '(11) 99999-9999',
    'contato@exemplo.com',
    'prospeccao',
    '150000',
    'Cliente em potencial para linha de adsorventes',
  ]
  const csv = [headers.join(';'), example.map((c) => `"${c}"`).join(';')].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo_importacao_blink.csv'
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
