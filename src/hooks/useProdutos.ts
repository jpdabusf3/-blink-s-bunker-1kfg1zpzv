import { useState, useEffect, useCallback, useRef } from 'react'
import {
  produtosService,
  type Produto,
  type ProdutoFormData,
  type ProdutoUpdateFormData,
} from '@/services/produtos-service'

export interface UseProdutosReturn {
  produtos: Produto[]
  loading: boolean
  error: string | null
  totalPages: number
  currentPage: number
  totalItems: number
  search: string
  filterCategoria: string
  filterLinha: string
  showInactive: boolean
  loadProdutos: () => Promise<void>
  createProduto: (data: ProdutoFormData) => Promise<Produto>
  updateProduto: (id: string, data: ProdutoUpdateFormData) => Promise<Produto>
  deactivateProduto: (id: string) => Promise<Produto>
  setPage: (page: number) => void
  setSearch: (search: string) => void
  setFilterCategoria: (categoria: string) => void
  setFilterLinha: (linha: string) => void
  toggleShowInactive: () => void
}

export function useProdutos(): UseProdutosReturn {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [search, setSearch] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')
  const [filterCategoria, setFilterCategoria] = useState<string>('All')
  const [filterLinha, setFilterLinha] = useState<string>('All')
  const [showInactive, setShowInactive] = useState<boolean>(false)

  // Debounce de busca de 300ms
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // resetar página ao buscar
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search])

  const loadProdutos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await produtosService.listProdutos({
        page: currentPage,
        perPage: 20,
        search: debouncedSearch,
        categoria: filterCategoria,
        linha: filterLinha,
        showInactive,
      })
      setProdutos(res.items)
      setTotalPages(res.totalPages || 1)
      setTotalItems(res.totalItems || 0)
    } catch (err: unknown) {
      console.error('Erro ao carregar produtos:', err)
      setError('Erro ao carregar produtos.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearch, filterCategoria, filterLinha, showInactive])

  useEffect(() => {
    loadProdutos()
  }, [loadProdutos])

  const handleCreateProduto = async (data: ProdutoFormData): Promise<Produto> => {
    const created = await produtosService.createProduto(data)
    await loadProdutos()
    return created
  }

  const handleUpdateProduto = async (id: string, data: ProdutoUpdateFormData): Promise<Produto> => {
    const updated = await produtosService.updateProduto(id, data)
    await loadProdutos()
    return updated
  }

  const handleDeactivateProduto = async (id: string): Promise<Produto> => {
    const deactivated = await produtosService.deactivateProduto(id)
    await loadProdutos()
    return deactivated
  }

  const toggleShowInactive = () => {
    setShowInactive((prev) => !prev)
    setPage(1)
  }

  const handleSetFilterCategoria = (cat: string) => {
    setFilterCategoria(cat)
    setPage(1)
  }

  const handleSetFilterLinha = (lin: string) => {
    setFilterLinha(lin)
    setPage(1)
  }

  return {
    produtos,
    loading,
    error,
    totalPages,
    currentPage,
    totalItems,
    search,
    filterCategoria,
    filterLinha,
    showInactive,
    loadProdutos,
    createProduto: handleCreateProduto,
    updateProduto: handleUpdateProduto,
    deactivateProduto: handleDeactivateProduto,
    setPage,
    setSearch,
    setFilterCategoria: handleSetFilterCategoria,
    setFilterLinha: handleSetFilterLinha,
    toggleShowInactive,
  }
}

export default useProdutos
