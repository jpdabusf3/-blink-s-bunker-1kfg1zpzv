import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'

export interface HistoricoVenda {
  id: string
  data: string
  cliente: string
  especie: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  canal_vendas?: string
  valor: number
  observacoes?: string
  origem?: string
  atualizado_em?: string
  created: string
  updated: string
  expand?: {
    gestor_tecnico_id?: { id: string; nome: string }
    vendedor_id?: { id: string; nome: string }
  }
}

export interface UploadPedidoResult {
  success: boolean
  importados: number
  erros: Array<{ linha: number; erro: string }>
  total: number
}

export const ESPECIE_OPTIONS = ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA', 'OUTRO'] as const
export const CANAL_VENDAS_OPTIONS = [
  'Direto',
  'Distribuidor',
  'Indústria',
  'Premixera',
  'Cooperativa',
  'Online',
] as const

export const getHistoricoVendas = () =>
  pb.collection('historico_vendas').getFullList<HistoricoVenda>({
    sort: '-data',
    expand: 'gestor_tecnico_id,vendedor_id',
  })

export const createHistoricoVenda = (data: Partial<HistoricoVenda>) =>
  pb.collection('historico_vendas').create(data)

export const updateHistoricoVenda = (id: string, data: Partial<HistoricoVenda>) =>
  pb.collection('historico_vendas').update(id, data)

export const deleteHistoricoVenda = (id: string) => pb.collection('historico_vendas').delete(id)

export async function uploadPedidoPdf(
  pdfText: string,
  rows: Record<string, unknown>[],
): Promise<UploadPedidoResult & { campos_ausentes?: string[] }> {
  return pb.send('/backend/v1/processar-pedido-pdf', {
    method: 'POST',
    body: JSON.stringify({ pdfText, rows }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function uploadPedido(file: File): Promise<UploadPedidoResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Planilha sem abas')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
  })
  return pb.send('/backend/v1/upload-pedido', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function downloadPedidoModel(): void {
  const template = [
    {
      data: '2026-08-10',
      cliente: 'Exemplo Fazenda',
      especie: 'BOVINO',
      gestor_tecnico: 'Rodrigo Garginal',
      vendedor: 'Felipe Leão',
      canal_vendas: 'Direto',
      valor: 15000.5,
      observacoes: 'Pedido de exemplo',
      linhas_portfolio: 'Adsorventes; Prebióticos',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo')
  XLSX.writeFile(wb, 'modelo_pedido.xlsx')
}
