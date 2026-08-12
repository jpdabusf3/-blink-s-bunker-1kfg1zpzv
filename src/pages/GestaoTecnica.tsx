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
  type GestaoFuncao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'

const CARTEIRAS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']

const FUNCAO_LABELS: Record<GestaoFuncao, string> = {
  gestor_tecnico: 'Gestor Técnico',
  vendedor: 'Vendedor',
  gestor_comercial: 'Gestor Comercial',
  gestor_especie: 'Gestor de Espécie',
  diretor: 'Diretor',
  ceo: 'CEO',
}

const FUNCAO_OPTIONS = Object.entries(FUNCAO_LABELS) as [GestaoFuncao, string][]

interface FormState {
  nome: string
  funcao: GestaoFuncao
  regiao: string
  carteira: string
  ativo: boolean
  subclassificacao: string
  canal_vendas: string
}

const EMPTY_FORM: FormState = {
  nome: '',
  funcao: 'gestor_tecnico',
  regiao: 'MT',
  carteira: '',
  ativo: true,
  subclassificacao: 'none',
  canal_vendas: 'none',
}

export default function GestaoTecnica() {
  const [members, setMembers] = useState<GestaoTecnica[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

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
        nome: form.nome,
        funcao: form.funcao,
        regiao: form.regiao,
        carteira: form.carteira || undefined,
        ativo: form.ativo,
        subclassificacao:
          form.funcao === 'gestor_comercial' && form.subclassificacao !== 'none'
            ? form.subclassificacao
            : '',
        canal_vendas: form.canal_vendas !== 'none' ? form.canal_vendas : '',
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
      setForm(EMPTY_FORM)
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
      subclassificacao: m.subclassificacao || 'none',
      canal_vendas: m.canal_vendas || 'none',
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
              Gestores técnicos, vendedores e demais cargos por região.
            </p>
          </div>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) {
              setEditingId(null)
              setForm(EMPTY_FORM)
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
                  onValueChange={(v) => setForm({ ...form, funcao: v as GestaoFuncao })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNCAO_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.funcao === 'gestor_comercial' && (
                <div className="space-y-2">
                  <Label>Subclassificação</Label>
                  <Select
                    value={form.subclassificacao}
                    onValueChange={(v) => setForm({ ...form, subclassificacao: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="indiretos">Indiretos</SelectItem>
                      <SelectItem value="diretos">Diretos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <div className="space-y-2">
                <Label>Canal de Vendas</Label>
                <Select
                  value={form.canal_vendas}
                  onValueChange={(v) => setForm({ ...form, canal_vendas: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="indireto">Indireto</SelectItem>
                    <SelectItem value="direto">Direto</SelectItem>
                  </SelectContent>
                </Select>
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
                <TableHead>Subclassificação</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Carteira</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground h-16">
                    Nenhum membro cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>
                      <Badge variant={m.funcao === 'gestor_tecnico' ? 'default' : 'secondary'}>
                        {FUNCAO_LABELS[m.funcao] || m.funcao}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.subclassificacao
                        ? m.subclassificacao === 'indiretos'
                          ? 'Indiretos'
                          : 'Diretos'
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {m.canal_vendas
                        ? m.canal_vendas === 'indireto'
                          ? 'Indireto'
                          : 'Direto'
                        : '-'}
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
