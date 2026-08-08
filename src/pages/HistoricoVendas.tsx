import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, TrendingUp, Plus, Upload, Download, Edit2, Trash2, Filter } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import {
  getHistoricoVendas,
  deleteHistoricoVenda,
  downloadPedidoModel,
  ESPECIE_OPTIONS,
  CANAL_VENDAS_OPTIONS,
  type HistoricoVenda,
} from '@/services/historico-vendas'
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import { VendaForm } from '@/components/VendaForm'
import { UploadPedidoDialog } from '@/components/UploadPedidoDialog'

export default function HistoricoVendas() {
  const { toast } = useToast()
  const [data, setData] = useState<HistoricoVenda[]>([])
  const [loading, setLoading] = useState(true)
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [fEspecie, setFEspecie] = useState('all')
  const [fGestor, setFGestor] = useState('all')
  const [fVendedor, setFVendedor] = useState('all')
  const [fCanal, setFCanal] = useState('all')
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [editing, setEditing] = useState<HistoricoVenda | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const loadData = async () => {
    try {
      setData(await getHistoricoVendas())
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    getGestoresTecnicos()
      .then(setGestores)
      .catch(() => {})
    getVendedoresGestao()
      .then(setVendedores)
      .catch(() => {})
  }, [])

  useRealtime('historico_vendas', () => loadData())

  const filtered = useMemo(() => {
    let r = [...data]
    if (fEspecie !== 'all') r = r.filter((d) => d.especie === fEspecie)
    if (fGestor !== 'all') r = r.filter((d) => d.gestor_tecnico_id === fGestor)
    if (fVendedor !== 'all') r = r.filter((d) => d.vendedor_id === fVendedor)
    if (fCanal !== 'all') r = r.filter((d) => d.canal_vendas === fCanal)
    return r
  }, [data, fEspecie, fGestor, fVendedor, fCanal])

  const totalValor = filtered.reduce((s, d) => s + (d.valor || 0), 0)

  const handleDelete = async (id: string) => {
    try {
      await deleteHistoricoVenda(id)
      toast({ title: 'Excluído', description: 'Registro removido.' })
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie todo o histórico de vendas em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadPedidoModel}>
            <Download className="w-4 h-4" /> Baixar Modelo
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4" /> Upload de Pedido
          </Button>
          <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Registrar Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Registrar Venda</DialogTitle>
              </DialogHeader>
              <VendaForm onSubmit={() => setIsNewOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total de Registros</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalValor)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Espécie</Label>
            <Select value={fEspecie} onValueChange={setFEspecie}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ESPECIE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gestor Técnico</Label>
            <Select value={fGestor} onValueChange={setFGestor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {gestores.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vendedor</Label>
            <Select value={fVendedor} onValueChange={setFVendedor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Canal de Vendas</Label>
            <Select value={fCanal} onValueChange={setFCanal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CANAL_VENDAS_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Vendas</CardTitle>
          <CardDescription>{filtered.length} registro(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Espécie</TableHead>
                    <TableHead>Gestor</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground h-16">
                        Nenhum registro encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{r.cliente}</TableCell>
                        <TableCell>{r.especie}</TableCell>
                        <TableCell>{r.expand?.gestor_tecnico_id?.nome || '-'}</TableCell>
                        <TableCell>{r.expand?.vendedor_id?.nome || '-'}</TableCell>
                        <TableCell>{r.canal_vendas || '-'}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(r.valor)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs capitalize">{r.origem}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                              <Edit2 className="w-4 h-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Venda</DialogTitle>
          </DialogHeader>
          {editing && <VendaForm onSubmit={() => setEditing(null)} initialData={editing} />}
        </DialogContent>
      </Dialog>

      <UploadPedidoDialog open={uploadOpen} onOpenChange={setUploadOpen} onImported={loadData} />
    </div>
  )
}
