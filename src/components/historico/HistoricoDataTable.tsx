import { useState, useMemo } from 'react'
import {
  type HistoricoGranularity,
  type HistoricoMensalRow,
  type HistoricoAnualRow,
  type HistoricoQuadrienalRow,
} from '@/services/historicoService'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Inbox,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

interface HistoricoDataTableProps {
  granularity: HistoricoGranularity
  mensalData: HistoricoMensalRow[]
  anualData: HistoricoAnualRow[]
  quadrienalData: HistoricoQuadrienalRow[]
  loading: boolean
  onRowClick: (groupKey: string, title: string) => void
  onExportCSV: () => void
  onResetFilters: () => void
}

type SortDirection = 'asc' | 'desc'

export function HistoricoDataTable({
  granularity,
  mensalData,
  anualData,
  quadrienalData,
  loading,
  onRowClick,
  onExportCSV,
  onResetFilters,
}: HistoricoDataTableProps) {
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 20

  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Reset page when granularity changes
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sorting logic based on granularity
  const sortedMensal = useMemo(() => {
    if (!sortField) return mensalData
    return [...mensalData].sort((a, b) => {
      let vA: any = (a as any)[sortField]
      let vB: any = (b as any)[sortField]
      if (typeof vA === 'string') {
        return sortDirection === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA)
      }
      vA = Number(vA) || 0
      vB = Number(vB) || 0
      return sortDirection === 'asc' ? vA - vB : vB - vA
    })
  }, [mensalData, sortField, sortDirection])

  const sortedAnual = useMemo(() => {
    if (!sortField) return anualData
    return [...anualData].sort((a, b) => {
      let vA: any = (a as any)[sortField]
      let vB: any = (b as any)[sortField]
      if (typeof vA === 'string') {
        return sortDirection === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA)
      }
      vA = Number(vA) || 0
      vB = Number(vB) || 0
      return sortDirection === 'asc' ? vA - vB : vB - vA
    })
  }, [anualData, sortField, sortDirection])

  const sortedQuad = useMemo(() => {
    if (!sortField) return quadrienalData
    return [...quadrienalData].sort((a, b) => {
      let vA: any = (a as any)[sortField]
      let vB: any = (b as any)[sortField]
      vA = Number(vA) || 0
      vB = Number(vB) || 0
      return sortDirection === 'asc' ? vA - vB : vB - vA
    })
  }, [quadrienalData, sortField, sortDirection])

  // Get active rows and pagination
  const activeRows =
    granularity === 'mensal' ? sortedMensal : granularity === 'anual' ? sortedAnual : sortedQuad

  const totalRows = activeRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return activeRows.slice(start, start + pageSize)
  }, [activeRows, currentPage])

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 inline" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-primary inline" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-primary inline" />
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-6 transition-all">
      {/* Header bar */}
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base text-foreground">
            Registros de Vendas (
            {granularity === 'mensal' ? 'Mensal' : granularity === 'anual' ? 'Anual' : 'Quadrienal'}
            )
          </h3>
          <Badge variant="outline" className="text-xs">
            {totalRows} {totalRows === 1 ? 'linha' : 'linhas'}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          disabled={totalRows === 0 || loading}
          className="h-8 text-xs gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {granularity === 'mensal' && (
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead
                  onClick={() => handleSort('sortKey')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Mês/Ano {renderSortIcon('sortKey')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('especie')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Espécie {renderSortIcon('especie')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('gestor_tecnico')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Gestor Técnico {renderSortIcon('gestor_tecnico')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('vendedor')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Vendedor {renderSortIcon('vendedor')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('canal')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Canal {renderSortIcon('canal')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('qtdNfs')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Qtd NFs {renderSortIcon('qtdNfs')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('qtdPedidos')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Qtd Pedidos {renderSortIcon('qtdPedidos')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('valorRealizado')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Valor Realizado {renderSortIcon('valorRealizado')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('valorProjetado')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Valor Projetado {renderSortIcon('valorProjetado')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('total')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Total {renderSortIcon('total')}
                </TableHead>
              </TableRow>
            )}

            {granularity === 'anual' && (
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead
                  onClick={() => handleSort('ano')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Ano {renderSortIcon('ano')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('especie')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Espécie {renderSortIcon('especie')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('qtdNfs')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Qtd NFs {renderSortIcon('qtdNfs')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('valorRealizado')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Valor Realizado {renderSortIcon('valorRealizado')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('valorProjetado')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Valor Projetado {renderSortIcon('valorProjetado')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('total')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Total {renderSortIcon('total')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('vsAnoAnteriorPercent')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  vs Ano Anterior (%) {renderSortIcon('vsAnoAnteriorPercent')}
                </TableHead>
              </TableRow>
            )}

            {granularity === 'quadrienal' && (
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead
                  onClick={() => handleSort('ano')}
                  className="cursor-pointer select-none text-xs font-semibold whitespace-nowrap"
                >
                  Ano {renderSortIcon('ano')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('totalRealizado')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Total Realizado {renderSortIcon('totalRealizado')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('totalProjetado')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Total Projetado {renderSortIcon('totalProjetado')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('crescimentoYoY')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  Crescimento YoY (%) {renderSortIcon('crescimentoYoY')}
                </TableHead>
                <TableHead
                  onClick={() => handleSort('cagr')}
                  className="cursor-pointer select-none text-xs font-semibold text-right whitespace-nowrap"
                >
                  CAGR (%) {renderSortIcon('cagr')}
                </TableHead>
              </TableRow>
            )}
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({
                    length: granularity === 'mensal' ? 10 : granularity === 'anual' ? 7 : 5,
                  }).map((_, j) => (
                    <TableCell key={j} className="py-3">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={granularity === 'mensal' ? 10 : granularity === 'anual' ? 7 : 5}
                  className="py-12 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-muted rounded-full">
                      <Inbox className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhum registro encontrado para os filtros selecionados.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onResetFilters}
                      className="text-xs"
                    >
                      Limpar filtros
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row: any) => {
                if (granularity === 'mensal') {
                  const m = row as HistoricoMensalRow
                  return (
                    <TableRow
                      key={m.groupKey}
                      onClick={() =>
                        onRowClick(m.groupKey, `Detalhes — ${m.mesAno} — ${m.especie}`)
                      }
                      className="cursor-pointer hover:bg-primary/5 transition-colors group"
                    >
                      <TableCell className="font-medium text-xs whitespace-nowrap">
                        <span className="text-primary group-hover:underline">{m.mesAno}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {m.especie}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">
                        {m.gestor_tecnico}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">{m.vendedor}</TableCell>
                      <TableCell className="text-xs">{m.canal}</TableCell>
                      <TableCell className="text-xs text-right">{m.qtdNfs}</TableCell>
                      <TableCell className="text-xs text-right">{m.qtdPedidos}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(m.valorRealizado)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(m.valorProjetado)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold text-foreground">
                        {formatCurrency(m.total)}
                      </TableCell>
                    </TableRow>
                  )
                }

                if (granularity === 'anual') {
                  const a = row as HistoricoAnualRow
                  return (
                    <TableRow
                      key={a.groupKey}
                      onClick={() =>
                        onRowClick(a.groupKey, `Detalhes — Ano ${a.ano} — ${a.especie}`)
                      }
                      className="cursor-pointer hover:bg-primary/5 transition-colors group"
                    >
                      <TableCell className="font-semibold text-xs whitespace-nowrap">
                        <span className="text-primary group-hover:underline">{a.ano}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {a.especie}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">{a.qtdNfs}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(a.valorRealizado)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(a.valorProjetado)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-bold text-foreground">
                        {formatCurrency(a.total)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {a.vsAnoAnteriorPercent !== null ? (
                          <span
                            className={`inline-flex items-center justify-end gap-1 ${
                              a.vsAnoAnteriorPercent >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {a.vsAnoAnteriorPercent >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {a.vsAnoAnteriorPercent > 0 ? '+' : ''}
                            {a.vsAnoAnteriorPercent.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                }

                // Quadrienal
                const q = row as HistoricoQuadrienalRow
                return (
                  <TableRow
                    key={q.groupKey}
                    onClick={() => onRowClick(q.groupKey, `Detalhes — Período Ano ${q.ano}`)}
                    className="cursor-pointer hover:bg-primary/5 transition-colors group"
                  >
                    <TableCell className="font-semibold text-xs whitespace-nowrap">
                      <span className="text-primary group-hover:underline">{q.ano}</span>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(q.totalRealizado)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium text-blue-600 dark:text-blue-400">
                      {formatCurrency(q.totalProjetado)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {q.crescimentoYoY !== null ? (
                        <span
                          className={`inline-flex items-center justify-end gap-1 ${
                            q.crescimentoYoY >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {q.crescimentoYoY >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {q.crescimentoYoY > 0 ? '+' : ''}
                          {q.crescimentoYoY.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">
                      {q.cagr !== null ? (
                        <span
                          className={`inline-flex items-center justify-end gap-1 ${
                            q.cagr >= 0
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {q.cagr > 0 ? '+' : ''}
                          {q.cagr.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {!loading && totalPages > 1 && (
        <div className="p-3 border-t border-border flex items-center justify-between gap-2 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Página <span className="font-medium text-foreground">{currentPage}</span> de{' '}
            <span className="font-medium text-foreground">{totalPages}</span>
          </p>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
