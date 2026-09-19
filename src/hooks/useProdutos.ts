import { useState, useEffect, useCallback, useRef } from 'react'
import { produtosService, type Produto, type ProdutoFormData } from '@/services/produtos-service'

export interface UseProdutosReturn {
  produtos: Produto[]
  loading: boolean
  error: boolean
  errorMessage: string | null
  searchTerm: string
  debouncedSearch: string
  familiaFilter: string
  loadProdutos: () => Promise<void>
  createProduto: (data: ProdutoFormData) => Promise<Produto>
  updateProduto: (id: string, data: ProdutoFormData) => Promise<Produto>
  deleteProduto: (id: string) => Promise<boolean>
  setSearchTerm: (search: string) => void
  setFamiliaFilter: (familia: string) => void
}

export function useProdutos(): UseProdutosReturn {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [familiaFilter, setFamiliaFilter] = useState<string>('all')

  // Debounce de 300ms para a busca
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  const loadProdutos = useCallback(async () => {
    setLoading(true)
    setError(false)
    setErrorMessage(null)
    try {
      const items = await produtosService.listAll({
        search: debouncedSearch,
        familia: familiaFilter,
      })
      setProdutos(items)
    } catch (err: unknown) {
      console.error('[useProdutos] Erro ao carregar produtos:', err)
      setError(true)
      setErrorMessage('Não foi possível carregar os produtos')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, familiaFilter])

  useEffect(() => {
    loadProdutos()
  }, [loadProdutos])

  const handleCreateProduto = async (data: ProdutoFormData): Promise<Produto> => {
    const created = await produtosService.createProduto(data)
    await loadProdutos()
    return created
  }

  const handleUpdateProduto = async (id: string, data: ProdutoFormData): Promise<Produto> => {
    const updated = await produtosService.updateProduto(id, data)
    await loadProdutos()
    return updated
  }

  const handleDeleteProduto = async (id: string): Promise<boolean> => {
    const res = await produtosService.deleteProduto(id)
    await loadProdutos()
    return res
  }

  return {
    produtos,
    loading,
    error,
    errorMessage,
    searchTerm,
    debouncedSearch,
    familiaFilter,
    loadProdutos,
    createProduto: handleCreateProduto,
    updateProduto: handleUpdateProduto,
    deleteProduto: handleDeleteProduto,
    setSearchTerm,
    setFamiliaFilter,
  }
}

export default useProdutos
