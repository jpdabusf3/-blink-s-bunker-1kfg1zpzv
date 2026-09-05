import { useState, useMemo, useEffect, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Filter, Download, Upload, Trash2, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/utils'
import {
  getHistoricoVendas,
  deleteHistoricoVenda,
  ESPECIE_OPTIONS,
  CANAL_VENDAS_OPTIONS,
  type HistoricoVenda,
} from '@/services/historico-vendas'
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import { UploadPedidoDialog } from '@/components/UploadPedidoDialog'
import { UploadNfeDialog } from '@/components/UploadNfeDialog'
import { NfeReviewQueue } from '@/components/NfeReviewQueue'
import { VendaForm } from '@/components/VendaForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Layers } from 'lucide-react'
import { getNfePedidos } from '@/services/nfe-service'

export default function Pedidos() {
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<HistoricoVenda[]>([])
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [loading, setLoading] = useState(true)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [nfeUploadOpen, setNfeUploadOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'implantados' | 'revisao'>('implantados')
  const [pendentesCount, setPendentesCount] = useState(0)
  const [editing, setEditing] = useState<HistoricoVenda | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fEspecie, setFEspecie] = useState('all')
  const [fGestor, setFGestor] = useState('all')
  const [fVendedor, setFVendedor] = useState('all')
  const [fCanal, setFCanal] = useState('all')
  const [busca, setBusca] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [vendas, nfes, nfRecords] = await Promise.all([
        getHistoricoVendas(),
        getNfePedidos('all').catch(() => []),
        pb
          .collection('notas_fiscais')
          .getFullList({ filter: 'status="importada" || status="pendente"' })
          .catch(() => []),
      ])
      setPedidos(vendas)
      const pCount =
        nfes.filter((n) => n.status === 'pendente' || n.status === 'pendencia_produto').length +
        nfRecords.length
      setPendentesCount(pCount)
    } catch {
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    getGestoresTecnicos()
      .then(setGestores)
      .catch(() => {})
    getVendedoresGestao()
      .then(setVendedores)
      .catch(() => {})
  }, [loadData])

  useRealtime('historico_vendas', () => loadData())
  useRealtime('nfe_pedidos', () => loadData())
  useRealtime('notas_fiscais', () => loadData())

  const filtered = useMemo(() => {
    let r = [...pedidos]
    if (fEspecie !== 'all') r = r.filter((p) => p.especie === fEspecie)
    if (fGestor !== 'all') r = r.filter((p) => p.gestor_tecnico_id === fGestor)
    if (fVendedor !== 'all') r = r.filter((p) => p.vendedor_id === fVendedor)
    if (fCanal !== 'all') r = r.filter((p) => p.canal_vendas === fCanal)
    if (startDate) r = r.filter((p) => new Date(p.data) >= new Date(startDate))
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      r = r.filter((p) => new Date(p.data) <= end)
    }
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      r = r.filter(
        (p) => p.cliente?.toLowerCase().includes(q) || p.observacoes?.toLowerCase().includes(q),
      )
    }
    return r.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [pedidos, fEspecie, fGestor, fVendedor, fCanal, startDate, endDate, busca])

  const totalValor = filtered.reduce((s, p) => s + (p.valor || 0), 0)

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setFEspecie('all')
    setFGestor('all')
    setFVendedor('all')
    setFCanal('all')
    setBusca('')
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteHistoricoVenda(deletingId)
      toast({ title: 'Pedido excluído', description: 'Registro removido do histórico.' })
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleExportCSV = () => {
    if (filtered.length === 0) return
    const sep = ';'
    const headers = [
      'Data',
      'Cliente',
      'Espécie',
      'Gestor Técnico',
      'Vendedor',
      'Canal de Vendas',
      'Valor',
      'Origem',
      'Observações',
    ]
    const lines = [
      headers.join(sep),
      ...filtered.map((p) =>
        [
          p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '',
          `"${(p.cliente || '').replace(/"/g, '""')}"`,
          p.especie || '',
          `"${(p.expand?.gestor_tecnico_id?.nome || '').replace(/"/g, '""')}"`,
          `"${(p.expand?.vendedor_id?.nome || '').replace(/"/g, '""')}"`,
          p.canal_vendas || '',
          (p.valor || 0).toFixed(2).replace('.', ','),
          p.origem || '',
          `"${(p.observacoes || '').replace(/"/g, '""')}"`,
        ].join(sep),
      ),
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: 'Exportando CSV', description: `${filtered.length} pedido(s) exportados.` })
  }

  const handleExportPDF = () => {
    if (filtered.length === 0) return
    const win = window.open('', '_blank')
    if (!win) {
      toast({
        title: 'Aviso',
        description: 'Desbloqueie os pop-ups para gerar o PDF.',
        variant: 'destructive',
      })
      return
    }
    const rows = filtered
      .map(
        (p) =>
          `<tr><td>${p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '-'}</td><td>${p.cliente || '-'}</td><td>${p.especie || '-'}</td><td>${p.expand?.gestor_tecnico_id?.nome || '-'}</td><td>${p.expand?.vendedor_id?.nome || '-'}</td><td>${p.canal_vendas || '-'}</td><td class="r">${formatCurrency(p.valor || 0)}</td><td>${p.origem || '-'}</td></tr>`,
      )
      .join('')
    const html = `<!DOCTYPE html><html><head><title>Implantação de Pedidos - Blink Biotech</title><meta charset="utf-8"><style>
    body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#333}h1{color:#1e3a8a}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
    th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f1f5f9}.r{text-align:right}
    </style></head><body><h1>Implantação de Pedidos - Blink Biotech</h1><p>Gerado em: ${new Date().toLocaleString('pt-BR')} | Total: ${filtered.length} pedido(s) | Valor: ${formatCurrency(totalValor)}</p><table><thead><tr><th>Data</th><th>Cliente</th><th>Espécie</th><th>Gestor</th><th>Vendedor</th><th>Canal</th><th class="r">Valor</th><th>Origem</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script></body></html>`
    win.document.write(html)
    win.document.close()
    toast({ title: 'Gerando PDF', description: 'Documento preparado para impressão.' })
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Implantação de Novos Pedidos</h1>
          <p className="text-muted-foreground text-sm">
            Implante pedidos via upload de PDF de nota fiscal + modelo Excel, com extração
            automática por IA. Ao implantar, volumes, metas e afins são atualizados automaticamente.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            className="gap-2 shadow-sm bg-primary hover:bg-primary/90"
            onClick={() => setNfeUploadOpen(true)}
          >
            <Sparkles className="w-4 h-4" /> Leitor de NF (PDF)
          </Button>
          <UploadPedidoDialog open={uploadOpen} onOpenChange={setUploadOpen} onImported={loadData}>
            <Button variant="outline" className="gap-2 shadow-sm">
              <Upload className="w-4 h-4" /> Importar Excel / CSV
            </Button>
          </UploadPedidoDialog>
          <Button
            variant="outline"
            className="gap-2 shadow-sm"
            onClick={() => setEditing({} as HistoricoVenda)}
          >
            <FileText className="w-4 h-4" /> Registrar Manual
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="implantados" className="gap-2">
            <FileText className="w-4 h-4" /> Pedidos Implantados ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="revisao" className="gap-2 relative">
            <Layers className="w-4 h-4" /> Fila de Revisão de NFs
            {pendentesCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendentesCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revisao" className="space-y-4 pt-4">
          <NfeReviewQueue onPedidoAprovado={loadData} onOpenUpload={() => setNfeUploadOpen(true)} />
        </TabsContent>

        <TabsContent value="implantados" className="space-y-6 pt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-subtle">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Pedidos</p>
                <p className="text-2xl font-bold">{filtered.length}</p>
              </CardContent>
            </Card>
            <Card className="shadow-subtle">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalValor)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-subtle">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(filtered.length > 0 ? totalValor / filtered.length : 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-subtle">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Via IA (upload)</p>
                <p className="text-2xl font-bold">
                  {filtered.filter((p) => p.origem === 'upload').length}
                </p>
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
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cliente / Observação</Label>
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar..."
                />
              </div>
              <div className="space-y-2">
                <Label>Espécie</Label>
                <Select value={fEspecie} onValueChange={setFEspecie}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
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
                    <SelectValue placeholder="Todos" />
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
                    <SelectValue placeholder="Todos" />
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
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {CANAL_VENDAS_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={clearFilters} className="flex-1">
                  Limpar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={filtered.length === 0}
                      className="flex-1 gap-2 text-primary border-primary/20 hover:bg-primary/5"
                    >
                      <Download className="w-4 h-4" /> Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportPDF}>Documento PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV}>
                      Planilha Excel (CSV)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-subtle">
            <CardHeader>
              <CardTitle>Pedidos Implantados</CardTitle>
              <CardDescription>
                Mostrando {filtered.length} pedido(s) · Valor total {formatCurrency(totalValor)}
              </CardDescription>
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
                        <TableHead>Gestor Técnico</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground h-32">
                            Nenhum pedido implantado. Use “Importar PDF + Excel” para começar.
                          </TableCell>
                        </TableRow>
                      )}
                      {filtered.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap font-medium">
                            {p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell className="font-medium">{p.cliente}</TableCell>
                          <TableCell>{p.especie || '-'}</TableCell>
                          <TableCell>{p.expand?.gestor_tecnico_id?.nome || '-'}</TableCell>
                          <TableCell>{p.expand?.vendedor_id?.nome || '-'}</TableCell>
                          <TableCell>{p.canal_vendas || '-'}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {formatCurrency(p.valor || 0)}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs capitalize">{p.origem || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditing(p)}
                                title="Editar pedido"
                              >
                                <FileText className="w-4 h-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingId(p.id)}
                                title="Excluir pedido"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={!!editing}
            onOpenChange={(open) => {
              if (!open) setEditing(null)
            }}
          >
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editing?.id ? 'Editar Pedido' : 'Registrar Pedido'}</DialogTitle>
              </DialogHeader>
              {editing && (
                <VendaForm
                  onSubmit={() => {
                    setEditing(null)
                    loadData()
                  }}
                  initialData={editing.id ? editing : undefined}
                />
              )}
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Pedido?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover este pedido permanentemente? Esta ação não poderá
                  ser desfeita e os volumes/metas serão recalculados automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sim, Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>

      <UploadNfeDialog
        open={nfeUploadOpen}
        onOpenChange={setNfeUploadOpen}
        onSuccess={loadData}
        onOpenReviewQueue={() => setActiveTab('revisao')}
      />
    </div>
  )
}
