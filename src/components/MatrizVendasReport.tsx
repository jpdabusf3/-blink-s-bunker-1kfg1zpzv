import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { Loader2, Plus, Pencil, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useRealtime } from '@/hooks/use-realtime'
import { getMatrizVendas, type MatrizVenda } from '@/services/matriz-vendas'
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import { MatrizVendaForm } from '@/components/MatrizVendaForm'

const PAISES = ['Brasil', 'Paraguai', 'Chile']
const CARTEIRAS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']
const MESES = ['janeiro', 'fevereiro', 'maro', 'abril', 'maio', 'junho', 'julho', 'agosto']

interface FilterSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function MatrizVendasReport() {
  const [data, setData] = useState<MatrizVenda[]>([])
  const [loading, setLoading] = useState(true)
  const [paisFilter, setPaisFilter] = useState('all')
  const [carteiraFilter, setCarteiraFilter] = useState('all')
  const [mesFilter, setMesFilter] = useState('all')
  const [gestorFilter, setGestorFilter] = useState('all')
  const [vendedorFilter, setVendedorFilter] = useState('all')
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<MatrizVenda | undefined>()

  const loadData = async () => {
    try {
      const records = await getMatrizVendas()
      setData(records)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    Promise.all([getGestoresTecnicos(), getVendedoresGestao()])
      .then(([g, v]) => {
        setGestores(g)
        setVendedores(v)
      })
      .catch(() => {})
  }, [])

  useRealtime('matriz_vendas', () => loadData())

  const filtered = useMemo(
    () =>
      data.filter((d) => {
        if (paisFilter !== 'all' && d.pais !== paisFilter) return false
        if (carteiraFilter !== 'all' && d.carteira !== carteiraFilter) return false
        if (mesFilter !== 'all' && d.mes !== mesFilter) return false
        if (gestorFilter !== 'all' && d.gestor_tecnico_id !== gestorFilter) return false
        if (vendedorFilter !== 'all' && d.vendedor_id !== vendedorFilter) return false
        return true
      }),
    [data, paisFilter, carteiraFilter, mesFilter, gestorFilter, vendedorFilter],
  )

  const totalValor = filtered.reduce((sum, d) => sum + (d.valor || 0), 0)

  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((d) => {
      const key = d.carteira || 'N/A'
      map.set(key, (map.get(key) || 0) + (d.valor || 0))
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const handleNew = () => {
    setEditData(undefined)
    setDialogOpen(true)
  }
  const handleEdit = (d: MatrizVenda) => {
    setEditData(d)
    setDialogOpen(true)
  }
  const handleClose = () => {
    setDialogOpen(false)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-subtle">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Matriz de Vendas — Realizado 2026
          </CardTitle>
          <Button size="sm" onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1" />
            Novo Registro
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <FilterSelect
              label="País"
              value={paisFilter}
              onChange={setPaisFilter}
              options={PAISES.map((p) => ({ value: p, label: p }))}
            />
            <FilterSelect
              label="Carteira"
              value={carteiraFilter}
              onChange={setCarteiraFilter}
              options={CARTEIRAS.map((c) => ({ value: c, label: c }))}
            />
            <FilterSelect
              label="Mês"
              value={mesFilter}
              onChange={setMesFilter}
              options={MESES.map((m) => ({ value: m, label: m }))}
            />
            <FilterSelect
              label="Gestor Técnico"
              value={gestorFilter}
              onChange={setGestorFilter}
              options={gestores.map((g) => ({ value: g.id, label: g.nome }))}
            />
            <FilterSelect
              label="Vendedor"
              value={vendedorFilter}
              onChange={setVendedorFilter}
              options={vendedores.map((v) => ({ value: v.id, label: v.nome }))}
            />
          </div>

          <div className="flex items-center gap-4 rounded-lg bg-primary/5 px-4 py-3">
            <div className="text-sm text-muted-foreground">{filtered.length} registro(s)</div>
            <div className="text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-bold text-primary text-lg">{formatCurrency(totalValor)}</span>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="h-[280px]">
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `R$ ${v / 1000}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>País</TableHead>
                  <TableHead>Carteira</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Gestor Técnico</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground h-16">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.pais}</TableCell>
                      <TableCell>{d.carteira}</TableCell>
                      <TableCell className="capitalize">{d.mes}</TableCell>
                      <TableCell className="text-sm">
                        {d.expand?.gestor_tecnico_id?.nome || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.expand?.vendedor_id?.nome || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(d.valor)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(d)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editData ? 'Editar Registro' : 'Novo Registro'}</DialogTitle>
          </DialogHeader>
          <MatrizVendaForm onSubmit={handleClose} initialData={editData} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
