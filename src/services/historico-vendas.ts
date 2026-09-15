import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'

export interface HistoricoVenda {
  id: string
  origem: 'nf' | 'pedido' | string
  numero_documento?: string
  data_documento: string
  mes: string
  ano: number
  trimestre: 'T1' | 'T2' | 'T3' | 'T4' | string
  destinatario_nome: string
  destinatario_uf?: string
  pais?: string
  especie_destino?: string
  canal_vendas?: string
  gestor_tecnico?: string
  vendedor?: string
  produto_codigo?: string
  produto_descricao?: string
  produto_familia?: string
  produto_quantidade?: number
  produto_valor_unitario?: number
  produto_valor_total?: number
  valor_total_nota?: number
  valor_usd?: number
  valor_unitario_usd?: number
  valor_total_nota_usd?: number
  frete_modalidade?: string
  status: 'realizado' | 'projetado' | string
  user_id?: string

  // Compatibilidade retroativa
  data?: string
  cliente?: string
  especie?: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  valor?: number
  observacoes?: string
  atualizado_em?: string
  created: string
  updated: string
  expand?: {
    gestor_tecnico_id?: { id: string; nome: string }
    vendedor_id?: { id: string; nome: string }
    user_id?: { id: string; name: string; email: string }
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

export const MESES_EXTENSO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

export const FAMILIAS_PRODUTO_OPTIONS = [
  'Minerais Orgânicos',
  'Adsorventes',
  'Ingredientes',
  'Prebióticos',
  'Blends',
] as const

export function deriveDateParts(dataStr: string): {
  mes: string
  ano: number
  trimestre: 'T1' | 'T2' | 'T3' | 'T4'
} {
  let d = new Date(dataStr)
  if (isNaN(d.getTime())) {
    d = new Date()
  }
  const monthIdx = d.getUTCMonth()
  const mes = MESES_EXTENSO[monthIdx] || 'janeiro'
  const ano = d.getUTCFullYear() || new Date().getFullYear()
  const qNum = Math.floor(monthIdx / 3) + 1
  const trimestre = `T${qNum}` as 'T1' | 'T2' | 'T3' | 'T4'
  return { mes, ano, trimestre }
}

export function derivePais(ufOrPais?: string): string {
  if (!ufOrPais) return 'Brasil'
  const clean = ufOrPais.trim().toUpperCase()
  if (clean === 'PARAGUAI' || clean === 'PARAGUAY' || clean === 'PY') return 'Paraguai'
  if (clean === 'CHILE' || clean === 'CL') return 'Chile'
  return 'Brasil'
}

export const getHistoricoVendas = () =>
  pb.collection('historico_vendas').getFullList<HistoricoVenda>({
    sort: '-data_documento,-created',
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
  const res = await pb.send<UploadPedidoResult & { campos_ausentes?: string[] }>(
    '/backend/v1/processar-pedido-pdf',
    {
      method: 'POST',
      body: JSON.stringify({ pdfText, rows }),
      headers: { 'Content-Type': 'application/json' },
    },
  )
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'historico_vendas' } }),
      )
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'faturamento' } }))
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'pedidos' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'activity_logs' } }),
      )
    } catch {
      // ignore
    }
  }
  return res
}

export async function uploadPedido(file: File): Promise<UploadPedidoResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Planilha sem abas')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
  })
  const res = await pb.send<UploadPedidoResult>('/backend/v1/upload-pedido', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    headers: { 'Content-Type': 'application/json' },
  })
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'historico_vendas' } }),
      )
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'faturamento' } }))
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'pedidos' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'activity_logs' } }),
      )
    } catch {
      // ignore
    }
  }
  return res
}

export function downloadPedidoModel(): void {
  const template = [
    {
      data: '2026-08-10',
      cliente: 'Exemplo Fazenda',
      especie: 'BOVINO',
      gestor_tecnico: 'Rodrigo Gardinal',
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
