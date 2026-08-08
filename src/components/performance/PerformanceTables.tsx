import type { MemberPerformance, PerformanceReportData } from '@/services/performance-report'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Trophy } from 'lucide-react'

function DistBadges({ dist }: { dist: Record<string, number> }) {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <Badge key={k} variant="secondary" className="text-xs">
          {k}: {v}
        </Badge>
      ))}
    </div>
  )
}

function MetaCell({
  meta,
  realizado,
  achievement,
}: {
  meta: number
  realizado: number
  achievement: number
}) {
  if (meta === 0) return <span className="text-muted-foreground">—</span>
  const color =
    achievement >= 100 ? 'text-emerald-600' : achievement >= 70 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="text-xs">
      <div className={color + ' font-bold'}>{achievement.toFixed(1)}%</div>
      <div className="text-muted-foreground">
        {formatCurrency(realizado)} / {formatCurrency(meta)}
      </div>
    </div>
  )
}

interface Props {
  gestores: MemberPerformance[]
  vendedores: MemberPerformance[]
  gestorRanking: PerformanceReportData['gestorRanking']
  vendedorRanking: PerformanceReportData['vendedorRanking']
}

export function PerformanceTables({ gestores, vendedores, gestorRanking, vendedorRanking }: Props) {
  return (
    <>
      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Relatório por Gestor Técnico</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gestor</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Espécies</TableHead>
                <TableHead>Equipe (Vendedores)</TableHead>
                <TableHead>Meta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gestores.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.nome}</TableCell>
                  <TableCell className="text-right">{g.totalVendas}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatCurrency(g.valorTotal)}
                  </TableCell>
                  <TableCell>
                    <DistBadges dist={g.especieDist} />
                  </TableCell>
                  <TableCell>
                    <DistBadges dist={g.linkedDist} />
                  </TableCell>
                  <TableCell>
                    <MetaCell
                      meta={g.metaValor}
                      realizado={g.valorRealizado}
                      achievement={g.metaAchievement}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {gestores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-16">
                    Sem dados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Relatório por Vendedor</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Espécies</TableHead>
                <TableHead>Gestores Vinculados</TableHead>
                <TableHead>Meta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedores.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.nome}</TableCell>
                  <TableCell className="text-right">{v.totalVendas}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {formatCurrency(v.valorTotal)}
                  </TableCell>
                  <TableCell>
                    <DistBadges dist={v.especieDist} />
                  </TableCell>
                  <TableCell>
                    <DistBadges dist={v.linkedDist} />
                  </TableCell>
                  <TableCell>
                    <MetaCell
                      meta={v.metaValor}
                      realizado={v.valorRealizado}
                      achievement={v.metaAchievement}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {vendedores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-16">
                    Sem dados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Ranking de Gestores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gestorRanking.map((g, i) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}º</span>
                    <span className="font-medium">{g.nome}</span>
                  </div>
                  <span className="font-bold text-primary">{formatCurrency(g.valor)}</span>
                </div>
              ))}
              {gestorRanking.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Ranking de Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {vendedorRanking.map((v, i) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}º</span>
                    <span className="font-medium">{v.nome}</span>
                  </div>
                  <span className="font-bold text-primary">{formatCurrency(v.valor)}</span>
                </div>
              ))}
              {vendedorRanking.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
