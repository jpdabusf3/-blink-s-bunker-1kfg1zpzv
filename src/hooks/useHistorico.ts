import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  historicoService,
  type HistoricoFilters,
  type HistoricoGranularity,
  type HistoricoAggregatedResult,
  type HistoricoDocumentoItem,
  type HistoricoSummary,
  type HistoricoMensalRow,
  type HistoricoAnualRow,
  type HistoricoQuadrienalRow,
  type HistoricoChartPoint,
} from '@/services/historicoService'
import { getEquipe, type EquipeMember } from '@/services/equipe'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { formatCurrency } from '@/lib/utils'

export interface DetailModalState {
  isOpen: boolean
  title: string
  items: HistoricoDocumentoItem[]
  subtotal: number
}

export function useHistorico() {
  const currentYear = new Date().getFullYear()
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), [])
  const defaultStartDate = useMemo(() => `${currentYear}-01-01`, [currentYear])

  const [filters, setFilters] = useState<HistoricoFilters>({
    especie: ['Todos'],
    gestor_tecnico: 'Todos',
    vendedor: 'Todos',
    canal_vendas: 'Todos',
    pais: 'Todos',
    familia_produto: 'Todos',
    data_inicio: defaultStartDate,
    data_fim: todayStr,
    mostrarApenasRealizado: false,
  })

  // Pending filters modified by the user before clicking "Aplicar Filtros"
  const [draftFilters, setDraftFilters] = useState<HistoricoFilters>({
    especie: ['Todos'],
    gestor_tecnico: 'Todos',
    vendedor: 'Todos',
    canal_vendas: 'Todos',
    pais: 'Todos',
    familia_produto: 'Todos',
    data_inicio: defaultStartDate,
    data_fim: todayStr,
    mostrarApenasRealizado: false,
  })

  const [granularity, setGranularity] = useState<HistoricoGranularity>('mensal')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [gestoresOptions, setGestoresOptions] = useState<string[]>([])
  const [vendedoresOptions, setVendedoresOptions] = useState<string[]>([])

  const [data, setData] = useState<HistoricoAggregatedResult>({
    rawItems: [],
    summary: {
      totalRealizado: 0,
      totalProjetado: 0,
      ticketMedio: 0,
      qtdDocumentos: 0,
    },
    chartData: [],
    mensal: [],
    anual: [],
    quadrienal: [],
  })

  const [detailModal, setDetailModal] = useState<DetailModalState>({
    isOpen: false,
    title: '',
    items: [],
    subtotal: 0,
  })

  // Load Gestores and Vendedores dropdown options
  useEffect(() => {
    let mounted = true
    async function loadTeam() {
      try {
        const [equipeList, gestaoList] = await Promise.all([
          getEquipe().catch(() => [] as EquipeMember[]),
          getGestaoTecnica().catch(() => [] as GestaoTecnica[]),
        ])

        if (!mounted) return

        const gestores = new Set<string>()
        const vendedores = new Set<string>()

        // From equipe
        equipeList.forEach((e) => {
          if (!e.ativo) return
          if (e.cargo === 'Gestor Tecnico') gestores.add(e.nome)
          if (e.cargo === 'Vendedor') vendedores.add(e.nome)
        })

        // From gestao_tecnica
        gestaoList.forEach((g) => {
          if (!g.ativo) return
          if (
            g.funcao === 'gestor_tecnico' ||
            g.funcao === 'gestor_comercial' ||
            g.funcao === 'gestor_especie'
          ) {
            gestores.add(g.nome)
          }
          if (g.funcao === 'vendedor') {
            vendedores.add(g.nome)
          }
        })

        setGestoresOptions(Array.from(gestores).sort((a, b) => a.localeCompare(b)))
        setVendedoresOptions(Array.from(vendedores).sort((a, b) => a.localeCompare(b)))
      } catch (err) {
        console.error('Erro ao carregar opções de equipe:', err)
      }
    }
    loadTeam()
    return () => {
      mounted = false
    }
  }, [])

  // Fetch historico with filters
  const fetchHistorico = useCallback(async (activeFilters: HistoricoFilters) => {
    setLoading(true)
    setError(null)
    try {
      const result = await historicoService.getHistorico(activeFilters)
      setData(result)
    } catch (err: any) {
      console.error('Erro ao carregar historico:', err)
      setError(err?.message || 'Erro ao carregar historico. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load or on filter change
  useEffect(() => {
    fetchHistorico(filters)
  }, [fetchHistorico, filters])

  // Apply filters action with validation
  const applyFilters = useCallback(() => {
    if (draftFilters.data_inicio && draftFilters.data_fim) {
      if (draftFilters.data_inicio > draftFilters.data_fim) {
        setError('Data inicial deve ser anterior a data final.')
        return
      }
    }
    setError(null)
    setFilters({ ...draftFilters })
  }, [draftFilters])

  // Reset filters
  const resetFilters = useCallback(() => {
    const defaultFilt: HistoricoFilters = {
      especie: ['Todos'],
      gestor_tecnico: 'Todos',
      vendedor: 'Todos',
      canal_vendas: 'Todos',
      pais: 'Todos',
      familia_produto: 'Todos',
      data_inicio: `${currentYear}-01-01`,
      data_fim: new Date().toISOString().substring(0, 10),
      mostrarApenasRealizado: false,
    }
    setDraftFilters(defaultFilt)
    setFilters(defaultFilt)
    setError(null)
  }, [currentYear])

  // Fetch details for a specific groupKey
  const fetchDetail = useCallback(
    (groupKey: string, customItems?: HistoricoDocumentoItem[]) => {
      return historicoService.getDetail(groupKey, customItems || data.rawItems)
    },
    [data.rawItems],
  )

  // Open detail modal for a group
  const openDetail = useCallback(
    (groupKey: string, title: string) => {
      const items = fetchDetail(groupKey)
      const subtotal = items.reduce(
        (sum, it) => sum + (it.produto_valor_total || it.valor_total_nota || 0),
        0,
      )
      setDetailModal({
        isOpen: true,
        title,
        items,
        subtotal,
      })
    },
    [fetchDetail],
  )

  const closeDetail = useCallback(() => {
    setDetailModal((prev) => ({ ...prev, isOpen: false, items: [] }))
  }, [])

  // Export CSV according to the active granularity
  const exportCSV = useCallback(
    (customData?: any) => {
      try {
        const activeData = customData || data
        let csvContent = ''
        const formatDateBR = (isoDate?: string) => {
          if (!isoDate) return ''
          const d = isoDate.substring(0, 10).split('-')
          if (d.length === 3) return `${d[2]}/${d[1]}/${d[0]}`
          return isoDate
        }

        if (granularity === 'mensal') {
          const headers = [
            'Mes/Ano',
            'Especie',
            'Gestor Tecnico',
            'Vendedor',
            'Canal',
            'Qtd NFs',
            'Qtd Pedidos',
            'Valor Realizado',
            'Valor Projetado',
            'Total',
          ]
          const rows = (activeData.mensal || []).map((r: HistoricoMensalRow) => [
            `"${r.mesAno}"`,
            `"${r.especie}"`,
            `"${r.gestor_tecnico}"`,
            `"${r.vendedor}"`,
            `"${r.canal}"`,
            r.qtdNfs,
            r.qtdPedidos,
            `"${formatCurrency(r.valorRealizado)}"`,
            `"${formatCurrency(r.valorProjetado)}"`,
            `"${formatCurrency(r.total)}"`,
          ])
          csvContent = [headers.join(';'), ...rows.map((row: any[]) => row.join(';'))].join('\r\n')
        } else if (granularity === 'anual') {
          const headers = [
            'Ano',
            'Especie',
            'Qtd NFs',
            'Valor Realizado',
            'Valor Projetado',
            'Total',
            'vs Ano Anterior (%)',
          ]
          const rows = (activeData.anual || []).map((r: HistoricoAnualRow) => [
            r.ano,
            `"${r.especie}"`,
            r.qtdNfs,
            `"${formatCurrency(r.valorRealizado)}"`,
            `"${formatCurrency(r.valorProjetado)}"`,
            `"${formatCurrency(r.total)}"`,
            r.vsAnoAnteriorPercent !== null ? `"${r.vsAnoAnteriorPercent.toFixed(2)}%"` : '"-"',
          ])
          csvContent = [headers.join(';'), ...rows.map((row: any[]) => row.join(';'))].join('\r\n')
        } else {
          // Quadrienal
          const headers = [
            'Ano',
            'Total Realizado',
            'Total Projetado',
            'Crescimento YoY (%)',
            'CAGR (%)',
          ]
          const rows = (activeData.quadrienal || []).map((r: HistoricoQuadrienalRow) => [
            r.ano,
            `"${formatCurrency(r.totalRealizado)}"`,
            `"${formatCurrency(r.totalProjetado)}"`,
            r.crescimentoYoY !== null ? `"${r.crescimentoYoY.toFixed(2)}%"` : '"-"',
            r.cagr !== null ? `"${r.cagr.toFixed(2)}%"` : '"-"',
          ])
          csvContent = [headers.join(';'), ...rows.map((row: any[]) => row.join(';'))].join('\r\n')
        }

        // Add detailed documents section at the bottom for completeness
        if (activeData.rawItems && activeData.rawItems.length > 0) {
          csvContent += '\r\n\r\n'
          csvContent += 'DOCUMENTOS INDIVIDUAIS\r\n'
          const docHeaders = [
            'Numero',
            'Data',
            'Destinatario',
            'Gestor',
            'Vendedor',
            'Especie',
            'Canal',
            'Produto Codigo',
            'Produto',
            'Familia',
            'Valor',
            'Status',
          ]
          const docRows = (activeData.rawItems as HistoricoDocumentoItem[]).map((doc) => [
            `"${doc.numero_documento}"`,
            `"${formatDateBR(doc.data_documento)}"`,
            `"${doc.destinatario_nome.replace(/"/g, '""')}"`,
            `"${(doc.gestor_tecnico || '').replace(/"/g, '""')}"`,
            `"${(doc.vendedor || '').replace(/"/g, '""')}"`,
            `"${doc.especie_destino || ''}"`,
            `"${doc.canal_vendas || ''}"`,
            `"${doc.produto_codigo || ''}"`,
            `"${(doc.produto_descricao || '').replace(/"/g, '""')}"`,
            `"${doc.produto_familia || ''}"`,
            `"${formatCurrency(doc.produto_valor_total || doc.valor_total_nota || 0)}"`,
            `"${doc.status}"`,
          ])
          csvContent += [docHeaders.join(';'), ...docRows.map((row) => row.join(';'))].join('\r\n')
        }

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `historico_vendas_${granularity}_${Date.now()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (e) {
        console.error('Erro ao exportar CSV:', e)
        throw new Error('Erro ao exportar dados.')
      }
    },
    [granularity, data],
  )

  return {
    filters,
    draftFilters,
    setDraftFilters,
    granularity,
    setGranularity,
    loading,
    error,
    gestoresOptions,
    vendedoresOptions,
    data,
    summary: data.summary,
    chartData: data.chartData,
    mensal: data.mensal,
    anual: data.anual,
    quadrienal: data.quadrienal,
    detailModal,
    openDetail,
    closeDetail,
    applyFilters,
    resetFilters,
    fetchHistorico: () => fetchHistorico(filters),
    fetchDetail,
    exportCSV,
  }
}
