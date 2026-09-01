import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  pedidoService,
  type MatrizFiscal,
  type AtribuicaoCliente,
  type PedidoFormData,
  type PedidoCalculoResumo,
} from '@/services/pedidoService'
import type { EquipeMember } from '@/services/equipe'
import type { ProdutoCatalogo } from '@/services/nfe-service'
import { useAuth } from '@/hooks/use-auth'

export interface UsePedidoVendaReturn {
  produtos: ProdutoCatalogo[]
  matrizFiscal: MatrizFiscal | null
  gestoresTecnicos: EquipeMember[]
  vendedores: EquipeMember[]
  atribuicaoCliente: AtribuicaoCliente | null
  calculo: PedidoCalculoResumo
  loading: boolean
  error: string | null
  fetchProdutos: () => Promise<ProdutoCatalogo[]>
  fetchMatrizFiscal: (estado: string, especie: string) => Promise<MatrizFiscal | null>
  fetchGestoresTecnicos: () => Promise<EquipeMember[]>
  fetchVendedores: () => Promise<EquipeMember[]>
  fetchAtribuicaoCliente: (cliente_nome: string) => Promise<AtribuicaoCliente | null>
  calcularPedido: (params: {
    quantidade: number
    preco_liquido: number
    desconto_percent: number
    aliquota_icms: number
    aliquota_pis: number
    aliquota_cofins: number
    modalidade_frete: 'FOB' | 'CIF'
    frete_automatico: boolean
    frete_percentual: number
    frete_valor: number
    impostos_adicionais: number
  }) => PedidoCalculoResumo
  gerarDocumento: (
    pedidoData: PedidoFormData,
  ) => Promise<{ blob: Blob; fileName: string; downloadUrl: string }>
  salvarAtribuicao: (data: {
    cliente_nome: string
    gestor_tecnico_id: string
    vendedor_id: string
    observacoes?: string
  }) => Promise<AtribuicaoCliente>
  createPedido: (pedidoData: PedidoFormData) => Promise<any>
  logPedido: (pedidoData: {
    cliente_nome: string
    produto_nome: string
    gestor_tecnico_nome: string
    vendedor_nome: string
  }) => Promise<void>
}

