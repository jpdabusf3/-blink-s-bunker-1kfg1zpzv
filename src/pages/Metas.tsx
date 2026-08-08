import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Edit, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useRealtime } from '@/hooks/use-realtime'
import { useUsers } from '@/hooks/use-users'
import { getMetas, createMeta, updateMeta, deleteMeta, type Meta } from '@/services/metas'

const metaSchema = z.object({
  vendedor_id: z.string().min(1, 'Vendedor é obrigatório'),
  periodo: z.string().min(1, 'Período é obrigatório'),
  meta_valor: z.coerce.number().min(0, 'Valor deve ser positivo'),
  valor_realizado: z.coerce.number().min(0, 'Valor deve ser positivo'),
})

type MetaForm = z.infer<typeof metaSchema>

export default function Metas() {
  const { users } = useUsers()
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<MetaForm>({
    resolver: zodResolver(metaSchema),
    defaultValues: { vendedor_id: '', periodo: '', meta_valor: 0, valor_realizado: 0 },
  })

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
  }, [])

  useRealtime('metas', () => {
    loadData()
  })

  const onSubmit = async (data: MetaForm) => {
    try {
      if (editingId) {
        await updateMeta(editingId, data)
        toast.success('Meta atualizada')
      } else {
        await createMeta(data)
        toast.success('Meta criada')
      }
      setOpen(false)
      form.reset()
      setEditingId(null)
    } catch {
      toast.error('Erro ao salvar meta')
    }
  }

  const handleEdit = (meta: Meta) => {
    form.reset({
      vendedor_id: meta.vendedor_id,
      periodo: meta.periodo,
      meta_valor: meta.meta_valor,
      valor_realizado: meta.valor_realizado,
    })
    setEditingId(meta.id)
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta meta?')) return
    try {
      await deleteMeta(id)
      toast.success('Meta excluída')
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const getVendorName = (id: string) => {
    const u = users.find((u) => u.id === id)
    return u?.name || u?.email || 'N/A'
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Target className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
            <p className="text-muted-foreground text-sm">Metas mensais por vendedor.</p>
          </div>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) {
              form.reset()
              setEditingId(null)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="vendedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="periodo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Agosto 2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="meta_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valor_realizado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Realizado (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-subtle">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : metas.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">Nenhuma meta cadastrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="min-w-[140px]">Progresso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metas.map((m) => {
                  const pct =
                    m.meta_valor > 0 ? Math.min((m.valor_realizado / m.meta_valor) * 100, 100) : 0
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{getVendorName(m.vendedor_id)}</TableCell>
                      <TableCell>{m.periodo}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.meta_valor)}</TableCell>
                      <TableCell className="text-right text-primary">
                        {formatCurrency(m.valor_realizado)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={pct} className="h-2" />
                          <span className="text-[10px] text-muted-foreground">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(m.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
