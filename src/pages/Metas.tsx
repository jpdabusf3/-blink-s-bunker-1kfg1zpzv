import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import pb from '@/lib/pocketbase/client'
import { Target } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
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
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Edit } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'

const targetSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  targetValue: z.coerce.number().min(0, 'Valor deve ser positivo'),
  categoryType: z.enum(['General', 'Region', 'Channel', 'ProductLine']),
  categoryValue: z.string().optional(),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().min(1, 'Data de fim é obrigatória'),
})

type TargetForm = z.infer<typeof targetSchema>

export default function Metas() {
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<TargetForm>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      name: '',
      targetValue: 0,
      categoryType: 'General',
      categoryValue: '',
      startDate: '',
      endDate: '',
    },
  })

  const loadTargets = async () => {
    try {
      const records = await pb.collection('targets').getFullList<Target>({
        sort: '-created',
      })
      setTargets(records)
    } catch (e) {
      toast.error('Erro ao carregar metas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTargets()
  }, [])

  useRealtime('targets', () => {
    loadTargets()
  })

  const onSubmit = async (data: TargetForm) => {
    try {
      const payload = {
        ...data,
        startDate: new Date(data.startDate + 'T00:00:00.000Z').toISOString(),
        endDate: new Date(data.endDate + 'T23:59:59.000Z').toISOString(),
      }

      if (editingId) {
        await pb.collection('targets').update(editingId, payload)
        toast.success('Meta atualizada com sucesso')
      } else {
        await pb.collection('targets').create(payload)
        toast.success('Meta criada com sucesso')
      }
      setOpen(false)
      form.reset()
      setEditingId(null)
    } catch (e) {
      toast.error('Erro ao salvar meta')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta meta?')) return
    try {
      await pb.collection('targets').delete(id)
      toast.success('Meta excluída com sucesso')
    } catch (e) {
      toast.error('Erro ao excluir meta')
    }
  }

  const handleEdit = (target: Target) => {
    form.reset({
      name: target.name,
      targetValue: target.targetValue,
      categoryType: target.categoryType,
      categoryValue: target.categoryValue,
      startDate: target.startDate.split('T')[0],
      endDate: target.endDate.split('T')[0],
    })
    setEditingId(target.id)
    setOpen(true)
  }

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metas de Vendas</h1>
          <p className="text-muted-foreground text-sm">Gerencie os objetivos e alvos de vendas.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(val) => {
            setOpen(val)
            if (!val) {
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Meta</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Meta Q3 Norte" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Alvo (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="General">Geral</SelectItem>
                            <SelectItem value="Region">Região</SelectItem>
                            <SelectItem value="Channel">Canal</SelectItem>
                            <SelectItem value="ProductLine">Linha de Produto</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="categoryValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor da Categoria</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Norte, Representantes..."
                            {...field}
                            disabled={form.watch('categoryType') === 'General'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Início</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fim</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar Meta</Button>
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
          ) : targets.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">Nenhuma meta cadastrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{formatCurrency(t.targetValue)}</TableCell>
                    <TableCell>
                      {t.categoryType === 'General'
                        ? 'Geral'
                        : `${t.categoryType}: ${t.categoryValue}`}
                    </TableCell>
                    <TableCell>
                      {new Date(t.startDate).toLocaleDateString('pt-BR')} até{' '}
                      {new Date(t.endDate).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(t.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
