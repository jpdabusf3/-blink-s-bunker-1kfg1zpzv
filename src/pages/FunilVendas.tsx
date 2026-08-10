import { useState, useMemo, useEffect, useCallback } from 'react'
import { getAllFactories, updateFactoryPB } from '@/services/factories'
import { getScopedFactories } from '@/lib/user-scope'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getVendedoresGestao, type GestaoTecnica } from '@/services/gestao-tecnica'
import { logActivity } from '@/services/activity-logs'
import { exportFunilVendasToExcel } from '@/lib/exportFunilVendas'
import { exportFullDashboardToPDF } from '@/lib/exportFullDashboard'
import { fetchConsolidatedData, type ConsolidatedData } from '@/services/consolidated-dashboard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { ImportFunilDialog } from '@/components/ImportFunilDialog'
import { Upload, Filter, User, ArrowRight, Download, FileText } from 'lucide-react'
import type { Factory } from '@/types'

const STATUS_COLUMNS = ['Inativo', 'Mensal', 'Ativo'] as const
const SPECIES = [
  'Ruminantes',
  'Aves',
  'Suinos',
  'Pet',
  'Aqua',
  'Equinos',
  'Outros',
  'Multi espécie',
]

export default function FunilVendas() {
  const { user } = useAuth()
  const [factories, setFactories] = useState<Factory[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [filters, setFilters] = useState({ vendedor: 'all', especie: 'all', status: 'all' })
  const [importOpen, setImportOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState<ConsolidatedData | null>(null)

  const loadData = useCallback(async () => {
    try {
      setFactories(await getAllFactories())
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    loadData()
    getVendedoresGestao()
      .then(setVendedores)
      .catch(() => {})
  }, [loadData])

  useRealtime('factories', () => {
    loadData()
  })

  useEffect(() => {
    fetchConsolidatedData()
      .then(setDashboardData)
      .catch(() => {})
  }, [])
  useRealtime('metas', () => {
    fetchConsolidatedData()
      .then(setDashboardData)
      .catch(() => {})
  })
  useRealtime('historico_vendas', () => {
    fetchConsolidatedData()
      .then(setDashboardData)
      .catch(() => {})
  })

  const scoped = useMemo(() => getScopedFactories(factories, user), [factories, user])

  const filtered = useMemo(
    () =>
      scoped.filter((f) => {
        if (!f.status_funil) return false
        if (filters.vendedor !== 'all' && f.vendedor_id !== filters.vendedor) return false
        if (filters.especie !== 'all' && f.animalSpecies !== filters.especie) return false
        if (filters.status !== 'all' && f.status_funil !== filters.status) return false
        return true
      }),
    [scoped, filters],
  )

  const handleStatusChange = async (factoryId: string, newStatus: string, oldStatus: string) => {
    if (newStatus === oldStatus) return
    const factory = factories.find((f) => f.id === factoryId)
    setFactories((prev) =>
      prev.map((f) =>
        f.id === factoryId ? { ...f, status_funil: newStatus as Factory['status_funil'] } : f,
      ),
    )
    try {
      await updateFactoryPB(factoryId, { status_funil: newStatus } as any)
      await logActivity(
        `Status Funil: ${oldStatus} → ${newStatus}`,
        `Cliente: ${factory?.name || ''}`,
        factoryId,
        'factories',
      )
    } catch {
      setFactories((prev) =>
        prev.map((f) =>
          f.id === factoryId ? { ...f, status_funil: oldStatus as Factory['status_funil'] } : f,
        ),
      )
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Gestão de clientes por status do funil comercial.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportFunilVendasToExcel(filtered)}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportFullDashboardToPDF(filtered, dashboardData, filters)}
            className="gap-2"
          >
            <FileText className="w-4 h-4" /> PDF Dashboard
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Importar Funil (Excel)
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select
          value={filters.vendedor}
          onValueChange={(v) => setFilters((p) => ({ ...p, vendedor: v }))}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Vendedores</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.especie}
          onValueChange={(v) => setFilters((p) => ({ ...p, especie: v }))}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Espécie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Espécies</SelectItem>
            {SPECIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {STATUS_COLUMNS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-4 min-w-max h-full items-stretch">
          {STATUS_COLUMNS.map((status) => {
            const items = filtered.filter((f) => f.status_funil === status)
            const totalValue = items.reduce((s, f) => s + (f.valor_medio || 0), 0)

            return (
              <div
                key={status}
                className="w-80 bg-muted/40 border rounded-xl flex flex-col max-h-full"
              >
                <div className="p-3 border-b bg-card/50 rounded-t-xl sticky top-0 z-10">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-sm text-foreground">{status}</h3>
                    <Badge variant="secondary" className="font-mono">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {formatCurrency(totalValue)}
                  </div>
                </div>

                <div className="p-2 flex-1 overflow-y-auto space-y-3">
                  {items.map((f) => (
                    <Card key={f.id} className="p-3 shadow-subtle hover:shadow-md transition-all">
                      <div className="font-bold text-sm leading-tight line-clamp-2">{f.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[f.city, f.animalSpecies].filter(Boolean).join(' • ')}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                        <span className="text-muted-foreground">Valor Médio:</span>
                        <span className="text-primary font-bold">
                          {formatCurrency(f.valor_medio || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className="text-muted-foreground">Valor Atual:</span>
                        <span className="font-semibold">{formatCurrency(f.valor_atual || 0)}</span>
                      </div>

                      {f.proximos_passos && (
                        <div className="mt-2 text-[10px] bg-muted/60 p-1.5 rounded border">
                          <div className="font-semibold text-primary flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" /> Próximos Passos:
                          </div>
                          <p className="line-clamp-2 italic text-muted-foreground">
                            {f.proximos_passos}
                          </p>
                        </div>
                      )}

                      {f.acao && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          <span className="font-semibold">Ação:</span> {f.acao}
                        </div>
                      )}

                      {f.vendedor_name && (
                        <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3 text-primary" />
                          <span className="truncate">{f.vendedor_name}</span>
                        </div>
                      )}

                      <div className="flex gap-1 mt-2 pt-2 border-t">
                        {STATUS_COLUMNS.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={f.status_funil === s ? 'default' : 'outline'}
                            className="h-6 text-[10px] flex-1 px-1"
                            disabled={f.status_funil === s}
                            onClick={() => handleStatusChange(f.id, s, f.status_funil || '')}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center p-4 text-xs text-muted-foreground border border-dashed rounded-lg">
                      Sem clientes
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ImportFunilDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => loadData()}
      />
    </div>
  )
}
