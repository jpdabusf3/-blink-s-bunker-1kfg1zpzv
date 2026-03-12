import { useState } from 'react'
import { useAppContext } from '@/store/AppContext'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FactoryForm } from '@/components/FactoryForm'
import { FactoryDocuments } from '@/components/FactoryDocuments'
import { isStale, formatCurrency, exportToCSV } from '@/lib/utils'
import { AlertTriangle, Search, Edit2, Trash2, Download } from 'lucide-react'
import { Factory } from '@/types'

export default function Cadastro() {
  const { factories, deleteFactory } = useAppContext()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Factory | null>(null)

  const filtered = factories.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.city.toLowerCase().includes(search.toLowerCase()),
  )

  const handleExport = () => {
    const data = filtered.map((f) => ({
      Nome: f.name,
      Cidade: f.city,
      Região: f.region,
      Status: f.status,
      'Capacidade (t/mês)': f.capacity,
      'Potencial (R$)': f.potentialValue,
      'Estágio Funil': f.funnelStage,
      'Probabilidade (%)': f.winProbability,
      Contato: f.contactName,
      Telefone: f.contactPhone,
      'Prazo Negociação': f.deadline ? new Date(f.deadline).toLocaleDateString('pt-BR') : '',
    }))
    exportToCSV('cadastro-fabricas.csv', data)
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastro de Fábricas</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie o banco de dados de clientes e prospects.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fábrica ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
            title="Exportar para Excel (CSV)"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Fábrica</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Potencial</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => {
                const stale = isStale(f.lastInteraction)
                return (
                  <TableRow key={f.id} className={stale ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {f.name}
                        {stale && (
                          <AlertTriangle
                            className="w-4 h-4 text-destructive"
                            title="Sem interação há mais de 15 dias"
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{f.operationTypes}</div>
                    </TableCell>
                    <TableCell>
                      {f.city}
                      <div className="text-xs text-muted-foreground mt-1">{f.region}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          f.status === 'Atendido'
                            ? 'default'
                            : f.status === 'Prospeção'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="rounded-full"
                      >
                        {f.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(f.potentialValue)}
                      <div className="text-xs text-muted-foreground font-normal mt-1">
                        {f.capacity} t/mês
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(f)}>
                          <Edit2 className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFactory(f.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    Nenhuma fábrica encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fábrica: {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="dados" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
                <TabsTrigger value="docs">Documentos e Anexos</TabsTrigger>
              </TabsList>
              <TabsContent value="dados" className="pt-4 focus-visible:outline-none">
                <FactoryForm factory={editing} onSubmit={() => setEditing(null)} />
              </TabsContent>
              <TabsContent value="docs" className="pt-4 focus-visible:outline-none">
                <FactoryDocuments factory={editing} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
