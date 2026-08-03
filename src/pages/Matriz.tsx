import { useState } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { UserFilter } from '@/components/UserFilter'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getMatrixScore, getMatrixClassification } from '@/lib/utils'
import { Factory } from '@/types'

export default function Matriz() {
  const { updateFactory } = useAppContext()
  const factories = useScopedFactories()
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')

  const update = (id: string, field: keyof Factory['matrix'], val: number) => {
    const f = factories.find((x) => x.id === id)
    if (!f) return
    updateFactory(id, { matrix: { ...f.matrix, [field]: val } })
  }

  const getScoreColor = (score: number) => {
    if (score > 8) return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-transparent'
    if (score >= 5) return 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-transparent'
    return 'bg-rose-100 text-rose-800 hover:bg-rose-200 border-transparent'
  }

  // Sort by score descending
  const filtered =
    salesOwnerFilter === 'all'
      ? factories
      : factories.filter((f) => f.salesOwner === salesOwnerFilter)
  const sorted = [...filtered].sort((a, b) => getMatrixScore(b.matrix) - getMatrixScore(a.matrix))

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matriz de Prioridade</h1>
        <p className="text-muted-foreground text-sm">
          Atribua notas de 0 a 10 para ranquear automaticamente as melhores oportunidades.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <UserFilter value={salesOwnerFilter} onChange={setSalesOwnerFilter} className="w-[240px]" />
      </div>

      <div className="bg-card border rounded-lg shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="min-w-[200px]">Fábrica</TableHead>
                <TableHead className="text-center text-xs" title="Potencial Financeiro">
                  Financeiro
                </TableHead>
                <TableHead className="text-center text-xs" title="Compatibilidade Técnica">
                  Técnica
                </TableHead>
                <TableHead className="text-center text-xs" title="Fit Portfólio Blink">
                  Fit Portfólio
                </TableHead>
                <TableHead className="text-center text-xs" title="Abertura do Comprador">
                  Abertura
                </TableHead>
                <TableHead className="text-center text-xs" title="Concorrência Atual">
                  Concorrência
                </TableHead>
                <TableHead className="text-center text-xs" title="Senso de Urgência">
                  Urgência
                </TableHead>
                <TableHead className="text-center text-xs" title="Expectativa de ROI">
                  ROI
                </TableHead>
                <TableHead className="text-center font-bold">Score Total</TableHead>
                <TableHead className="text-center">Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((f) => {
                const score = getMatrixScore(f.matrix)
                const cls = getMatrixClassification(score)
                return (
                  <TableRow key={f.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{f.name}</TableCell>
                    {(
                      [
                        'financial',
                        'technical',
                        'fit',
                        'openness',
                        'competition',
                        'urgency',
                        'roi',
                      ] as const
                    ).map((k) => (
                      <TableCell key={k} className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={f.matrix[k] || ''}
                          onChange={(e) => update(f.id, k, Number(e.target.value))}
                          className="w-14 h-8 text-center text-xs mx-auto px-1 bg-transparent border-transparent hover:border-input focus:border-input transition-colors"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold text-base">
                      {score.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getScoreColor(score)}>{cls}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
