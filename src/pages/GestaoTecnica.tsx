import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Trash2, Edit, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getGestaoTecnica,
  createGestaoTecnica,
  updateGestaoTecnica,
  deleteGestaoTecnica,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'

const CARTEIRAS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']

export default function GestaoTecnica() {
  const [members, setMembers] = useState<GestaoTecnica[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '',
    funcao: 'gestor_tecnico' as 'gestor_tecnico' | 'vendedor',
    regiao: 'MT',
    carteira: '',
    ativo: true,
  })

  const loadData = async () => {
    try {
      const data = await getGestaoTecnica()
      setMembers(data)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('gestao_tecnica', () => loadData())

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    try {
      const payload = {
        ...form,
        carteira: form.carteira || undefined,
      }
      if (editingId) {
        await updateGestaoTecnica(editingId, payload)
        toast.success('Membro atualizado')
      } else {
        await createGestaoTecnica(payload)
        toast.success('Membro criado')
      }
      setOpen(false)
      setEditingId(null)
      setForm({ nome: '', funcao: 'gestor_tecnico', regiao: 'MT', carteira: '', ativo: true })
      loadData()
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  const handleEdit = (m: GestaoTecnica) => {
    setForm({
      nome: m.nome,
      funcao: m.funcao,
      regiao: m.regiao,
      carteira: m.carteira || '',
      ativo: m.ativo,
    })
    setEditingId(m.id)
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este membro?')) return
    try {
      await deleteGestaoTecnica(id)
      toast.success('Membro excluído')
      loadData()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const gestores = members.filter((m) => m.funcao === 'gestor_tecnico')
  const vendedores = members.filter((m) => m.funcao === 'vendedor')

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <UserCog className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão Técnica</h1>
            <p className="text-muted-foreground text-sm">
              Gestores técnicos e vendedores por região.
            </p>
          </div>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) {
              setEditingId(null)
              setForm({
                nome: '',
                funcao: 'gestor_tecnico',
                regiao: 'MT',
                carteira: '',
                ativo: true,
              })
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Membro' : 'Novo Membro'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={form.funcao}
                  onValueChange={(v) => setForm({ ...form, funcao: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gestor_tecnico">Gestor Técnico</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Região</Label>
                  <Input
                    value={form.regiao}
                    onChange={(e) => setForm({ ...form, regiao: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carteira</Label>
                  <Select
                    value={form.carteira || 'none'}
                    onValueChange={(v) => setForm({ ...form, carteira: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {CARTEIRAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
                <Label>Ativo</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-subtle">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{gestores.length}</p>
            <p className="text-xs text-muted-foreground">Gestores Técnicos</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{vendedores.length}</p>
            <p className="text-xs text-muted-foreground">Vendedores</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-subtle">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Carteira</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-16">
                    Nenhum membro cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>
                      <Badge variant={m.funcao === 'gestor_tecnico' ? 'default' : 'secondary'}>
                        {m.funcao === 'gestor_tecnico' ? 'Gestor Técnico' : 'Vendedor'}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.regiao}</TableCell>
                    <TableCell>{m.carteira || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={m.ativo ? 'outline' : 'destructive'}
                        className={m.ativo ? 'text-emerald-600' : ''}
                      >
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
