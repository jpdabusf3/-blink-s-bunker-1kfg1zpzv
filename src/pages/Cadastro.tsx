import { useState } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useI18n } from '@/hooks/use-i18n'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FactoryForm } from '@/components/FactoryForm'
import { FactoryDocuments } from '@/components/FactoryDocuments'
import { FactoryTasks } from '@/components/FactoryTasks'
import { FactoryChangeLog } from '@/components/FactoryChangeLog'
import { FactoryVisits } from '@/components/FactoryVisits'
import { isStale, formatCurrency, exportToCSV } from '@/lib/utils'
import { AlertTriangle, Search, Edit2, Trash2, Download, Plus } from 'lucide-react'
import { Factory } from '@/types'

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)

export default function Cadastro() {
  const { deleteFactory } = useAppContext()
  const factories = useScopedFactories()
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [profileTypeFilter, setProfileTypeFilter] = useState('all')
  const [editing, setEditing] = useState<Factory | null>(null)
  const [creating, setCreating] = useState(false)

  const uniqueCities = Array.from(new Set(factories.map((f) => f.city))).sort()

  const filtered = factories.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.city.toLowerCase().includes(search.toLowerCase()) ||
      f.sector?.toLowerCase().includes(search.toLowerCase()) ||
      f.profile_type?.toLowerCase().includes(search.toLowerCase()) ||
      f.animalSpecies?.toLowerCase().includes(search.toLowerCase()) ||
      f.contactName?.toLowerCase().includes(search.toLowerCase())
    const matchesPriority = priorityFilter === 'all' || f.priority === priorityFilter
    const matchesCity = cityFilter === 'all' || f.city === cityFilter
    const matchesProfileType =
      profileTypeFilter === 'all' ||
      f.profile_type === profileTypeFilter ||
      f.sector === profileTypeFilter

    return matchesSearch && matchesPriority && matchesCity && matchesProfileType
  })

  const handleExport = () => {
    const data = filtered.map((f) => ({
      Nome: f.name,
      Cidade: f.city,
      Região: f.region,
      'Nível Foco': f.focusLevel || '',
      Prioridade: f.priority || '',
      Setor: f.sector || '',
      'Linha Blink': f.productLineAffinity || '',
      Status: f.status,
      'Capacidade (t/mês)': f.capacity,
      'Potencial (R$)': f.potentialValue,
      'Estágio Funil': f.funnelStage,
      Contato: f.contactName,
      Telefone: f.contactPhone,
    }))
    exportToCSV('cadastro-fabricas.csv', data)
  }

  const handleWhatsAppShare = () => {
    let text = '*Lista de Fábricas Filtrada*\n\n'
    filtered.slice(0, 30).forEach((f) => {
      const priorityLabel =
        f.priority === 'High' ? '🟢 Alta' : f.priority === 'Medium' ? '🟡 Média' : '🔴 Baixa'
      text += `- ${f.name} (${f.city}) | Nível: ${f.focusLevel} | ${priorityLabel}\n`
    })
    if (filtered.length > 30) {
      text += `\n... e mais ${filtered.length - 30} empresas.`
    }
    const encodedText = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('cad.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('cad.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <Button onClick={() => setCreating(true)} className="gap-2 shadow-sm w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Novo Prospecto
          </Button>
          <Button
            onClick={handleWhatsAppShare}
            className="gap-2 shadow-sm bg-[#25D366] hover:bg-[#128C7E] text-white w-full sm:w-auto"
          >
            <WhatsAppIcon className="w-5 h-5" /> {t('cad.share')}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2 shadow-sm w-full sm:w-auto"
          >
            <Download className="w-5 h-5 md:w-4 md:h-4" /> {t('cad.exportPDF')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 bg-muted/30 p-3 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('cad.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <Select value={profileTypeFilter} onValueChange={setProfileTypeFilter}>
          <SelectTrigger className="w-full md:w-[180px] bg-background">
            <SelectValue placeholder="Carteira" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Carteiras</SelectItem>
            <SelectItem value="Indústria">Indústria</SelectItem>
            <SelectItem value="Cooperativa">Cooperativa</SelectItem>
            <SelectItem value="Integradora">Integradora</SelectItem>
            <SelectItem value="Premixeira">Premixeira</SelectItem>
            <SelectItem value="Produtores">Produtores</SelectItem>
            <SelectItem value="Distribuidor">Distribuidor</SelectItem>
            <SelectItem value="Outros">Outros</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full md:w-[160px] bg-background">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('cad.allPri')}</SelectItem>
            <SelectItem value="High">Alta Prioridade</SelectItem>
            <SelectItem value="Medium">Média Prioridade</SelectItem>
            <SelectItem value="Low">Baixa Prioridade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-full md:w-[220px] bg-background">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('cad.allCities')}</SelectItem>
            {uniqueCities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={handleExport}
          title="Exportar para Excel (CSV)"
          className="hidden md:flex bg-background shrink-0"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-card border rounded-lg overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t('cad.factory')}</TableHead>
                <TableHead>{t('cad.location')}</TableHead>
                <TableHead>{t('cad.sector')}</TableHead>
                <TableHead>{t('cad.pri')}</TableHead>
                <TableHead className="text-right">{t('cad.potential')}</TableHead>
                <TableHead className="text-center">{t('cad.actions')}</TableHead>
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
                      <div className="font-medium">{f.sector || '-'}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Nível: <span className="font-bold">{f.focusLevel || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full border-0 text-white ${f.priority === 'High' ? 'bg-green-600' : f.priority === 'Medium' ? 'bg-yellow-500' : 'bg-red-600'}`}
                      >
                        {f.priority === 'High'
                          ? 'Alta'
                          : f.priority === 'Medium'
                            ? 'Média'
                            : 'Baixa'}
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
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                    {t('cad.noResults')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtered.map((f) => {
          const stale = isStale(f.lastInteraction)
          return (
            <div
              key={f.id}
              className={`bg-card border rounded-lg p-4 shadow-sm relative ${stale ? 'border-destructive/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{f.name}</h3>
                    {stale && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {f.city} • {f.region}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`rounded-full border-0 text-white ${f.priority === 'High' ? 'bg-green-600' : f.priority === 'Medium' ? 'bg-yellow-500' : 'bg-red-600'}`}
                >
                  {f.priority === 'High' ? 'Alta' : f.priority === 'Medium' ? 'Média' : 'Baixa'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-sm mb-4">
                <div>
                  <span className="text-muted-foreground block text-xs">Setor</span>
                  <span className="font-medium">{f.sector || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Foco</span>
                  <span className="font-medium">{f.focusLevel || '-'}</span>
                </div>
                <div className="col-span-2 bg-muted/30 p-2 rounded-md mt-1 border">
                  <span className="text-muted-foreground block text-xs mb-0.5">Potencial</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(f.potentialValue)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">({f.capacity} t/mês)</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => setEditing(f)} className="gap-2">
                  <Edit2 className="w-4 h-4" /> {t('cad.details')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteFactory(f.id)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center p-8 text-muted-foreground border rounded-lg bg-card">
            {t('cad.noResults')}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fábrica: {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="dados" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="dados" className="text-xs sm:text-sm">
                  Cadastro
                </TabsTrigger>
                <TabsTrigger value="visits" className="text-xs sm:text-sm">
                  Visitas
                </TabsTrigger>
                <TabsTrigger value="docs" className="text-xs sm:text-sm">
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs sm:text-sm">
                  Tarefas
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-xs sm:text-sm">
                  Histórico
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dados" className="pt-4 focus-visible:outline-none">
                <FactoryForm factory={editing} onSubmit={() => setEditing(null)} />
              </TabsContent>
              <TabsContent value="visits" className="pt-4 focus-visible:outline-none">
                <FactoryVisits factoryId={editing.id} />
              </TabsContent>
              <TabsContent value="docs" className="pt-4 focus-visible:outline-none">
                <FactoryDocuments factory={editing} />
              </TabsContent>
              <TabsContent value="tasks" className="pt-4 focus-visible:outline-none">
                <FactoryTasks factoryId={editing.id} />
              </TabsContent>
              <TabsContent value="historico" className="pt-4 focus-visible:outline-none">
                <FactoryChangeLog factoryId={editing.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
