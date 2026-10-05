import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Loader2,
  Plus,
  Trash2,
  Edit,
  Building2,
  Search,
  Upload,
  Filter,
  RotateCcw,
  FileArchive,
  Download,
  Sparkles,
  MapPin,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getAllFactories, deleteFactoryPB, updateFactoryPB } from '@/services/factories'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { EditableMemberSelect } from '@/components/EditableMemberSelect'
import { AtribuicaoDialog } from '@/components/AtribuicaoDialog'
import { ClientAssignmentHistoryDialog } from '@/components/ClientAssignmentHistoryDialog'
import { AssignmentAuditGlobalDialog } from '@/components/AssignmentAuditGlobalDialog'
import { BatchAssignConfirmDialog } from '@/components/BatchAssignConfirmDialog'
import { logActivity, logActivityBatch } from '@/services/activity-logs'
import { useAppContext } from '@/store/AppContext'
import { UserCheck, History, ShieldCheck, Users, CheckSquare } from 'lucide-react'
import { getScopedFactories } from '@/lib/user-scope'
import { factoryMatchesAnyVendedor } from '@/lib/vendedorFilterHelper'
import { normalizeArray } from '@/lib/utils'
import { FactoryForm, CANONICAL_SPECIES } from '@/components/FactoryForm'
import { ClientsMapDialog } from '@/components/ClientsMapDialog'
import { ClientesManager } from '@/components/ClientesManager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImportExcelDialog } from '@/components/ImportExcelDialog'
import { MultiSelect } from '@/components/ui/multi-select'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import { exportBatchClientReportsZip, logBatchReportExport } from '@/lib/batchReportExport'
import { generateClientGoogleDocsHtml, dateStamp } from '@/services/client-reports'
import { getReportTemplatePreference } from '@/services/report-template-preferences'
import { REPORT_TEMPLATE_LABEL, type ReportTemplateKey } from '@/lib/reportTemplates'
import { exportClientsToCSV } from '@/lib/csv-export'
import {
  enrichClientData,
  type EnrichmentSummary,
  getIsEnrichmentInProgress,
  subscribeEnrichmentStatus,
} from '@/services/enrichment-service'
import { getFactoryById } from '@/services/factories'
import type { RecordSubscription } from 'pocketbase'
import { FilePlus2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  CLIENT_PROFILE_CATEGORIES,
  matchesAnyProfileCategory,
  countClientsByCategory,
} from '@/constants/clientCategories'
import type { Factory } from '@/types'

const REGION_OPTIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
const SPECIES_OPTIONS = CANONICAL_SPECIES
const STATUS_OPTIONS = ['Atendido', 'Não atendido', 'Prospeção']
const PRODUCT_LINE_OPTIONS = [
  'Adsorventes',
  'Prebióticos',
  'Minerais Orgânicos',
  'Blends',
  'Ingredientes',
]

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100]

import { useSearchParams } from 'react-router-dom'
import { highlightElement } from '@/lib/contextNavigation'