export function usePedidoVenda(): UsePedidoVendaReturn {
  const { user } = useAuth()
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [gestoresTecnicos, setGestoresTecnicos] = useState<EquipeMember[]>([])
  const [vendedores, setVendedores] = useState<EquipeMember[]>([])
  const [matrizFiscal, setMatrizFiscal] = useState<MatrizFiscal | null>(null)
  const [atribuicaoCliente, setAtribuicaoCliente] = useState<AtribuicaoCliente | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProdutos = useCallback(async () => {
    try {
      const data = await pedidoService.getProdutos()
      setProdutos(data)
      return data
    } catch (err) {
      console.error('Erro ao buscar produtos:', err)
      return []
    }
  }, [])

  const fetchGestoresTecnicos = useCallback(async () => {
    try {
      const data = await pedidoService.getGestoresTecnicos()
      setGestoresTecnicos(data)
      return data
    } catch (err) {
      console.error('Erro ao buscar gestores tecnicos:', err)
      return []
    }
  }, [])

  const fetchVendedores = useCallback(async () => {
    try {
      const data = await pedidoService.getVendedores()
      setVendedores(data)
      return data
    } catch (err) {
      console.error('Erro ao buscar vendedores:', err)
      return []
    }
  }, [])

  const fetchMatrizFiscal = useCallback(async (estado: string, especie: string) => {
    if (!estado || !especie) {
      setMatrizFiscal(null)
      return null
    }
    try {
      const record = await pedidoService.getMatrizFiscal(estado, especie)
      setMatrizFiscal(record)
      return record
    } catch (err) {
      console.error('Erro ao buscar matriz fiscal:', err)
      setMatrizFiscal(null)
      return null
    }
  }, [])

  const fetchAtribuicaoCliente = useCallback(async (cliente_nome: string) => {
    if (!cliente_nome || cliente_nome.trim().length < 2) {
      setAtribuicaoCliente(null)
      return null
    }
    try {
      const rec = await pedidoService.getAtribuicaoCliente(cliente_nome)
      setAtribuicaoCliente(rec)
      return rec
    } catch (err) {
      console.error('Erro ao buscar atribuicao cliente:', err)
      setAtribuicaoCliente(null)
      return null
    }
  }, [])

  // Carregamento inicial de cadastros básicos
  useEffect(() => {
    let mounted = true
    async function init() {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([fetchProdutos(), fetchGestoresTecnicos(), fetchVendedores()])
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Erro ao carregar dados iniciais')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [fetchProdutos, fetchGestoresTecnicos, fetchVendedores])

  /**
   * Cálculo ao vivo do pedido conforme as fórmulas:
   * - Preço Base: quantidade x preco_liquido x (1 - desconto_percent/100)
   * - ICMS: preco_base x aliquota_icms / 100
   * - PIS: preco_base x aliquota_pis / 100
   * - COFINS: preco_base x aliquota_cofins / 100
   * - Frete: se automático, preco_base x freight_percent / 100; se manual, usa frete_valor
   * - Impostos Adicionais: valor do input
   * - Preço FOB: preco_base + ICMS + PIS + COFINS + impostos_adicionais
   * - Preço CIF: preco_fob + frete
   * - Total Geral: preco_cif
   */
  const calcularPedido = useCallback(
    (params: {
      quantidade: number
      preco_liquido: number
      desconto_percent: number
      aliquota_icms: number
      aliquota_pis: number
      aliquota_cofins: number
      modalidade_frete: 'FOB' | 'CIF'
      frete_automatico: boolean
      frete_percentual: number
      frete_valor: number
      impostos_adicionais: number
    }): PedidoCalculoResumo => {
      const qty = Math.max(0, Number(params.quantidade) || 0)
      const precoLiq = Math.max(0, Number(params.preco_liquido) || 0)
      const descPercent = Math.max(0, Math.min(100, Number(params.desconto_percent) || 0))

      const precoBase = qty * precoLiq * (1 - descPercent / 100)
      const icms = (precoBase * (Number(params.aliquota_icms) || 0)) / 100
      const pis = (precoBase * (Number(params.aliquota_pis) || 0)) / 100
      const cofins = (precoBase * (Number(params.aliquota_cofins) || 0)) / 100
      const impostosAdicionais = Number(params.impostos_adicionais) || 0

      let freteCalculado = 0
      if (params.frete_automatico) {
        freteCalculado = (precoBase * (Number(params.frete_percentual) || 0)) / 100
      } else {
        freteCalculado = Number(params.frete_valor) || 0
      }

      const precoFob = precoBase + icms + pis + cofins + impostosAdicionais
      const precoCif = precoFob + freteCalculado
      const totalGeral = precoCif

      return {
        preco_base: precoBase,
        icms_valor: icms,
        pis_valor: pis,
        cofins_valor: cofins,
        frete_valor: freteCalculado,
        frete_percentual: Number(params.frete_percentual) || 0,
        impostos_adicionais: impostosAdicionais,
        preco_fob: precoFob,
        preco_cif: precoCif,
        total_geral: totalGeral,
      }
    },
    [],
  )

  const defaultCalculo = useMemo<PedidoCalculoResumo>(
    () => ({
      preco_base: 0,
      icms_valor: 0,
      pis_valor: 0,
      cofins_valor: 0,
      frete_valor: 0,
      frete_percentual: 0,
      impostos_adicionais: 0,
      preco_fob: 0,
      preco_cif: 0,
      total_geral: 0,
    }),
    [],
  )

  const gerarDocumento = useCallback(async (pedidoData: PedidoFormData) => {
    const blob = await pedidoService.gerarDocumento(pedidoData)
    const safeCliente = (pedidoData.cliente_nome || 'cliente')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 40)
    const fileName = `pedido_venda_${safeCliente}_${new Date().toISOString().slice(0, 10)}.docx`
    const downloadUrl = URL.createObjectURL(blob)

    // Auto download
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    return { blob, fileName, downloadUrl }
  }, [])

  return {
    produtos,
    matrizFiscal,
    gestoresTecnicos,
    vendedores,
    atribuicaoCliente,
    calculo: defaultCalculo,
    loading,
    error,
    fetchProdutos,
    fetchMatrizFiscal,
    fetchGestoresTecnicos,
    fetchVendedores,
    fetchAtribuicaoCliente,
    calcularPedido,
    gerarDocumento,
    salvarAtribuicao: pedidoService.saveAtribuicao,
    createPedido: pedidoService.createPedido,
    logPedido: pedidoService.logPedido,
  }
}
