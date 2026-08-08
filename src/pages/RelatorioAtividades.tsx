import { useState, useEffect, useMemo, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { OriginIndicator } from '@/components/OriginIndicator'
import { UserFilter } from '@/components/UserFilter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, FileSpreadsheet, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { exportAtividadesToCSV, exportAtividadesToPDF } from '@/lib/exportAtividades'
import type { Atividade } from '@/types'

const TIPOS = [
  { value: 'visita', label: 'Visita' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'pedido', label: 'Pedido' },
  { value: 'outro', label: 'Outro' },
]

const ETAPAS = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'pos_venda', label: 'Pós-venda' },
]

export default function RelatorioAtividades() {
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [vendedorFilter, setVendedorFilter] = useState('all')
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [tipoFilter, setTipoFilter] = useState('all')
  const [etapaFilter, setEtapaFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const data = await pb.collection('atividades').getFullList({
        sort: '-created',
        expand: 'cliente_id,vendedor_id',
      })
      setAtividades(data as unknown as Atividade[])
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtime('atividades', () => {
    load()
  })

  const filtered = useMemo(
    () =>
      atividades.filter((a) => {
        const created = new Date(a.created)
        if (dataInicial && created < new Date(dataInicial)) return false
        if (dataFinal && created > new Date(dataFinal + 'T23:59:59')) return false
        if (vendedorFilter !== 'all' && a.vendedor_id !== vendedorFilter) return false
        if (tipoFilter !== 'all' && a.tipo_atividade !== tipoFilter) return false
        if (etapaFilter !== 'all' && a.etapa_funil !== etapaFilter) return false
        return true
      }),
    [atividades, dataInicial, dataFinal, vendedorFilter, tipoFilter, etapaFilter],
  )

  const summary = useMemo(() => {
    const totalVisitas = filtered.filter((a) => a.tipo_atividade === 'visita').length
    const totalLigacoes = filtered.filter((a) => a.tipo_atividade === 'ligacao').length
    const valorTotal = filtered.reduce((acc, a) => acc + (a.valor_estimado || 0), 0)
    const etapaMap = new Map<string, number>()
    filtered.forEach((a) => {
      const e = a.etapa_funil || 'Sem etapa'
      etapaMap.set(e, (etapaMap.get(e) || 0) + 1)
    })
    return {
      totalVisitas,
      totalLigacoes,
      valorTotal,
      etapaDist: Array.from(etapaMap.entries()) as [string, number][],
    }
  }, [filtered])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const filterProps = { dataInicial, dataFinal }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Atividades</h1>
          <p className="text-muted-foreground text-sm">
            Monitor de atividades comerciais da equipe
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportAtividadesToCSV(filtered, filterProps)}
            disabled={filtered.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Relatório
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportAtividadesToPDF(filtered, summary, filterProps)}
            disabled={filtered.length === 0}
          >
            <FileText className="w-4 h-4" /> Gerar PDF
          </Button>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Vendedor</label>
            <UserFilter
              value={vendedorFilter}
              onChange={setVendedorFilter}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Data Inicial</label>
            <Input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Data Final</label>
            <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Tipo de Atividade</label>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Etapa do Funil</label>
            <Select value={etapaFilter} onValueChange={setEtapaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ETAPAS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Visitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{summary.totalVisitas}</div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Ligações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{summary.totalLigacoes}</div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total Estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(summary.valorTotal)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribuição por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.etapaDist.length > 0 ? (
                summary.etapaDist.map(([etapa, count]) => (
                  <Badge key={etapa} variant="secondary" className="text-xs">
                    {etapa}: {count}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Sem dados</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Próximo Passo</TableHead>
                <TableHead>Pendências</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(a.created).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-sm">{a.expand?.vendedor_id?.name || '—'}</TableCell>
                  <TableCell className="font-medium text-sm">
                    {a.expand?.cliente_id?.name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {a.tipo_atividade}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{a.etapa_funil || '—'}</TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    {a.valor_estimado ? formatCurrency(a.valor_estimado) : '—'}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">
                    {a.proximo_passo || '—'}
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">
                    {a.pendencias || '—'}
                  </TableCell>
                  <TableCell>
                    <OriginIndicator origem={a.origem} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                    Nenhuma atividade encontrada com os filtros selecionados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
