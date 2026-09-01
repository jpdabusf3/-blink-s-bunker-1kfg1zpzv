import pb from '@/lib/pocketbase/client'

export interface NfeItem {
  codigo: string
  nome: string
  ncm?: string
  cst?: string
  cfop?: string
  unidade?: string
  quantidade: number
  preco_unitario: number
  valor_total: number
  lote?: string
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
  // Dados da nota
  numero_nf: string
  serie_nf?: string
  chave_acesso?: string
  natureza_operacao?: string
  protocolo_autorizacao?: string
  data_emissao: string
  data_entrada_saida?: string
  hora_saida?: string

  // Emitente
  emitente_nome?: string
  emitente_cnpj?: string
  emitente_inscricao_estadual?: string
  emitente_endereco?: string

  // Destinatário / Cliente
  cliente_nome: string
  cliente_cnpj?: string
  cliente_municipio?: string
  cliente_cidade?: string
  cliente_uf?: string
  cliente_endereco?: string
  cliente_bairro_distrito?: string
  cliente_cep?: string
  cliente_inscricao_estadual?: string
  cliente_fone?: string

  factory_id?: string
  especie: string
  canal_vendas: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  itens: NfeItem[]

  // Impostos e valores
  base_calculo_icms?: number
  impostos_icms_base?: number
  aliquota_icms?: number
  impostos_icms_aliquota?: number
  valor_icms?: number
  impostos_icms_valor?: number
  base_calculo_icms_st?: number
  impostos_icms_st_base?: number
  valor_icms_st?: number
  impostos_icms_st_valor?: number
  valor_total_produtos?: number
  valor_produtos?: number
  valor_frete?: number
  frete_valor?: number
  frete_percentual?: number
  valor_seguro?: number
  desconto?: number
  outras_despesas?: number
  valor_ipi?: number
  impostos_ipi_valor?: number
  valor_total: number
  valor_total_nota?: number
  valor_aproximado_tributos?: number
  impostos_pis_aliquota?: number
  impostos_pis_valor?: number
  impostos_cofins_aliquota?: number
  impostos_cofins_valor?: number
  impostos_total?: number

  // Fatura / Duplicatas
  fatura_numero?: string
  fatura_vencimento?: string
  fatura_valor?: number

  // Frete / Transporte
  frete_modalidade?: string
  modalidade_frete?: string
  volumes?: string
  peso_bruto?: number
  peso_liquido?: number

  // Observações
  ordem_compra?: string
  observacoes?: string

  status: NfeStatus
  motivo_pendencia?: string
  aprovado_por?: string
  aprovado_em?: string
  arquivo_nome?: string
  raw_text?: string
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
  nome_curto?: string
  familia?: string
  linha?: string
  especie_destino?: string
  unidade_medida?: string
  preco_base?: number
  especie_padrao?: string
  ativo: boolean
  user_id?: string
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

  try {
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
    if (matches.length > 5) {
      const textStream = matches.map((m) => m.slice(1, -1)).join(' ')
      if (textStream.trim().length > 30) return textStream
    }
    return raw.substring(0, 16000)
  } catch {
    return ''
  }
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

export async function processarNfeExcel(
  rows: Record<string, unknown>[],
): Promise<ProcessarNfeResponse> {
  return pb.send('/backend/v1/nfe/processar-pdf', {
    method: 'POST',
    body: JSON.stringify({ excelRows: rows }),
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

export function downloadModeloNfeExcel(): void {
  import('xlsx').then((XLSX) => {
    const template = [
      {
        // Dados da Nota
        chave_acesso: '4126 0838 3486 3800 0433 5500 1000 0003 2216 4814 4744',
        numero_nf: '322',
        serie: '1',
        natureza_operacao: 'S-Venda Mercadoria',
        protocolo_autorizacao: '141260348963840 - 31/08/2026 19:09:42',
        data_emissao: '31/08/2026',
        data_entrada_saida: '31/08/2026',
        hora_saida: '19:09:00',

        // Emitente
        emitente_razao_social: 'BLINK BIOSCIENCE BRASIL LTDA.',
        emitente_cnpj: '38.348.638/0004-33',
        emitente_inscricao_estadual: '9118131816',
        emitente_endereco:
          'Avenida Melvim Jones, 440 - Lte 211 - Parque Industrial Bandeirantes, Maringa - PR, CEP 87.070-030',

        // Destinatário/Cliente
        cliente_razao_social: 'Nuttria Nutricao Animal Ltda.',
        cliente_cnpj: '29.133.749/0001-99',
        cliente_municipio: 'Mirassol',
        cliente_uf: 'SP',
        cliente_endereco: 'RUA Feliciano Sales Cunha, Km 455',
        cliente_bairro_distrito: 'Zona Rural',
        cliente_cep: '15.138-899',
        cliente_inscricao_estadual: '1735200800',
        cliente_fone: '451086290112',

        // Impostos e valores
        base_calculo_icms: 9000.0,
        valor_icms: 360.0,
        aliquota_icms: 4.0,
        base_calculo_icms_st: 0.0,
        valor_icms_st: 0.0,
        valor_total_produtos: 8550.0,
        valor_frete: 450.0,
        valor_seguro: 0.0,
        desconto: 0.0,
        outras_despesas: 0.0,
        valor_ipi: 0.0,
        valor_total_nota: 9000.0,
        valor_aproximado_tributos: 360.0,

        // Fatura/Duplicatas
        fatura_numero: '001',
        fatura_vencimento: '28/09/2026',
        fatura_valor: 9000.0,

        // Frete/Transporte
        modalidade_frete: 'CIF',
        volumes: '1 palete',
        peso_bruto: 335.0,
        peso_liquido: 300.0,

        // Itens de produto
        codigo_produto: 'BPMI.OR015',
        descricao_produto: 'Blink Copper 22 - SC',
        ncm: '2309.90.90',
        cst: '100',
        cfop: '6102',
        unidade: 'KG',
        quantidade: 300.0,
        valor_unitario: 28.5,
        valor_total_item: 8550.0,
        lote: 'B2026012002MIOR.Cu22 Qtde: 300,00',

        // Observações
        ordem_compra: 'ORDEM DE COMPRA 15040',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo NF-e Padrão')
    XLSX.writeFile(wb, 'modelo_nota_fiscal_padrao_nfe.xlsx')
  })
}
