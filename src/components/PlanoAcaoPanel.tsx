import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Trash2, CheckCircle2, Circle, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import {
  getPlanosByCliente,
  createPlanoAcao,
  updatePlanoAcao,
  deletePlanoAcao,
} from '@/services/planos-acao'
import { formatDateTime } from '@/lib/utils'
import type { PlanoAcao, PlanoStatus } from '@/types'

interface PlanoAcaoPanelProps {
  clienteId: string
}

const STATUS_META: Record<PlanoStatus, { label: string; icon: typeof Circle; color: string }> = {
  pendente: { label: 'Pendente', icon: Circle, color: 'bg-muted text-muted-foreground' },
  em_andamento: { label: 'Em andamento', icon: Clock, color: 'bg-blue-100 text-blue-700' },
  concluido: { label: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  cancelado: { label: 'Cancelado', icon: XCircle, color: 'bg-rose-100 text-rose-700' },
}

const STATUS_OPTIONS: { value: PlanoStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

export function PlanoAcaoPanel({ clienteId }: PlanoAcaoPanelProps) {
  const { user } = useAuth()
  const [planos, setPlanos] = useState<PlanoAcao[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    try {
      const data = await getPlanosByCliente(clienteId)
      setPlanos(data)
    } catch {
      setPlanos([])
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async () => {
    if (!descricao.trim()) {
      toast.error('Descreva o plano de ação')
      return
    }
    setSaving(true)
    try {
      await createPlanoAcao({
        descricao: descricao.trim(),
        data_prevista: dataPrevista || undefined,
        cliente: clienteId,
        vendedor: user?.id,
        origem: 'manual',
      })
      setDescricao('')
      setDataPrevista('')
      setShowForm(false)
      await load()
      toast.success('Plano de ação criado')
    } catch {
      toast.error('Erro ao criar plano de ação')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id: string, status: PlanoStatus) => {
    try {
      await updatePlanoAcao(id, { status })
      await load()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este plano de ação?')) return
    try {
      await deletePlanoAcao(id)
      await load()
      toast.success('Plano de ação excluído')
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Planos de Ação</h4>
        <Button
          size="sm"
          variant={showForm ? 'secondary' : 'outline'}
          onClick={() => setShowForm((v) => !v)}
          className="gap-1 h-8"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-3 space-y-2 animate-fade-in">
          <div className="space-y-1">
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Agendar visita técnica para apresentação de blend"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data prevista</Label>
            <Input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setDescricao('')
                setDataPrevista('')
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : planos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Nenhum plano de ação registrado.
        </p>
      ) : (
        <div className="space-y-2">
          {planos.map((p) => {
            const meta = STATUS_META[p.status as PlanoStatus] || STATUS_META.pendente
            const Icon = meta.icon
            return (
              <div key={p.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.descricao}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-muted-foreground">
                      {p.data_prevista && <span>Prazo: {formatDateTime(p.data_prevista)}</span>}
                      {p.origem && <span>Origem: {p.origem}</span>}
                      {p.expand?.vendedor?.name && <span>Resp.: {p.expand.vendedor.name}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive shrink-0"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`text-[10px] gap-1 ${meta.color}`}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </Badge>
                  <Select
                    value={p.status}
                    onValueChange={(v) => handleStatusChange(p.id, v as PlanoStatus)}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