export default function Cadastro() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [editingFactory, setEditingFactory] = useState<Factory | undefined>(undefined)
  const [atribuicaoFactory, setAtribuicaoFactory] = useState<Factory | null>(null)
  const [historyFactory, setHistoryFactory] = useState<Factory | null>(null)
  const [globalAuditOpen, setGlobalAuditOpen] = useState(false)
  const { updateFactory } = useAppContext()

  // Batch assignment state
  const [batchVendedorId, setBatchVendedorId] = useState<string>('keep')
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchAssigning, setBatchAssigning] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(30)

  // Export CSV state
  const [csvExporting, setCsvExporting] = useState(false)

  // Enrichment modal states
  const [confirmEnrichOpen, setConfirmEnrichOpen] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichSummary, setEnrichSummary] = useState<EnrichmentSummary | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  // Batch export state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchExporting, setBatchExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)
  const reportTemplateRef = useRef<ReportTemplateKey>('executivo')

  useEffect(() => {
    getReportTemplatePreference()
      .then((t) => {
        reportTemplateRef.current = t
      })
      .catch(() => {})
  }, [])

  const handleBatchExport = async () => {
    const selected = filtered.filter((f) => selectedIds.has(f.id))
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um cliente para exportar.')
      return
    }
    const modelo = reportTemplateRef.current
    const solicitante = user?.name || user?.email || ''
    setBatchExporting(true)
    setExportProgress({ done: 0, total: selected.length })
    try {
      const result = await exportBatchClientReportsZip(
        selected.map((f) => ({ id: f.id, name: f.name })),
        {
          modelo,
          solicitante,
          onProgress: (p) => setExportProgress({ done: p.done, total: p.total }),
        },
      )
      // Register activity log (best-effort)
      await logBatchReportExport({
        solicitante,
        solicitanteId: user?.id,
        clienteIds: selected.map((f) => f.id),
        modelo,
        formato: 'pdf',
      })

      const okCount = result.count
      const errCount = result.failures.length
      if (errCount === 0) {
        toast.success(`${okCount} PDFs gerados com sucesso!`)
      } else if (okCount === 0) {
        toast.error('Erro ao gerar PDF. Tente novamente.')
      } else {
        toast.warning(`${okCount} PDFs gerados, ${errCount} com erro (verifique o log).`)
      }
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PDF. Tente novamente.')
    } finally {
      setBatchExporting(false)
      setExportProgress(null)
    }
  }

  const handleBatchGoogleDocsExport = async () => {
    const selected = filtered.filter((f) => selectedIds.has(f.id))
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um cliente para exportar.')
      return
    }
    const modelo = reportTemplateRef.current
    const solicitante = user?.name || user?.email || ''
    setBatchExporting(true)
    setExportProgress({ done: 0, total: selected.length })
    try {
      let opened = 0
      for (let i = 0; i < selected.length; i++) {
        const f = selected[i]
        try {
          const html = await generateClientGoogleDocsHtml(f.id, {
            titulo: `Relatório de Histórico — ${f.name}`,
            modelo,
            solicitante,
          })
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const win = window.open(url, '_blank')
          if (!win) {
            // popup blocked → download fallback
            const a = document.createElement('a')
            a.href = url
            a.download = `relatorio-${f.name}-${dateStamp()} — Abrir no Google Docs.html`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
          opened++
        } catch (err) {
          console.error('[batch google docs] falha', f.name, err)
        }
        setExportProgress({ done: i + 1, total: selected.length })
      }
      await logBatchReportExport({
        solicitante,
        solicitanteId: user?.id,
        clienteIds: selected.map((f) => f.id),
        modelo,
        formato: 'google-docs',
      })
      if (opened === 0) {
        toast.error('Erro ao preparar Google Docs. Tente novamente.')
      } else {
        toast.success(`Relatório pronto para Google Docs! (${opened}/${selected.length})`)
        setSelectedIds(new Set())
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao preparar Google Docs. Tente novamente.',
      )
    } finally {
      setBatchExporting(false)
      setExportProgress(null)
    }
  }

  // Multi-select filters
  const [gestaoTecnicaList, setGestaoTecnicaList] = useState<GestaoTecnica[]>([])
  const [selectedFactories, setSelectedFactories] = useState<string[]>([])
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([])
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [selectedProductLines, setSelectedProductLines] = useState<string[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [all, gestao] = await Promise.all([
        getAllFactories(),
        getGestaoTecnica().catch(() => [] as GestaoTecnica[]),
      ])
      setFactories(getScopedFactories(all, userRef.current))
      setGestaoTecnicaList(gestao)
    } catch {
      setFactories([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carrega na montagem ou quando os atributos de escopo do usuário mudarem
  const userId = user?.id
  const userRole = user?.job_title
  const userArea = user?.geographicArea
  const userCountry = user?.country
  useEffect(() => {
    loadData()
  }, [loadData, userId, userRole, userArea, userCountry])

  // Trata destaque ou abertura contextual via query param (?highlight=ID ou ?cliente=ID)
  useEffect(() => {
    const targetId =
      searchParams.get('highlight') || searchParams.get('cliente') || searchParams.get('id')
    if (!targetId || loading || factories.length === 0) return

    const timer = setTimeout(() => {
      const found = factories.find(
        (f) => f.id === targetId || f.name.toLowerCase() === targetId.toLowerCase(),
      )
      if (found) {
        // Se houver busca ou página, ajusta para encontrar
        highlightElement(`cliente-${found.id}`)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchParams, loading, factories])

  // Ref para pausar/ignorar eventos realtime durante enriquecimento em lote
  const isEnrichingRef = useRef(getIsEnrichmentInProgress())
  useEffect(() => {
    return subscribeEnrichmentStatus((inProgress) => {
      isEnrichingRef.current = inProgress
    })
  }, [])

  // Sincronização em tempo real sem desmontar/spinner:
  // - Se estiver enriquecendo em lote, ignora para evitar tempestade de re-renders
  // - Para UPDATE: busca apenas o registro alterado com expand e faz merge cirúrgico local
  // - Para DELETE: remove o registro do array local imediatamente
  // - Para CREATE ou fallback: revalida silenciosamente em background sem setLoading(true)
  const handleFactoriesRealtime = useCallback((e: RecordSubscription<any>) => {
    if (isEnrichingRef.current) {
      return
    }

    const action = e.action
    const recordId = e.record?.id

    if (action === 'delete' && recordId) {
      setFactories((prev) => prev.filter((f) => f.id !== recordId))
      return
    }

    if (action === 'update' && recordId) {
      getFactoryById(recordId)
        .then((updated) => {
          if (!updated) return
          const scoped = getScopedFactories([updated], userRef.current)
          setFactories((prev) => {
            const exists = prev.some((f) => f.id === recordId)
            if (scoped.length === 0) {
              // Registro saiu do escopo do usuário
              return prev.filter((f) => f.id !== recordId)
            }
            if (exists) {
              return prev.map((f) => (f.id === recordId ? scoped[0] : f))
            }
            return [scoped[0], ...prev]
          })
        })
        .catch(() => {})
      return
    }

    // Para 'create' ou qualquer outro tipo, refetch silencioso SEM spinner
    getAllFactories()
      .then((all) => {
        setFactories(getScopedFactories(all, userRef.current))
      })
      .catch(() => {})
  }, [])

  const handleGestaoRealtime = useCallback(() => {
    getGestaoTecnica()
      .then(setGestaoTecnicaList)
      .catch(() => {})
  }, [])

  useRealtime('factories', handleFactoriesRealtime)
  useRealtime('gestao_tecnica', handleGestaoRealtime)

  // Responde também ao evento global de sincronização (botão Sincronizar agora / GlobalDataProvider)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleGlobalSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity?: string; collection?: string }>
      const col = customEvent.detail?.collection || customEvent.detail?.entity || 'all'
      if (col === 'all' || col === 'factories' || col === 'clientes' || col === 'gestao_tecnica') {
        void loadData()
      }
    }
    window.addEventListener('blink:datasync', handleGlobalSync)
    return () => {
      window.removeEventListener('blink:datasync', handleGlobalSync)
    }
  }, [loadData])

  // Opções dinâmicas para os filtros baseadas nos dados cadastrados
  // Opções dinâmicas para os filtros baseadas estritamente nos dados cadastrados (distintas, ordenadas e sem vazios)
  const dynamicFactoryOptions = useMemo(() => {
    const names = new Set<string>()
    factories.forEach((f) => {
      if (f.name && f.name.trim()) names.add(f.name.trim())
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [factories])

  const dynamicVendedoresOptions = useMemo(() => {
    const vends = new Set<string>()
    gestaoTecnicaList.forEach((m) => {
      if (m.ativo !== false && m.nome && m.nome.trim()) {
        vends.add(m.nome.trim())
      }
    })
    return Array.from(vends).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [gestaoTecnicaList])

  // Membros ativos da Gestão Técnica para seleção de vendedor e gestor técnico
  const activeGestaoTecnica = useMemo(() => {
    return gestaoTecnicaList
      .filter((m) => m.ativo !== false)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  }, [gestaoTecnicaList])

  const dynamicStateOptions = useMemo(() => {
    const states = new Set<string>()
    factories.forEach((f) => {
      if (f.state && f.state.trim()) {
        states.add(f.state.trim().toUpperCase())
      }
    })
    return Array.from(states).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [factories])

  const dynamicCountryOptions = useMemo(() => {
    const countries = new Set<string>()
    factories.forEach((f) => {
      const countryVal = f.country?.trim() || 'Brasil'
      countries.add(countryVal)
    })
    return Array.from(countries).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [factories])

  const dynamicRegionOptions = useMemo(() => {
    const regs = new Set<string>()
    factories.forEach((f) => {
      normalizeArray(f.region).forEach((r) => {
        if (r && r.trim()) regs.add(r.trim())
      })
    })
    return Array.from(regs).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [factories])

  const dynamicSpeciesOptions = useMemo(() => {
    const species = new Set<string>()
    factories.forEach((f) => {
      normalizeArray(f.animalSpecies).forEach((s) => {
        if (s && s.trim()) species.add(s.trim())
      })
    })
    return Array.from(species).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [factories])

  const dynamicStatusOptions = useMemo(() => {
    const sts = new Set<string>()
    factories.forEach((f) => {
      normalizeArray(f.status).forEach((s) => {
        if (s && s.trim()) sts.add(s.trim())
      })
    })
    return Array.from(sts).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [factories])

  const dynamicProductLineOptions = useMemo(() => {
    const lines = new Set<string>()
    factories.forEach((f) => {
      normalizeArray(f.productLineAffinity).forEach((l) => {
        if (l && l.trim()) lines.add(l.trim())
      })
    })
    return Array.from(lines).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [factories])

  // Contagem estática por categoria sobre o conjunto completo de clientes carregados
  const profileCategoryCounts = useMemo(() => {
    return countClientsByCategory(factories)
  }, [factories])

  const profileOptionsWithCounts = useMemo(() => {
    return CLIENT_PROFILE_CATEGORIES.map((cat) => ({
      value: cat,
      label: `${cat} (${profileCategoryCounts[cat] ?? 0})`,
    }))
  }, [profileCategoryCounts])

  const clearFilters = () => {
    setSearch('')
    setSelectedFactories([])
    setSelectedVendedores([])
    setSelectedStates([])
    setSelectedCountries([])
    setSelectedRegions([])
    setSelectedSpecies([])
    setSelectedStatuses([])
    setSelectedProfiles([])
    setSelectedProductLines([])
    setCurrentPage(1)
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedFactories.length > 0 ||
    selectedVendedores.length > 0 ||
    selectedStates.length > 0 ||
    selectedCountries.length > 0 ||
    selectedRegions.length > 0 ||
    selectedSpecies.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedProfiles.length > 0 ||
    selectedProductLines.length > 0

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    search,
    selectedFactories,
    selectedVendedores,
    selectedStates,
    selectedCountries,
    selectedRegions,
    selectedSpecies,
    selectedStatuses,
    selectedProfiles,
    selectedProductLines,
    pageSize,
  ])

  const filtered = useMemo(() => {
    return factories.filter((f) => {
      // Search text match
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchText =
          f.name.toLowerCase().includes(q) ||
          f.city?.toLowerCase().includes(q) ||
          f.vendedor_name?.toLowerCase().includes(q)
        if (!matchText) return false
      }

      // Fábrica filtro
      if (selectedFactories.length > 0) {
        if (!selectedFactories.includes(f.name.trim())) return false
      }

      // Vendedor filtro (sincronizado da collection gestao_tecnica via relação e fallback de salesOwner/gestor)
      if (selectedVendedores.length > 0) {
        if (!factoryMatchesAnyVendedor(f, selectedVendedores)) return false
      }

      // Estado filtro
      if (selectedStates.length > 0) {
        const clientState = f.state?.trim().toUpperCase()
        if (!clientState || !selectedStates.includes(clientState)) return false
      }

      // País filtro
      if (selectedCountries.length > 0) {
        const clientCountry = f.country?.trim() || 'Brasil'
        if (!selectedCountries.includes(clientCountry)) return false
      }

      // Region multi-match (any selected matches any in factory)
      if (selectedRegions.length > 0) {
        const factoryRegions = normalizeArray(f.region)
        const hasRegion = selectedRegions.some((r) => factoryRegions.includes(r))
        if (!hasRegion) return false
      }

      // Species multi-match
      if (selectedSpecies.length > 0) {
        const factorySpecies = normalizeArray(f.animalSpecies)
        const hasSpecies = selectedSpecies.some((s) => factorySpecies.includes(s))
        if (!hasSpecies) return false
      }

      // Status multi-match
      if (selectedStatuses.length > 0) {
        const factoryStatuses = normalizeArray(f.status)
        const hasStatus = selectedStatuses.some((st) => factoryStatuses.includes(st))
        if (!hasStatus) return false
      }

      // Perfil / Carteira multi-match com categorias fixas e correspondência tolerante
      if (selectedProfiles.length > 0) {
        const clientProfiles = normalizeArray(f.profile_type)
        if (f.carteira && f.carteira.trim() && !clientProfiles.includes(f.carteira.trim())) {
          clientProfiles.push(f.carteira.trim())
        }
        if (!matchesAnyProfileCategory(clientProfiles, selectedProfiles)) {
          return false
        }
      }

      // Product line affinity multi-match
      if (selectedProductLines.length > 0) {
        const factoryLines = normalizeArray(f.productLineAffinity)
        const hasLine = selectedProductLines.some((l) => factoryLines.includes(l))
        if (!hasLine) return false
      }

      return true
    })
  }, [
    factories,
    search,
    selectedFactories,
    selectedVendedores,
    selectedStates,
    selectedCountries,
    selectedRegions,
    selectedSpecies,
    selectedStatuses,
    selectedProfiles,
    selectedProductLines,
  ])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedFactories = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filtered.slice(startIndex, startIndex + pageSize)
  }, [filtered, currentPage, pageSize])

  const handleEdit = (f: Factory) => {
    setEditingFactory(f)
    setDialogOpen(true)
  }

  const handleNew = () => {
    setEditingFactory(undefined)
    setDialogOpen(true)
  }

  const { logAction } = useFunnelActivityLog()

  const handleExportCSV = async () => {
    setCsvExporting(true)
    try {
      // Respect current active page filters
      if (filtered.length === 0) {
        toast.info('Nenhum cliente cadastrado para exportar.')
        return
      }

      const { count } = exportClientsToCSV(filtered)
      toast.success(`${count} clientes exportados com sucesso.`)
    } catch (err) {
      console.error('[export csv] erro ao exportar', err)
      toast.error('Erro ao exportar clientes. Tente novamente.')
    } finally {
      setCsvExporting(false)
    }
  }

  const handleOpenEnrichConfirm = () => {
    if (factories.length === 0) {
      toast.info('Nenhum cliente para enriquecer.')
      return
    }
    setConfirmEnrichOpen(true)
  }

  const handleStartEnrichment = async () => {
    setConfirmEnrichOpen(false)
    setEnriching(true)
    try {
      const summary = await enrichClientData({ mode: 'all' })
      setEnriching(false)
      setEnrichSummary(summary)
      setSummaryOpen(true)
      toast.success('Enriquecimento concluido!')
      loadData()
    } catch (err) {
      console.error('[enrichment] erro ao enriquecer', err)
      setEnriching(false)
      toast.error('Erro ao processar enriquecimento. Verifique sua conexao e tente novamente.')
    }
  }

  const handleDelete = async (id: string) => {
    const factory = factories.find((f) => f.id === id)
    if (!confirm('Excluir esta fábrica?')) return
    try {
      await deleteFactoryPB(id)
      toast.success('Cliente excluído com sucesso.')
      // Funnel activity log: client deleted
      logAction({
        action_type: 'delete',
        entity_type: 'client',
        entity_id: id,
        entity_name: factory?.name || '',
        description: `Excluiu cliente ${factory?.name || id}`,
      })
      loadData()
    } catch {
      toast.error('Erro ao excluir cliente. Tente novamente.')
    }
  }

  // Atualização direta de Vendedor de uma fábrica
  const handleUpdateVendedor = async (
    factoryId: string,
    vendedorId: string | null,
    vendedorNome: string | null,
  ) => {
    const target = factories.find((f) => f.id === factoryId)
    const oldName = target?.vendedor_name || 'Não atribuído'
    const newName = vendedorNome || 'Não atribuído'

    try {
      // Grava no backend PocketBase: apenas o campo vendedor_id (sanitizado por toPBData para null se vazio)
      await updateFactoryPB(factoryId, {
        vendedor_id: vendedorId || null,
      } as any)

      // Atualiza estado local de factories imediatamente em memória
      setFactories((prev) =>
        prev.map((f) =>
          f.id === factoryId
            ? {
                ...f,
                vendedor_id: vendedorId || undefined,
                vendedor_name: vendedorNome || undefined,
                expand: {
                  ...f.expand,
                  vendedor_id: vendedorId
                    ? { id: vendedorId, nome: vendedorNome || '' }
                    : undefined,
                  vendedor: vendedorId ? { id: vendedorId, nome: vendedorNome || '' } : undefined,
                },
              }
            : f,
        ),
      )

      // Atualiza o store global do app
      updateFactory(factoryId, {
        vendedor_id: vendedorId || undefined,
        vendedor_name: vendedorNome || undefined,
      })

      // Registro persistente na activity_logs (auditoria da carteira)
      logActivity(
        `Atribuição de Vendedor: ${target?.name || 'Cliente'}`,
        `Vendedor alterado de "${oldName}" para "${newName}". Cliente: ${target?.name || factoryId}`,
        factoryId,
        'factories',
        {
          tipo: 'atribuicao',
          status_anterior: oldName,
          status_novo: newName,
          origem: 'manual',
        },
      ).catch((err) => {
        console.warn('[handleUpdateVendedor] logActivity falhou', err)
      })

      // Log de atividade secundário no funil
      logAction({
        action_type: 'assign',
        entity_type: 'client',
        entity_id: factoryId,
        entity_name: target?.name || factoryId,
        old_value: oldName,
        new_value: newName,
        description: `Alterou vendedor de "${oldName}" para "${newName}"`,
      })

      toast.success(`Vendedor atualizado: ${newName}`)
    } catch (err: any) {
      console.error('[handleUpdateVendedor] falha ao atualizar', err)
      toast.error(err?.message || 'Erro ao atualizar vendedor. Tente novamente.')
      throw err
    }
  }

  // Atualização direta de Gestor Técnico de uma fábrica
  const handleUpdateGestorTecnico = async (
    factoryId: string,
    gestorId: string | null,
    gestorNome: string | null,
  ) => {
    const target = factories.find((f) => f.id === factoryId)
    const oldName = target?.gestor_tecnico_name || 'Não atribuído'
    const newName = gestorNome || 'Não atribuído'

    try {
      // Grava no backend PocketBase: apenas o campo gestor_tecnico_id (sanitizado por toPBData para null se vazio)
      await updateFactoryPB(factoryId, {
        gestor_tecnico_id: gestorId || null,
      } as any)

      // Atualiza estado local de factories imediatamente em memória
      setFactories((prev) =>
        prev.map((f) =>
          f.id === factoryId
            ? {
                ...f,
                gestor_tecnico_id: gestorId || undefined,
                gestor_tecnico_name: gestorNome || undefined,
                expand: {
                  ...f.expand,
                  gestor_tecnico_id: gestorId
                    ? { id: gestorId, nome: gestorNome || '' }
                    : undefined,
                  gestor_tecnico: gestorId ? { id: gestorId, nome: gestorNome || '' } : undefined,
                },
              }
            : f,
        ),
      )

      // Atualiza o store global do app
      updateFactory(factoryId, {
        gestor_tecnico_id: gestorId || undefined,
        gestor_tecnico_name: gestorNome || undefined,
      })

      // Registro persistente na activity_logs (auditoria da carteira)
      logActivity(
        `Atribuição de Gestor Técnico: ${target?.name || 'Cliente'}`,
        `Gestor técnico alterado de "${oldName}" para "${newName}". Cliente: ${target?.name || factoryId}`,
        factoryId,
        'factories',
        {
          tipo: 'atribuicao',
          status_anterior: oldName,
          status_novo: newName,
          origem: 'manual',
        },
      ).catch((err) => {
        console.warn('[handleUpdateGestorTecnico] logActivity falhou', err)
      })

      // Log de atividade secundário no funil
      logAction({
        action_type: 'assign',
        entity_type: 'client',
        entity_id: factoryId,
        entity_name: target?.name || factoryId,
        old_value: oldName,
        new_value: newName,
        description: `Alterou gestor técnico de "${oldName}" para "${newName}"`,
      })

      toast.success(`Gestor técnico atualizado: ${newName}`)
    } catch (err: any) {
      console.error('[handleUpdateGestorTecnico] falha ao atualizar', err)
      toast.error(err?.message || 'Erro ao atualizar gestor técnico. Tente novamente.')
      throw err
    }
  }

  // Salvar ambos via modal de atribuição
  const handleSaveModalAssignments = async (
    factoryId: string,
    assignments: {
      vendedor_id: string | null
      vendedor_name: string | null
      gestor_tecnico_id: string | null
      gestor_tecnico_name: string | null
    },
  ) => {
    const target = factories.find((f) => f.id === factoryId)
    const oldVend = target?.vendedor_name || 'Não atribuído'
    const newVend = assignments.vendedor_name || 'Não atribuído'
    const oldGest = target?.gestor_tecnico_name || 'Não atribuído'
    const newGest = assignments.gestor_tecnico_name || 'Não atribuído'

    try {
      await updateFactoryPB(factoryId, {
        vendedor_id: assignments.vendedor_id || null,
        gestor_tecnico_id: assignments.gestor_tecnico_id || null,
      } as any)

      setFactories((prev) =>
        prev.map((f) =>
          f.id === factoryId
            ? {
                ...f,
                vendedor_id: assignments.vendedor_id || undefined,
                vendedor_name: assignments.vendedor_name || undefined,
                gestor_tecnico_id: assignments.gestor_tecnico_id || undefined,
                gestor_tecnico_name: assignments.gestor_tecnico_name || undefined,
                expand: {
                  ...f.expand,
                  vendedor_id: assignments.vendedor_id
                    ? { id: assignments.vendedor_id, nome: assignments.vendedor_name || '' }
                    : undefined,
                  vendedor: assignments.vendedor_id
                    ? { id: assignments.vendedor_id, nome: assignments.vendedor_name || '' }
                    : undefined,
                  gestor_tecnico_id: assignments.gestor_tecnico_id
                    ? {
                        id: assignments.gestor_tecnico_id,
                        nome: assignments.gestor_tecnico_name || '',
                      }
                    : undefined,
                  gestor_tecnico: assignments.gestor_tecnico_id
                    ? {
                        id: assignments.gestor_tecnico_id,
                        nome: assignments.gestor_tecnico_name || '',
                      }
                    : undefined,
                },
              }
            : f,
        ),
      )

      updateFactory(factoryId, {
        vendedor_id: assignments.vendedor_id || undefined,
        vendedor_name: assignments.vendedor_name || undefined,
        gestor_tecnico_id: assignments.gestor_tecnico_id || undefined,
        gestor_tecnico_name: assignments.gestor_tecnico_name || undefined,
      })

      // Registro de auditoria na activity_logs
      const changes: string[] = []
      if (oldVend !== newVend) changes.push(`Vendedor: "${oldVend}" → "${newVend}"`)
      if (oldGest !== newGest) changes.push(`Gestor Técnico: "${oldGest}" → "${newGest}"`)

      if (changes.length > 0) {
        logActivity(
          `Atribuições editadas: ${target?.name || 'Cliente'}`,
          changes.join(' | '),
          factoryId,
          'factories',
          {
            tipo: 'atribuicao',
            status_anterior: `${oldVend} / ${oldGest}`,
            status_novo: `${newVend} / ${newGest}`,
            origem: 'manual',
          },
        ).catch(() => {})
      }

      toast.success('Atribuições atualizadas com sucesso')
    } catch (err: any) {
      console.error('[handleSaveModalAssignments] falha ao atualizar', err)
      toast.error(err?.message || 'Erro ao atualizar atribuições.')
      throw err
    }
  }

  // Executa atribuição em lote sobre os clientes selecionados
  const handleApplyBatchAssign = async () => {
    const selectedClients = factories.filter((f) => selectedIds.has(f.id))
    if (selectedClients.length === 0) {
      toast.error('Nenhum cliente selecionado.')
      return
    }

    const applyVendedor = batchVendedorId !== 'keep'

    if (!applyVendedor) {
      toast.info('Selecione uma alteração para vendedor.')
      return
    }

    const resolvedVendedorMember =
      applyVendedor && batchVendedorId !== 'none'
        ? activeGestaoTecnica.find((m) => m.id === batchVendedorId)
        : null
    const targetVendedorId = applyVendedor
      ? batchVendedorId === 'none'
        ? ''
        : batchVendedorId
      : null
    const targetVendedorName = applyVendedor ? resolvedVendedorMember?.nome || null : null

    setBatchAssigning(true)
    let successCount = 0
    let failCount = 0
    const failedClientDetails: Array<{ name: string; reason: string }> = []
    const auditEntries: Array<{
      action: string
      details: string
      recordId: string
      collectionName: string
      tipo: string
      status_anterior: string
      status_novo: string
      origem: string
    }> = []

    const successfulClientIds = new Set<string>()

    try {
      for (const client of selectedClients) {
        const payload: Record<string, any> = {}
        const clientChanges: string[] = []

        let oldVend = client.vendedor_name || 'Não atribuído'
        let newVend = oldVend

        if (applyVendedor) {
          payload.vendedor_id = targetVendedorId
          newVend = targetVendedorName || 'Não atribuído'
          if (oldVend !== newVend) {
            clientChanges.push(`Vendedor: "${oldVend}" → "${newVend}"`)
          }
        }

        try {
          await updateFactoryPB(client.id, payload as any)
          successCount++
          successfulClientIds.add(client.id)

          // Auditoria se houve mudança efetiva
          if (clientChanges.length > 0) {
            auditEntries.push({
              action: `Rebalanceamento em lote: ${client.name}`,
              details: clientChanges.join(' | '),
              recordId: client.id,
              collectionName: 'factories',
              tipo: 'atribuicao',
              status_anterior: oldVend,
              status_novo: newVend,
              origem: 'manual',
            })
          }
        } catch (itemErr: any) {
          console.error('[batchAssign] falha no cliente', client.name, itemErr)
          failCount++
          const fieldErrs = extractFieldErrors(itemErr)
          const fieldErrsList = Object.entries(fieldErrs).map(([f, m]) => `${f}: ${m}`)
          const reason =
            fieldErrsList.length > 0 ? fieldErrsList.join(', ') : getErrorMessage(itemErr)
          failedClientDetails.push({ name: client.name, reason })
        }
      }

      // Atualiza estado local de factories em memória apenas para os que tiveram sucesso
      if (successfulClientIds.size > 0) {
        setFactories((prev) =>
          prev.map((f) => {
            if (!successfulClientIds.has(f.id)) return f
            const nextVendedorId = applyVendedor ? targetVendedorId || undefined : f.vendedor_id
            const nextVendedorName = applyVendedor
              ? targetVendedorName || undefined
              : f.vendedor_name

            return {
              ...f,
              vendedor_id: nextVendedorId,
              vendedor_name: nextVendedorName,
              expand: {
                ...f.expand,
                vendedor_id: nextVendedorId
                  ? { id: nextVendedorId, nome: nextVendedorName || '' }
                  : undefined,
                vendedor: nextVendedorId
                  ? { id: nextVendedorId, nome: nextVendedorName || '' }
                  : undefined,
              },
            }
          }),
        )

        // Atualiza store global AppContext para cada cliente com sucesso
        selectedClients
          .filter((client) => successfulClientIds.has(client.id))
          .forEach((client) => {
            const patch: Partial<Factory> = {}
            if (applyVendedor) {
              patch.vendedor_id = targetVendedorId || undefined
              patch.vendedor_name = targetVendedorName || undefined
            }
            updateFactory(client.id, patch)
          })
      }

      // Grava logs de auditoria no backend (batch ou um por um)
      if (auditEntries.length > 0) {
        logActivityBatch(auditEntries).catch((err) => {
          console.warn('[handleApplyBatchAssign] batch audit failed, falling back', err)
          // fallback fire-and-forget
          auditEntries.forEach((entry) => {
            logActivity(entry.action, entry.details, entry.recordId, entry.collectionName, {
              tipo: entry.tipo,
              status_anterior: entry.status_anterior,
              status_novo: entry.status_novo,
              origem: entry.origem,
            }).catch(() => {})
          })
        })
      }

      if (failCount === 0) {
        toast.success(
          `${successCount} cliente(s) atualizado(s) com sucesso! Histórico de auditoria registrado.`,
        )
      } else {
        const sampleFailures = failedClientDetails
          .slice(0, 3)
          .map((f) => `${f.name} (${f.reason})`)
          .join('; ')
        const more = failedClientDetails.length > 3 ? ` (+${failedClientDetails.length - 3})` : ''
        toast.warning(
          `${successCount} cliente(s) atualizados com sucesso, ${failCount} falharam. Detalhes: ${sampleFailures}${more}`,
          { duration: 8000 },
        )
      }

      // Limpa seleções de lote
      setSelectedIds(new Set())
      setBatchVendedorId('keep')
    } finally {
      setBatchAssigning(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <Tabs defaultValue="clientes" className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cadastro de Clientes</h1>
              <p className="text-muted-foreground text-sm">
                Gerencie clientes, fábricas e carteira comercial.
              </p>
            </div>
          </div>
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="clientes" className="gap-2">
              <Users className="w-4 h-4" />
              Clientes (CRUD)
            </TabsTrigger>
            <TabsTrigger value="fabricas" className="gap-2">
              <Building2 className="w-4 h-4" />
              Fábricas & Operações
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="clientes" className="mt-0 focus-visible:outline-none">
          <ClientesManager />
        </TabsContent>

        <TabsContent value="fabricas" className="mt-0 space-y-6 focus-visible:outline-none">
          <div className="flex justify-end flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={csvExporting}
              onClick={handleExportCSV}
            >
              {csvExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {csvExporting ? 'Exportando...' : 'Exportar CSV'}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleOpenEnrichConfirm}>
              <Sparkles className="w-4 h-4" />
              Enriquecer Dados
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setMapModalOpen(true)}>
              <MapPin className="w-4 h-4 text-primary" />
              Mapa de Clientes
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setGlobalAuditOpen(true)}
              title="Ver histórico geral de transferências e auditoria da carteira"
            >
              <ShieldCheck className="w-4 h-4 text-primary" />
              Auditoria da Carteira
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> Importar
            </Button>
            <Button className="gap-2" onClick={handleNew}>
              <Plus className="w-4 h-4" /> Nova Fábrica
            </Button>
          </div>

          <Card className="shadow-subtle">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle>Fábricas Cadastradas</CardTitle>
                  <CardDescription>
                    {filtered.length} fábrica(s) encontrada(s)
                    {filtered.length > pageSize && (
                      <>
                        {' '}
                        • Exibindo {(currentPage - 1) * pageSize + 1} a{' '}
                        {Math.min(currentPage * pageSize, filtered.length)}
                      </>
                    )}
                  </CardDescription>
                </div>
                {filtered.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Itens por página:</span>
                    <select
                      aria-label="Itens por página"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardHeader>
            {selectedIds.size > 0 && (
              <div className="mx-6 mb-3 p-3 rounded-lg border bg-primary/5 border-primary/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="gap-1 font-semibold">
                      <CheckSquare className="w-3.5 h-3.5" />
                      {selectedIds.size} selecionado(s)
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      (da página ou filtrados)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={batchExporting || batchAssigning}
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Limpar seleção
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      disabled={batchExporting || batchAssigning}
                      onClick={handleBatchExport}
                    >
                      {batchExporting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileArchive className="w-3.5 h-3.5" />
                      )}
                      Exportar PDFs (ZIP)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      disabled={batchExporting || batchAssigning}
                      onClick={handleBatchGoogleDocsExport}
                    >
                      {batchExporting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FilePlus2 className="w-3.5 h-3.5" />
                      )}
                      Google Docs
                    </Button>
                  </div>
                </div>

                {/* Barra de Rebalanceamento / Atribuição em Lote */}
                <div className="pt-2 border-t border-primary/10 flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                    Atribuição em Lote:
                  </span>

                  {/* Seletor Vendedor */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Vendedor:</span>
                    <select
                      value={batchVendedorId}
                      onChange={(e) => setBatchVendedorId(e.target.value)}
                      disabled={batchAssigning}
                      aria-label="Selecionar novo vendedor para lote"
                      className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="keep">-- Manter atual --</option>
                      <option value="none">Nenhum / Desatribuir</option>
                      {activeGestaoTecnica.map((m) => (
                        <option key={`v-${m.id}`} value={m.id}>
                          {m.nome} ({m.funcao || 'Membro'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 ml-auto"
                    disabled={batchAssigning || batchVendedorId === 'keep'}
                    onClick={() => setBatchConfirmOpen(true)}
                  >
                    {batchAssigning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    Aplicar Atribuição ({selectedIds.size})
                  </Button>
                </div>
              </div>
            )}
            {exportProgress && (
              <div className="px-6 pb-3 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando relatórios... {exportProgress.done}/{exportProgress.total} concluídos
                  </span>
                  <span>Modelo: {REPORT_TEMPLATE_LABEL[reportTemplateRef.current]}</span>
                </div>
                <Progress
                  value={(exportProgress.done / exportProgress.total) * 100}
                  className="h-2"
                />
              </div>
            )}
            <CardContent className="space-y-4">
              <div className="space-y-3 p-3 bg-muted/20 border rounded-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Filter className="w-4 h-4 text-primary" />
                    Filtros Multi-Seleção
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Limpar Filtros
                    </Button>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, cidade ou vendedor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Clientes
                    </label>
                    <MultiSelect
                      options={dynamicFactoryOptions}
                      value={selectedFactories}
                      onChange={setSelectedFactories}
                      placeholder="Todos os clientes"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Vendedor
                    </label>
                    <MultiSelect
                      options={dynamicVendedoresOptions}
                      value={selectedVendedores}
                      onChange={setSelectedVendedores}
                      placeholder="Todos os vendedores"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Estado
                    </label>
                    <MultiSelect
                      options={dynamicStateOptions}
                      value={selectedStates}
                      onChange={setSelectedStates}
                      placeholder="Todos os estados"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      País
                    </label>
                    <MultiSelect
                      options={dynamicCountryOptions}
                      value={selectedCountries}
                      onChange={setSelectedCountries}
                      placeholder="Todos os países"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Perfil / Carteira
                    </label>
                    <MultiSelect
                      options={profileOptionsWithCounts}
                      value={selectedProfiles}
                      onChange={setSelectedProfiles}
                      placeholder="Todos os perfis"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Região
                    </label>
                    <MultiSelect
                      options={dynamicRegionOptions}
                      value={selectedRegions}
                      onChange={setSelectedRegions}
                      placeholder="Todas as regiões"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Espécie Animal
                    </label>
                    <MultiSelect
                      options={dynamicSpeciesOptions}
                      value={selectedSpecies}
                      onChange={setSelectedSpecies}
                      placeholder="Todas as espécies"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Status
                    </label>
                    <MultiSelect
                      options={dynamicStatusOptions}
                      value={selectedStatuses}
                      onChange={setSelectedStatuses}
                      placeholder="Todos os status"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Linha de Produtos
                    </label>
                    <MultiSelect
                      options={dynamicProductLineOptions}
                      value={selectedProductLines}
                      onChange={setSelectedProductLines}
                      placeholder="Todas as linhas"
                    />
                  </div>
                </div>
              </div>

              {loadError && !loading && (
                <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-8 text-center space-y-3">
                  <div className="p-3 bg-destructive/10 rounded-full text-destructive inline-block">
                    <AlertTriangle className="w-8 h-8 mx-auto" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">
                      Não foi possível carregar os clientes
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Ocorreu uma falha na comunicação com o banco de dados. Verifique sua conexão e
                      tente novamente.
                    </p>
                  </div>
                  <Button
                    onClick={() => loadData()}
                    variant="outline"
                    size="sm"
                    className="gap-2 mt-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Tentar novamente
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Skeleton className="h-4 w-4" />
                        </TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cidade/UF</TableHead>
                        <TableHead>Perfil/Carteira</TableHead>
                        <TableHead>Espécie</TableHead>
                        <TableHead>Funil</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Status do Contato</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="w-10">
                            <Skeleton className="h-4 w-4" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-28 rounded-md" />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Skeleton className="h-8 w-8 rounded-md" />
                              <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                !loadError && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                paginatedFactories.length > 0 &&
                                paginatedFactories.every((f) => selectedIds.has(f.id))
                              }
                              onCheckedChange={(checked) => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev)
                                  if (checked) {
                                    paginatedFactories.forEach((f) => next.add(f.id))
                                  } else {
                                    paginatedFactories.forEach((f) => next.delete(f.id))
                                  }
                                  return next
                                })
                              }}
                              aria-label="Selecionar todos da página"
                            />
                          </TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Cidade/UF</TableHead>
                          <TableHead>Perfil/Carteira</TableHead>
                          <TableHead>Espécie</TableHead>
                          <TableHead>Funil</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Status do Contato</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="p-8 text-center">
                              <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
                                <div className="p-3 bg-primary/10 rounded-full text-primary">
                                  <Building2 className="w-8 h-8" />
                                </div>
                                <h4 className="text-base font-semibold text-foreground">
                                  {hasActiveFilters
                                    ? 'Nenhum cliente atende aos filtros selecionados'
                                    : 'Nenhum cliente cadastrado'}
                                </h4>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                  {hasActiveFilters
                                    ? 'Tente ajustar ou limpar os filtros de busca para visualizar os registros.'
                                    : 'Cadastre o primeiro cliente da sua carteira para gerenciar contatos e vendas.'}
                                </p>
                                {hasActiveFilters ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="gap-1.5 text-xs mt-2"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" /> Limpar filtros
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={handleNew}
                                    className="gap-1.5 text-xs mt-2"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Cadastrar cliente
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedFactories.map((f) => {
                            const profileItems = Array.from(
                              new Set([
                                ...normalizeArray(f.profile_type).filter(Boolean),
                                ...(f.carteira?.trim() ? [f.carteira.trim()] : []),
                              ]),
                            )

                            return (
                              <TableRow key={f.id} id={`cliente-${f.id}`} data-highlight-id={f.id}>
                                <TableCell className="w-10">
                                  <Checkbox
                                    checked={selectedIds.has(f.id)}
                                    onCheckedChange={(v) => {
                                      setSelectedIds((prev) => {
                                        const next = new Set(prev)
                                        if (v) next.add(f.id)
                                        else next.delete(f.id)
                                        return next
                                      })
                                    }}
                                    aria-label={`Selecionar ${f.name}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{f.name}</TableCell>
                                <TableCell className="text-sm">
                                  {[f.city, f.state].filter(Boolean).join('/') || '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {profileItems.length === 0 ? (
                                      <span className="text-muted-foreground">-</span>
                                    ) : (
                                      profileItems.map((item) => (
                                        <Badge key={item} variant="secondary" className="text-xs">
                                          {item}
                                        </Badge>
                                      ))
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {normalizeArray(f.animalSpecies).length === 0 ? (
                                      <span className="text-muted-foreground">-</span>
                                    ) : (
                                      normalizeArray(f.animalSpecies).map((sp) => (
                                        <Badge key={sp} variant="outline" className="text-xs">
                                          {sp}
                                        </Badge>
                                      ))
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">{f.funnelStage}</TableCell>
                                <TableCell className="text-sm">
                                  {f.contato || <span className="text-muted-foreground">-</span>}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {f.status_contato ? (
                                    <Badge variant="outline" className="text-xs">
                                      {f.status_contato}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <EditableMemberSelect
                                    currentId={f.vendedor_id}
                                    currentName={f.vendedor_name}
                                    members={activeGestaoTecnica}
                                    onSelect={(newId, newName) =>
                                      handleUpdateVendedor(f.id, newId, newName)
                                    }
                                    placeholder="Sem vendedor"
                                    searchPlaceholder="Buscar vendedor..."
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setHistoryFactory(f)}
                                    title="Histórico de atribuições (auditoria deste cliente)"
                                    className="hover:text-primary"
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setAtribuicaoFactory(f)}
                                    title="Editar atribuição de vendedor"
                                    className="hover:text-primary"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(f)}
                                    title="Editar cadastro completo"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(f.id)}
                                    className="text-destructive"
                                    title="Excluir fábrica"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}

              {/* Pagination Controls */}
              {!loading && totalPages > 1 && (
                <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Página <span className="font-medium text-foreground">{currentPage}</span> de{' '}
                    <span className="font-medium text-foreground">{totalPages}</span> (
                    {filtered.length} fábricas no total)
                  </p>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                    </Button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => {
                          // Show first, last, current, and neighbours
                          return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
                        })
                        .reduce<number[]>((acc, p) => {
                          // Insert placeholder logic by keeping unique sorted page numbers
                          return [...acc, p]
                        }, [])
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1]
                          const showEllipsisBefore = prev && p - prev > 1

                          return (
                            <div key={p} className="flex items-center">
                              {showEllipsisBefore && (
                                <span className="px-1 text-xs text-muted-foreground">...</span>
                              )}
                              <Button
                                type="button"
                                variant={p === currentPage ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setCurrentPage(p)}
                                className="h-8 w-8 p-0 text-xs font-medium"
                              >
                                {p}
                              </Button>
                            </div>
                          )
                        })}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      Próxima <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={dialogOpen}
            onOpenChange={(v) => {
              setDialogOpen(v)
              if (!v) setEditingFactory(undefined)
            }}
          >
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFactory ? 'Editar Fábrica' : 'Nova Fábrica'}</DialogTitle>
              </DialogHeader>
              <FactoryForm
                factory={editingFactory}
                onSubmit={() => {
                  setDialogOpen(false)
                  setEditingFactory(undefined)
                  loadData()
                }}
              />
            </DialogContent>
          </Dialog>

          <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} onImported={loadData} />

          {/* Modal de Atribuição Rápida de Vendedor */}
          <AtribuicaoDialog
            open={!!atribuicaoFactory}
            onOpenChange={(open) => {
              if (!open) setAtribuicaoFactory(null)
            }}
            factory={atribuicaoFactory}
            members={activeGestaoTecnica}
            onSave={handleSaveModalAssignments}
          />

          {/* Modal de Histórico de Atribuições do Cliente Individual */}
          <ClientAssignmentHistoryDialog
            factory={historyFactory}
            open={!!historyFactory}
            onOpenChange={(open) => {
              if (!open) setHistoryFactory(null)
            }}
          />

          {/* Modal de Auditoria Geral da Carteira */}
          <AssignmentAuditGlobalDialog open={globalAuditOpen} onOpenChange={setGlobalAuditOpen} />

          {/* Modal de Confirmação de Atribuição em Lote */}
          <BatchAssignConfirmDialog
            open={batchConfirmOpen}
            onOpenChange={setBatchConfirmOpen}
            selectedFactories={factories.filter((f) => selectedIds.has(f.id))}
            applyVendedor={batchVendedorId !== 'keep'}
            newVendedorName={
              batchVendedorId === 'keep'
                ? null
                : batchVendedorId === 'none'
                  ? null
                  : activeGestaoTecnica.find((m) => m.id === batchVendedorId)?.nome || null
            }
            onConfirm={handleApplyBatchAssign}
          />

          {/* Clients Map Dialog Modal */}
          <ClientsMapDialog
            open={mapModalOpen}
            onOpenChange={setMapModalOpen}
            factories={filtered}
            loading={loading}
            onReload={loadData}
          />

          {/* Confirmation Dialog: Enriquecer Dados */}
          <Dialog open={confirmEnrichOpen} onOpenChange={setConfirmEnrichOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enriquecimento de Dados</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Sera feita a busca de CEP, padronizacao de enderecos e geocodificacao de todos os
                clientes. Isso pode levar alguns minutos. Deseja continuar?
              </p>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setConfirmEnrichOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleStartEnrichment} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Iniciar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal 1 (Loading): Processando Enriquecimento */}
          <Dialog open={enriching} onOpenChange={() => {}}>
            <DialogContent
              className="max-w-md text-center py-8 [&>button]:hidden"
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    Processando enriquecimento de dados...
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Isso pode levar alguns minutos. Nao feche esta pagina.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal 2 (Success): Resumo do Enriquecimento Concluido */}
          <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enriquecimento Concluido</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Total processados:</span>
                  <span className="font-semibold text-foreground">
                    {enrichSummary?.total_processed ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Total enriquecidos:</span>
                  <span className="font-semibold text-foreground">
                    {enrichSummary?.total_enriched ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Total geocodificados:</span>
                  <span className="font-semibold text-foreground">
                    {enrichSummary?.total_geocoded ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Total inconsistentes:</span>
                  <span className="font-semibold text-foreground">
                    {enrichSummary?.total_inconsistent ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-muted-foreground">Total falhas:</span>
                  <span className="font-semibold text-foreground">
                    {enrichSummary?.total_failed ?? 0}
                  </span>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setSummaryOpen(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
