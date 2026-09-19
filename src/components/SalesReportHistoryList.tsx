import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { formatDataHoraBR } from '@/lib/corporateDocuments'
import { FileText, Clock, Calendar, ExternalLink, DollarSign, Layers } from 'lucide-react'
import {
  type SalesReportHistoryItem,
  type GeneratedSalesReportData,
} from '@/services/sales-report-generator'

interface SalesReportHistoryListProps {
  history: SalesReportHistoryItem[]
  loading: boolean
  onSelectReport: (report: GeneratedSalesReportData | SalesReportHistoryItem) => void
  activeReportId?: string
}

export function SalesReportHistoryList({
  history,
  loading,
  onSelectReport,
  activeReportId,
}: SalesReportHistoryListProps) {
  if (loading) {
    return (
      <Card className="border shadow-subtle">
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          Carregando histórico de relatórios...
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card className="border shadow-subtle border-dashed">
        <CardContent className="py-8 text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Nenhum relatório salvo no histórico
          </p>
          <p className="text-xs text-muted-foreground">
            Os relatórios gerados ficam listados aqui e nas abas de Documentos e Relatórios
            Automáticos.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border shadow-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Últimos Relatórios de Vendas Gerados
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Clique em qualquer relatório abaixo para reabri-lo instantaneamente.
            </p>
          </div>
          <Badge variant="outline">{history.length} registrado(s)</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título / Identificação</TableHead>
                <TableHead className="w-48">Período Coberto</TableHead>
                <TableHead className="w-44">Data de Geração</TableHead>
                <TableHead className="text-right w-40">Total Faturado</TableHead>
                <TableHead className="text-right w-28">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => {
                const isActive = activeReportId === item.id
                const periodoStr =
                  item.periodoInicio && item.periodoFim
                    ? `${item.periodoInicio} a ${item.periodoFim}`
                    : 'Período Geral'

                return (
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer transition-colors ${
                      isActive ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onSelectReport(item.dataPayload || item)}
                  >
                    <TableCell className="font-medium text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate max-w-md">{item.title}</span>
                      {isActive && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-primary/10 text-primary border-primary/20"
                        >
                          Aberto
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {periodoStr}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDataHoraBR(item.created)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary text-xs">
                      {item.totalFaturado > 0 ? formatCurrency(item.totalFaturado) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        className="h-7 text-xs gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectReport(item.dataPayload || item)
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Reabrir
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="grid grid-cols-1 gap-2.5 md:hidden">
          {history.map((item) => {
            const isActive = activeReportId === item.id
            const periodoStr =
              item.periodoInicio && item.periodoFim
                ? `${item.periodoInicio} a ${item.periodoFim}`
                : 'Período Geral'

            return (
              <div
                key={item.id}
                onClick={() => onSelectReport(item.dataPayload || item)}
                className={`p-3 rounded-lg border text-sm space-y-2 cursor-pointer transition-colors ${
                  isActive ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-bold text-foreground text-xs truncate">{item.title}</span>
                  </div>
                  {isActive && (
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 bg-primary/10 text-primary border-primary/20"
                    >
                      Aberto
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span className="font-mono text-[11px]">{periodoStr}</span>
                  <span className="text-[11px]">{formatDataHoraBR(item.created)}</span>
                </div>

                {item.totalFaturado > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Faturado:</span>
                    <span className="font-bold font-mono text-primary">
                      {formatCurrency(item.totalFaturado)}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
