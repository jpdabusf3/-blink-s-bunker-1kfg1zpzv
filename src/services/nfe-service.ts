import pb from '@/lib/pocketbase/client'

export interface NfeItem {
  codigo: string
  nome: string
  unidade?: string
  quantidade: number
  preco_unitario: number
  valor_total: number
  produto_catalogo_id?: string | null
  produto_catalogo_nome?: string | null
  linha_produto?: string
  reconhecido?: boolean
  aliquota_icms?: number
  valor_icms?: number
  aliquota_pis?: number
  valor_pis?: number
  aliquota_cofins?: number
  valor_cofins?: number
}

export type NfeStatus =
  | 'pendente'
  | 'pendencia_produto'
  | 'aprovado'
  | 'rejeitado'
  | 'duplicada_ignorada'

export interface NfePedido {
  id: string
  numero_nf: string
  serie_nf?: string
  chave_acesso?: string
  data_emissao: string
  emitente_nome?: string
  emitente_cnpj?: string
  cliente_nome: string
  cliente_cnpj?: string
  cliente_endereco?: string
  cliente_cidade?: string
  cliente_uf?: string
  factory_id?: string
  especie: string
  canal_vendas: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  itens: NfeItem[]
  valor_produtos?: number
  frete_modalidade?: string
  frete_valor?: number
  frete_percentual?: number
  impostos_icms_base?: number
  impostos_icms_aliquota?: number
  impostos_icms_valor?: number
  impostos_pis_aliquota?: number
  impostos_pis_valor?: number
  impostos_cofins_aliquota?: number
  impostos_cofins_valor?: number
  impostos_ipi_valor?: number
  impostos_total?: number
  valor_total: number
  status: NfeStatus
  motivo_pendencia?: string
  aprovado_por?: string
  aprovado_em?: string
  arquivo_nome?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    factory_id?: { id: string; name: string; city?: string; state?: string }
    gestor_tecnico_id?: { id: string; nome: string }
    vendedor_id?: { id: string; nome: string }
    aprovado_por?: { id: string; name: string }
  }
}

export interface ProdutoCatalogo {
  id: string
  codigo: string
  nome: string
  linha?: string
  unidade_medida?: string
  preco_base?: number
  especie_padrao?: string
  ativo: boolean
  created: string
  updated: string
}

export interface ProcessarNfeResultado {
  id?: string
  arquivo: string
  numero_nf?: string
  cliente?: string
  cnpj?: string
  valor?: number
  itens_count?: number
  status: string
  motivo_pendencia?: string
  mensagem: string
}

export interface ProcessarNfeResponse {
  success: boolean
  importados: number
  pendentes_revisao: number
  pendencias_produto: number
  duplicadas_ignoradas: number
  total: number
  resultados: ProcessarNfeResultado[]
}

export async function extrairTextoPdf(file: File): Promise<string> {
  try {
    const pdfjs: any = await import(/* @vite-ignore */ 'pdfjs-dist/build/pdf.mjs')
    if (pdfjs?.getDocument) {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '4.10.38'}/build/pdf.worker.min.mjs`
      }
      const arrayBuffer = await file.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise
      const pages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const text = content.items
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ')
        pages.push(text)
      }
      const fullText = pages.join('\n')
      if (fullText.trim().length > 30) {
        return fullText
      }
    }
  } catch (err) {
    console.warn('pdfjs-dist fallback triggered:', err)
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let raw = ''
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    if ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) {
      raw += String.fromCharCode(c)
    }
  }

  const matches = raw.match(/\(([^()]{2,})\)/g) || []
  const textStream = matches.map((m) => m.slice(1, -1)).join(' ')
  return textStream || raw.substring(0, 5000)
}

export async function processarNfePdfs(
  arquivos: Array<{ nome: string; texto: string }>,
): Promise<ProcessarNfeResponse> {
  return pb.send('/backend/v1/nfe/processar-pdf', {
    method: 'POST',
    body: JSON.stringify({ arquivos }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function getNfePedidos(status?: NfeStatus | 'all'): Promise<NfePedido[]> {
  const filter = status && status !== 'all' ? `status = "${status}"` : ''
  return pb.collection('nfe_pedidos').getFullList<NfePedido>({
    filter,
    sort: '-created',
    expand: 'factory_id,gestor_tecnico_id,vendedor_id,aprovado_por',
  })
}

export async function getNfePedidoById(id: string): Promise<NfePedido> {
  return pb.collection('nfe_pedidos').getOne<NfePedido>(id, {
    expand: 'factory_id,gestor_tecnico_id,vendedor_id,aprovado_por',
  })
}

export async function aprovarNfePedido(
  id: string,
  dadosEditados?: Partial<NfePedido>,
): Promise<{ success: boolean; nfe_id: string; venda_id: string; mensagem: string }> {
  return pb.send('/backend/v1/nfe/aprovar', {
    method: 'POST',
    body: JSON.stringify({ id, dados: dadosEditados }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function rejeitarNfePedido(
  id: string,
  motivo?: string,
): Promise<{ success: boolean; nfe_id: string; mensagem: string }> {
  return pb.send('/backend/v1/nfe/rejeitar', {
    method: 'POST',
    body: JSON.stringify({ id, motivo }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function excluirNfePedido(id: string): Promise<boolean> {
  return pb.collection('nfe_pedidos').delete(id)
}

export async function atualizarNfePedido(
  id: string,
  dados: Partial<NfePedido>,
): Promise<NfePedido> {
  return pb.collection('nfe_pedidos').update<NfePedido>(id, dados)
}

export async function getProdutosCatalogo(): Promise<ProdutoCatalogo[]> {
  return pb.collection('produtos').getFullList<ProdutoCatalogo>({
    filter: 'ativo = true',
    sort: 'linha,nome',
  })
}

export async function createProdutoCatalogo(
  dados: Partial<ProdutoCatalogo>,
): Promise<ProdutoCatalogo> {
  return pb.collection('produtos').create<ProdutoCatalogo>(dados)
}
