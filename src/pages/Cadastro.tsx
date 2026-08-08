import { useState, useEffect, useMemo } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Edit, Building2, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getAllFactories, deleteFactoryPB } from '@/services/factories'
import { getScopedFactories } from '@/lib/user-scope'
import { FactoryForm } from '@/components/FactoryForm'
import { ImportExcelDialog } from '@/components/ImportExcelDialog'
import type { Factory } from '@/types'

export default function Cadastro() {
  const { user } = useAuth()
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingFactory, setEditingFactory] = useState<Factory | undefined>(undefined)

  const loadData = async () => {
    try {
      const all = await getAllFactories()
      setFactories(getScopedFactories(all, user))
    } catch {
      setFactories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  useRealtime('factories', () => loadData())

  const filtered = useMemo(() => {
    if (!search.trim()) return factories
    const q = search.toLowerCase()
    return factories.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.city?.toLowerCase().includes(q) ||
        f.gestor_tecnico_name?.toLowerCase().includes(q) ||
        f.vendedor_name?.toLowerCase().includes(q),
    )
  }, [factories, search])

  const handleEdit = (f: Factory) => {
    setEditingFactory(f)
    setDialogOpen(true)
  }

  const handleNew = () => {
    setEditingFactory(undefined)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta fábrica?')) return
    try {
      await deleteFactoryPB(id)
      toast.success('Fábrica excluída')
      loadData()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cadastro de Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie fábricas, gestores técnicos e vendedores.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> Importar
          </Button>
          <Button className="gap-2" onClick={handleNew}>
            <Plus className="w-4 h-4" /> Nova Fábrica
          </Button>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Fábricas Cadastradas</CardTitle>
          <CardDescription>{filtered.length} fábrica(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade, gestor ou vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Espécie</TableHead>
                    <TableHead>Funil</TableHead>
                    <TableHead>Gestor Técnico</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground h-16">
                        Nenhuma fábrica encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-sm">
                          {[f.city, f.state].filter(Boolean).join('/') || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {f.animalSpecies || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{f.funnelStage}</TableCell>
                        <TableCell className="text-sm">
                          {f.gestor_tecnico_name || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {f.vendedor_name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(f.id)}
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
    </div>
  )
}
