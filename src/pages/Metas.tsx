import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Loader2, Plus, Edit, Trash2, Target, FileText } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { getMetas, createMeta, updateMeta, deleteMeta, type Meta } from '@/services/metas'
import { MetaForm, type MetaFormValues } from '@/components/MetaForm'
import { MetasMatrix } from '@/components/MetasMatrix'
import { exportMetasBalancoPDF, logMetasBalancoExport, buildMetasMatrix } from '@/lib/exportMetas'
import { useDataSync } from '@/hooks/useDataSync'
import { SyncErrorBanner } from '@/components/SyncErrorBanner'

export default function Metas() {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'especie' | 'canal'>('especie')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const { user } = useAuth()
  const { logAction } = useFunnelActivityLog()

  const {
    data: syncData,
    isLoading: loading,
    isError,
    refetch: loadData,
  } = useDataSync<{
    metas: Meta[]
    vendedores: GestaoTecnica[]
  }>({
    entities: ['metas', 'gestao_tecnica', 'historico_vendas'],
    fetcher: async () => {
      const [metasList, gestaoList] = await Promise.all([
        getMetas(),
        getGestaoTecnica().catch(() => [] as GestaoTecnica[]),
      ])
      return {
        metas: metasList,
        vendedores: gestaoList.filter((g) => g.funcao === 'vendedor'),
      }
    },
  })

  const metas = syncData?.metas || []
  const vendedores = syncData?.vendedores || []

  const editingMeta = useMemo(
    () => (editingId ? (metas.find((m) => m.id === editingId) ?? null) : null),
    [editingId, metas],
  )

  const handleOpen = () => {
    setEditingId(null)
    setOpen(true)
  }

  const handleEdit = (meta: Meta) => {
    setEditingId(meta.id)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setEditingId(null)
  }

  const onSubmit = async (data: MetaFormValues) => {
    try {
      const payload = {
        vendedor_id: data.vendedor_id,
        gestor_tecnico_id: data.gestor_tecnico_id === 'all' ? '' : data.gestor_tecnico_id,
        especie: data.especie === 'all' ? '' : data.especie,
        canal_vendas: data.canal_vendas === 'all' ? '' : data.canal_vendas,
        periodo: data.periodo,
        meta_valor: data.meta_valor,
        acrescimo_percentual: data.acrescimo_percentual || 0,
        decrecimo_percentual: data.decrecimo_percentual || 0,
      }
      if (editingId) {
        await updateMeta(editingId, payload)
        toast.success('Meta atualizada')
        // Funnel activity log: goal updated
        logAction({
          action_type: 'update',
          entity_type: 'goal',
          entity_id: editingId,
          entity_name: payload.periodo,
          description: `Atualizou meta ${payload.periodo}`,
        })
      } else {
        const created = await createMeta(payload)
        toast.success('Meta criada')
        // Funnel activity log: goal created
        logAction({
          action_type: 'create',
          entity_type: 'goal',
          entity_id: created?.id || '',
          entity_name: payload.periodo,
          description: `Criou meta ${payload.periodo}`,
        })
      }
      handleClose()
      void loadData()
    } catch {
      toast.error('Erro ao salvar meta')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const meta = metas.find((m) => m.id === deleteId)
    try {
      await deleteMeta(deleteId)
      toast.success('Meta excluída')
      // Funnel activity log: goal deleted
      logAction({
        action_type: 'delete',
        entity_type: 'goal',
        entity_id: deleteId,
        entity_name: meta?.periodo || '',
        description: `Excluiu meta ${meta?.periodo || deleteId}`,
      })
      void loadData()
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeleteId(null)
    }
  }

  const handleExportPDF = async () => {
    if (metas.length === 0) {
      toast.error('Nenhuma meta para exportar')
      return
    }
    setExporting(true)
    try {
      const solicitante = user?.name || user?.email || ''
      await exportMetasBalancoPDF(metas, vendedores, [], { solicitante })
      // Compute totals from the espécie view (grand total is view-independent
      // in aggregate) for the activity log.
      const res = buildMetasMatrix(metas, vendedores, [], 'especie')
      await logMetasBalancoExport({
        solicitante,
        totalMetas: metas.length,
        totalVendedores: vendedores.length,
        metaTotal: res.grandTotal.meta,
        realizadoTotal: res.grandTotal.realizado,
      })
      toast.success('Balanço exportado. Registro salvo na aba de Relatórios.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar balanço de metas')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Banner de erro com retry padronizado preservando dados em tela */}
      {isError && <SyncErrorBanner message="Falha ao atualizar os dados." onRetry={loadData} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Target className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
            <p className="text-muted-foreground text-sm">
              Metas por vendedor e espécie com acompanhamento automático.
            </p>
          </div>{' '}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportPDF}
            disabled={exporting || loading || metas.length === 0}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Exportar Balanço (PDF)
          </Button>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              if (!v) handleClose()
              else setOpen(v)
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={handleOpen}>
                <Plus className="w-4 h-4" /> Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
              </DialogHeader>
              <MetaForm
                onSubmit={onSubmit}
                initialData={editingMeta}
                vendedores={vendedores}
                onCancel={handleClose}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-lg">Matriz de Metas × Realizado</CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'especie' | 'canal')}>
            <TabsList>
              <TabsTrigger value="especie">Por Espécie</TabsTrigger>
              <TabsTrigger value="canal">Por Canal</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {/* Skeleton SOMENTE na primeira carga sem dados */}
          {loading && !syncData ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <MetasMatrix metas={metas} vendedores={vendedores} viewMode={viewMode} />
          )}
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">Todas as Metas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Skeleton SOMENTE na primeira carga sem dados */}
          {loading && !syncData ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : metas.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">Nenhuma meta cadastrada.</div>
          ) : (
            <div className="divide-y">
              {metas.map((m) => {
                const pct = m.meta_valor > 0 ? (m.valor_realizado / m.meta_valor) * 100 : 0
                const vName = vendedores.find((v) => v.id === m.vendedor_id)?.nome || 'N/A'
                const esp = m.especie || 'Todas'
                return (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{vName}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{m.periodo}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Espécie: {esp}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{pct.toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground">
                          {m.valor_realizado.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}{' '}
                          /{' '}
                          {m.meta_valor.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(m.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Meta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta meta?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
