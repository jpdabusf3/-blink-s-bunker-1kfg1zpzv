import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import type { MemberPerformance } from '@/services/relatorio-performance'

interface Props {
  members: MemberPerformance[]
  relacionadoLabel: string
}

export function PerformanceReportTable({ members, relacionadoLabel }: Props) {
  if (members.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
        Nenhum registro encontrado com os filtros selecionados.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="text-center">Vendas</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead>Especies</TableHead>
            <TableHead>{relacionadoLabel}</TableHead>
            <TableHead className="text-right">Meta</TableHead>
            <TableHead className="w-32">% Meta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">
                {m.nome}
                <span className="block text-xs text-muted-foreground">{m.regiao}</span>
              </TableCell>
              <TableCell className="text-center">{m.totalVendas}</TableCell>
              <TableCell className="text-right font-semibold text-primary">
                {formatCurrency(m.valorTotal)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {m.distribuicaoEspecie.map((e) => (
                    <Badge key={e.name} variant="secondary" className="text-xs">
                      {e.name}: {e.value}
                    </Badge>
                  ))}
                  {m.distribuicaoEspecie.length === 0 && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {m.distribuicaoRelacionado.map((r) => (
                    <Badge key={r.name} variant="outline" className="text-xs">
                      {r.name}
                    </Badge>
                  ))}
                  {m.distribuicaoRelacionado.length === 0 && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right text-sm">
                {m.metaValor > 0 ? formatCurrency(m.metaValor) : '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(m.metaProgresso, 100)} className="w-20 h-2" />
                  <span className="text-xs font-medium whitespace-nowrap">
                    {m.metaProgresso.toFixed(0)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
