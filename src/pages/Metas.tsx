import { useState, useEffect, useMemo } from 'react'
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
import { toast } from 'sonner'
import { Loader2, Plus, Edit, Trash2, Target } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { getMetas, createMeta, updateMeta, deleteMeta, type Meta } from '@/services/metas'
import { MetaForm, type MetaFormValues } from '@/components/MetaForm'
import { MetasMatrix } from '@/components/MetasMatrix'

export default function Metas() {
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'especie' | 'gestor'>('especie')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      const records = await getMetas()
      setMetas(records)
    } catch {
      toast.error('Erro ao carregar metas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    getGestaoTecnica()
      .then((all) => {
        setVendedores(all.filter((g) => g.funcao === 'vendedor'))
        setGestores(all.filter((g) => g.funcao === 'gestor_tecnico'))
      })
      .catch(() => {})
  }, [])

  useRealtime('metas', () => {
    loadData()
  })

  useRealtime('gestao_tecnica', () => {
    getGestaoTecnica()
      .then((all) => {
        setVendedores(all.filter((g) => g.funcao === 'vendedor'))
        setGestores(all.filter((g) => g.funcao === 'gestor_tecnico'))
      })
      .catch(() => {})
  })

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
        periodo: data.periodo,
        meta_valor: data.meta_valor,
      }
      if (editingId) {
        await updateMeta(editingId, payload)
        toast.success('Meta atualizada')
      } else {
        await createMeta(payload)
        toast.success('Meta criada')
      }
      handleClose()
    } catch {
      toast.error('Erro ao salvar meta')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteMeta(deleteId)
      toast.success('Meta excluída')
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Target className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
            <p className="text-muted-foreground text-sm">
              Metas por vendedor, gestor técnico e espécie com acompanhamento automático.
            </p>
          </div>
        </div>
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
              gestores={gestores}
              onCancel={handleClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-subtle">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-lg">Matriz de Metas × Realizado</CardTitle>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'especie' | 'gestor')}>
            <TabsList>
              <TabsTrigger value="especie">Por Espécie</TabsTrigger>
              <TabsTrigger value="gestor">Por Gestor</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <MetasMatrix
              metas={metas}
              vendedores={vendedores}
              gestores={gestores}
              viewMode={viewMode}
            />
          )}
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">Todas as Metas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : metas.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">Nenhuma meta cadastrada.</div>
          ) : (
            <div className="divide-y">
              {metas.map((m) => {
                const pct = m.meta_valor > 0 ? (m.valor_realizado / m.meta_valor) * 100 : 0
                const vName = vendedores.find((v) => v.id === m.vendedor_id)?.nome || 'N/A'
                const gName = gestores.find((g) => g.id === m.gestor_tecnico_id)?.nome || '—'
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
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Gestor: {gName} · Espécie: {esp}
                      </div>
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
