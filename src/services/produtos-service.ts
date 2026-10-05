import pb from '@/lib/pocketbase/client'
import { z } from 'zod'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

/**
 * Códigos canônicos das famílias de produtos Blink:
 * MI-XS → Blends
 * MO-BE → Mos/BetaLink
 * MY-CO → Mycolink
 * MI-OR → Minerais Orgânicos
 * MY-ST → Leveduras
 */
export const FAMILIAS_CATALOGO = ['MI-XS', 'MO-BE', 'MY-CO', 'MI-OR', 'MY-ST'] as const

export type FamiliaCatalogo = (typeof FAMILIAS_CATALOGO)[number]

/**
 * Rótulos das famílias em português
 */
export const FAMILIA_ROTULOS: Record<FamiliaCatalogo, string> = {
  'MI-XS': 'Blends',
  'MO-BE': 'Mos/BetaLink',
  'MY-CO': 'Mycolink',
  'MI-OR': 'Minerais Orgânicos',
  'MY-ST': 'Leveduras',
}

/**
 * Obter rótulo formatado da família (ex: "MI-XS · Blends" ou "Blends")
 */
export function formatarFamilia(familia?: string | null, includeCode = true): string {
  if (!familia) return ''
  const rotulo = FAMILIA_ROTULOS[familia as FamiliaCatalogo]
  if (!rotulo) return familia
  return includeCode ? `${familia} · ${rotulo}` : rotulo
}

/**
 * Mapeamento de prefixos completos e curtos para o CÓDIGO CANÔNICO da família
 * Prefixo de código:
 * BBMI.XS... → MI-XS
 * BBMO.BE... → MO-BE
 * BBMY.CO... → MY-CO
 * BPMI.OR... → MI-OR
 * BPMY.ST... → MY-ST
 */
export const PREFIXO_PARA_FAMILIA: Record<string, FamiliaCatalogo> = {
  'BBMI.XS': 'MI-XS',
  'BBMO.BE': 'MO-BE',
  'BBMY.CO': 'MY-CO',
  'BPMI.OR': 'MI-OR',
  'BPMY.ST': 'MY-ST',
  // Fallbacks para prefixos de 4 caracteres
  BBMI: 'MI-XS',
  BBMO: 'MO-BE',
  BBMY: 'MY-CO',
  BPMI: 'MI-OR',
  BPMY: 'MY-ST',
}

/**
 * Mapeamento reverso/compatibilidade para converter nomes legados em códigos canônicos
 */
export const FAMILIA_LEGACY_PARA_CODIGO: Record<string, FamiliaCatalogo> = {
  BLENDS: 'MI-XS',
  'MOS/BETALINK': 'MO-BE',
  ADITIVOS: 'MO-BE',
  MYCOLINK: 'MY-CO',
  ADSORVENTES: 'MY-CO',
  'MINERAIS ORGÂNICOS': 'MI-OR',
  'MINERAIS ORGANICOS': 'MI-OR',
  LEVEDURAS: 'MY-ST',
  SUPLEMENTOS: 'MY-ST',
}

/**
 * Normaliza qualquer valor de família (legado ou código) para o código canônico
 */
export function normalizarFamilia(familia?: string | null, codigo?: string | null): string {
  if (codigo) {
    const derivada = derivarFamiliaPorCodigo(codigo)
    if (derivada) return derivada
  }
  if (!familia) return ''
  const upper = familia.trim().toUpperCase()
  if (FAMILIA_ROTULOS[upper as FamiliaCatalogo]) {
    return upper
  }
  if (FAMILIA_LEGACY_PARA_CODIGO[upper]) {
    return FAMILIA_LEGACY_PARA_CODIGO[upper]
  }
  return familia
}

/**
 * Calcula o código canônico da família automaticamente a partir do código do produto.
 * Não digitada pelo usuário.
 */
export function derivarFamiliaPorCodigo(codigo?: string | null): string {
  if (!codigo) return ''
  const clean = codigo.trim().toUpperCase()

  // 1. Tenta correspondência com prefixo composto (ex: BBMI.XS, BBMO.BE, BBMY.CO, BPMI.OR, BPMY.ST)
  for (const [prefixo, famCode] of Object.entries(PREFIXO_PARA_FAMILIA)) {
    if (clean.startsWith(prefixo)) {
      return famCode
    }
  }

  // 2. Fallback pelas 4 primeiras letras antes do ponto
  const partBeforeDot = clean.split('.')[0] || clean.slice(0, 4)
  if (PREFIXO_PARA_FAMILIA[partBeforeDot]) {
    return PREFIXO_PARA_FAMILIA[partBeforeDot]
  }

  return ''
}

export interface Produto {
  id: string
  codigo: string
  nome: string
  familia: string
  categoria?: string
  linha?: string
  ativo?: boolean
  user_id?: string
  createdAt?: string
  updatedAt?: string
  created?: string
  updated?: string
}

export interface ListProdutosParams {
  search?: string
  familia?: string
}

export const ProdutoFormSchema = z.object({
  codigo: z.string().min(1, 'Informe o código').trim(),
  nome: z.string().min(1, 'Informe o nome').trim(),
})

export type ProdutoFormData = z.infer<typeof ProdutoFormSchema>

