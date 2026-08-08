import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, formatCompactCurrency } from '@/lib/utils'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Meta } from '@/services/metas'
import type { GestaoTecnica } from '@/services/gestao-tecnica'

const ESPECIES = ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA']

interface CellData {
  meta: number
  realizado: number
}

function MatrixCell({ data }: { data: CellData }) {
  if (data.meta === 0) {
    return <TableCell className="text-center text-muted-foreground/40 py-3">—</TableCell>
  }
  const pct = data.meta > 0 ? (data.realizado / data.meta) * 100 : 0
  const isAlert = pct < 50
  const isSuccess = pct >= 100
  return (
    <TableCell
      className={cn(
        'text-center py-2 px-3',
        isAlert && 'bg-red-50 dark:bg-red-950/20',
        isSuccess && 'bg-green-50 dark:bg-green-950/20',
      )}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {formatCompactCurrency(data.meta)}
        </span>
        <span
          className={cn(
            'text-xs font-semibold',
            isAlert
              ? 'text-red-600 dark:text-red-400'
              : isSuccess
                ? 'text-green-600 dark:text-green-400'
                : 'text-foreground',
          )}
        >
          {formatCompactCurrency(data.realizado)}
        </span>
        <span
          className={cn(
            'text-[10px] font-bold flex items-center gap-0.5',
            isAlert
              ? 'text-red-600 dark:text-red-400'
              : isSuccess
                ? 'text-green-600 dark:text-green-400'
                : 'text-muted-foreground',
          )}
        >
          {isAlert && <AlertTriangle className="w-2.5 h-2.5" />}
          {isSuccess && <CheckCircle2 className="w-2.5 h-2.5" />}
          {pct.toFixed(0)}%
        </span>
      </div>
    </TableCell>
  )
}

interface MetasMatrixProps {
  metas: Meta[]
  vendedores: GestaoTecnica[]
  gestores: GestaoTecnica[]
  viewMode: 'especie' | 'gestor'
}

export function MetasMatrix({ metas, vendedores, gestores, viewMode }: MetasMatrixProps) {
  const { columns, labels, matrix, rowTotals, colTotals, grandTotal } = useMemo(() => {
    const cols = viewMode === 'especie' ? ESPECIES : gestores.map((g) => g.id)
    const lbls = viewMode === 'especie' ? ESPECIES : gestores.map((g) => g.nome)
    const m: Record<string, Record<string, CellData>> = {}
    const rt: Record<string, CellData> = {}
    const ct: Record<string, CellData> = {}
    const gt: CellData = { meta: 0, realizado: 0 }

    for (const v of vendedores) {
      m[v.id] = {}
      rt[v.id] = { meta: 0, realizado: 0 }
      for (const c of cols) {
        m[v.id][c] = { meta: 0, realizado: 0 }
        ct[c] = { meta: 0, realizado: 0 }
      }
    }

    for (const meta of metas) {
      if (!meta.vendedor_id) continue
      const colKey = viewMode === 'especie' ? meta.especie : meta.gestor_tecnico_id
      if (!colKey || !cols.includes(colKey)) continue
      if (!m[meta.vendedor_id]) {
        m[meta.vendedor_id] = {}
        rt[meta.vendedor_id] = { meta: 0, realizado: 0 }
      }
      if (!m[meta.vendedor_id][colKey]) m[meta.vendedor_id][colKey] = { meta: 0, realizado: 0 }
      m[meta.vendedor_id][colKey].meta += meta.meta_valor || 0
      m[meta.vendedor_id][colKey].realizado += meta.valor_realizado || 0
      rt[meta.vendedor_id].meta += meta.meta_valor || 0
      rt[meta.vendedor_id].realizado += meta.valor_realizado || 0
      if (!ct[colKey]) ct[colKey] = { meta: 0, realizado: 0 }
      ct[colKey].meta += meta.meta_valor || 0
      ct[colKey].realizado += meta.valor_realizado || 0
      gt.meta += meta.meta_valor || 0
      gt.realizado += meta.valor_realizado || 0
    }

    return { columns: cols, labels: lbls, matrix: m, rowTotals: rt, colTotals: ct, grandTotal: gt }
  }, [metas, vendedores, gestores, viewMode])

  if (vendedores.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhum vendedor cadastrado.</div>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">Vendedor</TableHead>
            {labels.map((label, i) => (
              <TableHead key={i} className="text-center min-w-[100px]">
                {label}
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[100px]">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendedores.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.nome}</TableCell>
              {columns.map((col) => (
                <MatrixCell key={col} data={matrix[v.id]?.[col] || { meta: 0, realizado: 0 }} />
              ))}
              <MatrixCell data={rowTotals[v.id] || { meta: 0, realizado: 0 }} />
            </TableRow>
          ))}
          <TableRow className="border-t-2">
            <TableCell className="font-bold">Total</TableCell>
            {columns.map((col) => (
              <MatrixCell key={col} data={colTotals[col] || { meta: 0, realizado: 0 }} />
            ))}
            <MatrixCell data={grandTotal} />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
