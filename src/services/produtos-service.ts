import pb from '@/lib/pocketbase/client'
import { z } from 'zod'

export const CATEGORIAS_PRODUTO = [
  'Mycotoxin Binders',
  'Yeast Derivatives',
  'Organic Minerals',
  'Yeast Cell Wall',
  'Blends',
] as const

export type CategoriaProduto = (typeof CATEGORIAS_PRODUTO)[number]

export const LINHAS_PRODUTO = ['MOS', 'Mycotoxin', 'Minerals', 'Yeast', 'Blend'] as const

export type LinhaProduto = (typeof LINHAS_PRODUTO)[number]

export interface Produto {
  id: string
  codigo: string
  nome: string
  categoria: CategoriaProduto | string
  linha: LinhaProduto | string
  ativo: boolean
  user_id?: string
  created?: string
  updated?: string
}

export interface ListProdutosParams {
  page?: number
  perPage?: number
  search?: string
  categoria?: string
  linha?: string
  showInactive?: boolean
}

export interface ListProdutosResponse {
  items: Produto[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
}

// Regex validação: 3 a 4 letras maiúsculas, '.', 2 letras maiúsculas e 3 dígitos (ex: BBMO.BE001, BPMI.OR001)
export const CODIGO_PRODUTO_REGEX = /^[A-Z]{3,4}\.[A-Z]{2}\d{3}$/

export const ProdutoSchema = z.object({
  codigo: z
    .string()
    .min(1, 'Código é obrigatório')
    .regex(CODIGO_PRODUTO_REGEX, 'Codigo invalido. Use o formato XXXX.XX000.'),
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  categoria: z.enum(CATEGORIAS_PRODUTO, {
    errorMap: () => ({ message: 'Selecione uma categoria válida' }),
  }),
  linha: z.enum(LINHAS_PRODUTO, {
    errorMap: () => ({ message: 'Selecione uma linha válida' }),
  }),
  ativo: z.boolean().default(true),
})

export type ProdutoFormData = z.infer<typeof ProdutoSchema>

export const ProdutoUpdateSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  categoria: z.enum(CATEGORIAS_PRODUTO, {
    errorMap: () => ({ message: 'Selecione uma categoria válida' }),
  }),
  linha: z.enum(LINHAS_PRODUTO, {
    errorMap: () => ({ message: 'Selecione uma linha válida' }),
  }),
  ativo: z.boolean().default(true),
})

export type ProdutoUpdateFormData = z.infer<typeof ProdutoUpdateSchema>

export const produtosService = {
  /**
   * Lista produtos com filtros, busca debouncada e paginação
   */
  async listProdutos(params: ListProdutosParams = {}): Promise<ListProdutosResponse> {
    try {
      const page = params.page || 1
      const perPage = params.perPage || 20
      const filters: string[] = []

      // Filtro ativo
      if (!params.showInactive) {
        filters.push('ativo = true')
      }

      // Filtro Categoria
      if (params.categoria && params.categoria !== 'All' && params.categoria !== 'Todos') {
        filters.push(`categoria = "${params.categoria}"`)
      }

      // Filtro Linha
      if (params.linha && params.linha !== 'All' && params.linha !== 'Todos') {
        filters.push(`linha = "${params.linha}"`)
      }

      // Filtro Busca (codigo OU nome)
      if (params.search && params.search.trim() !== '') {
        const term = params.search.trim().replace(/"/g, '\\"')
        filters.push(`(codigo ~ "${term}" || nome ~ "${term}")`)
      }

      const filterStr = filters.join(' && ')

      // Ordenação padrão: categoria ascendente, depois codigo ascendente
      const res = await pb.collection('produtos').getList<Produto>(page, perPage, {
        filter: filterStr,
        sort: 'categoria,codigo',
      })

      return {
        items: res.items,
        page: res.page,
        perPage: res.perPage,
        totalItems: res.totalItems,
        totalPages: res.totalPages,
      }
    } catch (err: unknown) {
      console.error('Erro ao listar produtos:', err)
      throw new Error('Erro ao carregar produtos.')
    }
  },

  /**
   * Obtém um produto pelo ID
   */
  async getProdutoById(id: string): Promise<Produto> {
    try {
      return await pb.collection('produtos').getOne<Produto>(id)
    } catch (err: unknown) {
      console.error('Erro ao buscar produto por ID:', err)
      throw new Error('Erro ao buscar produto.')
    }
  },

  /**
   * Cria um novo produto com validação de unicidade de código
   */
  async createProduto(data: ProdutoFormData): Promise<Produto> {
    try {
      const validated = ProdutoSchema.parse(data)
      const cleanCodigo = validated.codigo.trim().toUpperCase()

      // Validação de unicidade do código
      try {
        const existing = await pb
          .collection('produtos')
          .getFirstListItem(`codigo = "${cleanCodigo}"`)
        if (existing) {
          throw new Error('Já existe um produto cadastrado com este código.')
        }
      } catch (checkErr: any) {
        if (checkErr?.message?.includes('Já existe um produto')) {
          throw checkErr
        }
        // Se 404 (não encontrou), prossegue normalmente
      }

      const currentUserId = pb.authStore.model?.id || ''
      const payload = {
        codigo: cleanCodigo,
        nome: validated.nome.trim(),
        categoria: validated.categoria,
        linha: validated.linha,
        ativo: validated.ativo,
        user_id: currentUserId,
      }

      return await pb.collection('produtos').create<Produto>(payload)
    } catch (err: unknown) {
      console.error('Erro ao criar produto:', err)
      if (err instanceof z.ZodError) {
        throw new Error(err.errors[0]?.message || 'Dados inválidos.')
      }
      if (err instanceof Error) {
        throw err
      }
      throw new Error('Erro ao cadastrar produto.')
    }
  },

  /**
   * Atualiza um produto existente
   */
  async updateProduto(id: string, data: ProdutoUpdateFormData): Promise<Produto> {
    try {
      const validated = ProdutoUpdateSchema.parse(data)
      const payload = {
        nome: validated.nome.trim(),
        categoria: validated.categoria,
        linha: validated.linha,
        ativo: validated.ativo,
      }
      return await pb.collection('produtos').update<Produto>(id, payload)
    } catch (err: unknown) {
      console.error('Erro ao atualizar produto:', err)
      if (err instanceof z.ZodError) {
        throw new Error(err.errors[0]?.message || 'Dados inválidos.')
      }
      if (err instanceof Error) {
        throw err
      }
      throw new Error('Erro ao atualizar produto.')
    }
  },

  /**
   * Desativação de produto (soft delete: ativo = false)
   */
  async deactivateProduto(id: string): Promise<Produto> {
    try {
      return await pb.collection('produtos').update<Produto>(id, { ativo: false })
    } catch (err: unknown) {
      console.error('Erro ao desativar produto:', err)
      throw new Error('Erro ao desativar produto.')
    }
  },
}

export default produtosService