export const produtosService = {
  /**
   * Deriva a família a partir do código
   */
  derivarFamilia(codigo?: string | null): string {
    return derivarFamiliaPorCodigo(codigo)
  },

  /**
   * Lista todos os produtos com suporte a busca debouncada e filtro por família
   */
  async listAll(params: ListProdutosParams = {}): Promise<Produto[]> {
    try {
      const filters: string[] = []

      // Filtro por Família (se diferente de 'all')
      if (params.familia && params.familia !== 'all') {
        const famEscaped = params.familia.replace(/"/g, '\\"')
        const rotulo = FAMILIA_ROTULOS[params.familia as FamiliaCatalogo]
        const rotuloEscaped = rotulo ? rotulo.replace(/"/g, '\\"') : ''
        if (rotuloEscaped) {
          filters.push(
            `(familia = "${famEscaped}" || familia = "${rotuloEscaped}" || codigo ~ "${famEscaped}")`,
          )
        } else {
          filters.push(`(familia = "${famEscaped}" || codigo ~ "${famEscaped}")`)
        }
      }

      // Filtro por Busca (código OU nome)
      if (params.search && params.search.trim() !== '') {
        const term = params.search.trim().replace(/"/g, '\\"')
        filters.push(`(codigo ~ "${term}" || nome ~ "${term}")`)
      }

      const filterStr = filters.join(' && ')

      // Busca todos os registros (produtos são catálogo de referência, ~40 itens)
      const records = await pb.collection('produtos').getFullList<Produto>({
        filter: filterStr || undefined,
        sort: 'codigo',
      })

      // Normaliza o campo familia para o código canônico
      return records.map((r) => ({
        ...r,
        familia: derivarFamiliaPorCodigo(r.codigo) || normalizarFamilia(r.familia, r.codigo),
        createdAt: r.created || r.createdAt,
        updatedAt: r.updated || r.updatedAt,
      }))
    } catch (err: unknown) {
      console.error('[produtosService] Erro ao listar produtos:', err)
      throw new Error('Não foi possível carregar os produtos')
    }
  },

  /**
   * Verifica se já existe um produto com o mesmo código (exceto ele mesmo se for edição)
   */
  async checkCodigoExistente(codigo: string, excludeId?: string): Promise<boolean> {
    const clean = codigo.trim().toUpperCase()
    if (!clean) return false
    try {
      const records = await pb.collection('produtos').getList<Produto>(1, 1, {
        filter: `codigo = "${clean.replace(/"/g, '\\"')}"`,
      })
      if (records.items.length === 0) return false
      if (excludeId && records.items[0].id === excludeId) return false
      return true
    } catch (err) {
      console.error('[produtosService] Erro ao verificar código:', err)
      return false
    }
  },

  /**
   * Cria um novo produto com derivação automática de família e validação inline de unicidade
   */
  async createProduto(data: ProdutoFormData): Promise<Produto> {
    const cleanCodigo = data.codigo.trim().toUpperCase()
    const cleanNome = data.nome.trim()

    if (!cleanCodigo) {
      throw new Error('Informe o código')
    }
    if (!cleanNome) {
      throw new Error('Informe o nome')
    }

    const jaExiste = await this.checkCodigoExistente(cleanCodigo)
    if (jaExiste) {
      throw new Error('Código já cadastrado')
    }

    const familiaDerivada = derivarFamiliaPorCodigo(cleanCodigo)
    const currentUserId = pb.authStore.model?.id || ''

    const payload: Record<string, any> = {
      codigo: cleanCodigo,
      nome: cleanNome,
      familia: familiaDerivada || undefined,
      ativo: true,
    }
    if (currentUserId) {
      payload.user_id = currentUserId
    }

    try {
      const created = await pb.collection('produtos').create<Produto>(payload)
      notifyDataChanged('produtos')
      return {
        ...created,
        familia: created.familia || familiaDerivada,
        createdAt: created.created,
        updatedAt: created.updated,
      }
    } catch (err: any) {
      console.error('[produtosService] Erro ao criar produto:', err)
      if (err?.message?.includes('UNIQUE') || err?.data?.codigo?.code === 'validation_not_unique') {
        throw new Error('Código já cadastrado')
      }
      throw new Error(err?.message || 'Erro ao cadastrar produto')
    }
  },

  /**
   * Atualiza um produto existente com derivação automática de família e validação inline de unicidade
   */
  async updateProduto(id: string, data: ProdutoFormData): Promise<Produto> {
    const cleanCodigo = data.codigo.trim().toUpperCase()
    const cleanNome = data.nome.trim()

    if (!cleanCodigo) {
      throw new Error('Informe o código')
    }
    if (!cleanNome) {
      throw new Error('Informe o nome')
    }

    const jaExiste = await this.checkCodigoExistente(cleanCodigo, id)
    if (jaExiste) {
      throw new Error('Código já cadastrado')
    }

    const familiaDerivada = derivarFamiliaPorCodigo(cleanCodigo)

    const payload: Record<string, any> = {
      codigo: cleanCodigo,
      nome: cleanNome,
      familia: familiaDerivada || undefined,
    }

    try {
      const updated = await pb.collection('produtos').update<Produto>(id, payload)
      notifyDataChanged('produtos')
      return {
        ...updated,
        familia: updated.familia || familiaDerivada,
        createdAt: updated.created,
        updatedAt: updated.updated,
      }
    } catch (err: any) {
      console.error('[produtosService] Erro ao atualizar produto:', err)
      if (err?.message?.includes('UNIQUE') || err?.data?.codigo?.code === 'validation_not_unique') {
        throw new Error('Código já cadastrado')
      }
      throw new Error(err?.message || 'Erro ao atualizar produto')
    }
  },

  /**
   * Exclui um produto do banco de dados
   */
  async deleteProduto(id: string): Promise<boolean> {
    try {
      const res = await pb.collection('produtos').delete(id)
      notifyDataChanged('produtos')
      return res
    } catch (err: any) {
      console.error('[produtosService] Erro ao excluir produto:', err)
      throw new Error(err?.message || 'Erro ao excluir produto')
    }
  },
}

export default produtosService
