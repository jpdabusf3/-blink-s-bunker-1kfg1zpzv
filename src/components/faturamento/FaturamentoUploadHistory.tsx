import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Calendar,
  Layers,
  Search,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FileText,
  FileCode,
} from 'lucide-react'
import type { ImportHistoryRecord, ImportHistoryStatus } from '@/services/import-history'

interface FaturamentoUploadHistoryProps {
  history: ImportHistoryRecord[]
  loading: boolean
  error?: string | null
  onRefresh: () => void
}

export function FaturamentoUploadHistory({
  history,
  loading,
  error,
  onRefresh,
}: FaturamentoUploadHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history
    const term = searchTerm.toLowerCase()
    return history.filter(
      (item) =>
        item.file_name.toLowerCase().includes(term) ||
        (item.file_type && item.file_type.toLowerCase().includes(term)) ||
        (item.details && item.details.toLowerCase().includes(term)) ||
        item.status.toLowerCase().includes(term),
    )
  }, [history, searchTerm])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  const renderStatusBadge = (status: ImportHistoryStatus) => {
    switch (status) {
      case 'sucesso':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 gap-1 text-[11px] font-medium"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Sucesso
          </Badge>
        )
      case 'parcial':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800 gap-1 text-[11px] font-medium"
          >
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Parcial
          </Badge>
        )
      case 'erro':
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/30 gap-1 text-[11px] font-medium"
          >
            <XCircle className="w-3 h-3 text-destructive" />
            Erro
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            Sucesso
          </Badge>
        )
    }
  }

  return (
    <Card className="shadow-subtle border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Histórico de Importações
              {history.length > 0 && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {history.length} {history.length === 1 ? 'importação' : 'importações'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Registros e auditoria dos arquivos processados no sistema com sincronização em tempo
              real.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar histórico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              title="Atualizar histórico"
              className="h-8 px-2.5 text-xs gap-1"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ESTADO 1: LOADING (Desktop: Linhas de tabela skeleton / Mobile < 768px: Cards skeleton) */}
        {loading && history.length === 0 ? (
          <div className="py-2">
            {/* Skeleton Desktop (Tabela) */}
            <div className="hidden md:block space-y-2">
              <div className="h-10 w-full bg-muted/60 animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/40 animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/30 animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
            </div>
            {/* Skeleton Mobile (Cards) */}
            <div className="md:hidden space-y-3 p-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-border bg-card space-y-3 animate-pulse"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5 w-3/4">
                      <div className="h-4 w-40 bg-muted/60 rounded" />
                      <div className="h-3 w-24 bg-muted/40 rounded" />
                    </div>
                    <div className="h-5 w-16 bg-muted/50 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                    <div className="h-6 bg-muted/30 rounded" />
                    <div className="h-6 bg-muted/30 rounded" />
                    <div className="h-6 bg-muted/30 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* ESTADO 3: ERROR */
          <div className="border border-destructive/30 rounded-xl p-8 text-center bg-destructive/5 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">
                Não foi possível carregar o histórico
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {error || 'Ocorreu uma instabilidade ao conectar ao servidor de histórico.'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="text-xs gap-1.5 border-destructive/30 hover:bg-destructive/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tentar novamente
            </Button>
          </div>
        ) : filteredHistory.length === 0 ? (
          /* ESTADO 2: EMPTY (Mensagem centralizada) */
          <div className="border border-dashed rounded-xl p-8 text-center bg-muted/10">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {searchTerm
                ? 'Nenhuma importação encontrada para este filtro.'
                : 'Nenhuma importação realizada'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'Tente pesquisar por outro termo ou limpe o campo de busca.'
                : 'Envie um arquivo de faturamento (.xlsx ou .csv) na aba de importação para registrar e alimentar o histórico.'}
            </p>
          </div>
        ) : (
          /* ESTADO 4: SUCCESS (Renderizado com fade-in sutil) */
          <div className="rounded-lg border overflow-hidden animate-fade-in">
            <div>
              {/* Tabela para Desktop (>= 768px) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-8 text-center text-xs"></TableHead>
                      <TableHead className="text-xs font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> Nome do
                          Arquivo
                        </span>
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Data / Hora
                        </span>
                      </TableHead>
                      <TableHead className="text-xs text-right font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-muted-foreground" /> Linhas Importadas
                        </span>
                      </TableHead>
                      <TableHead className="text-xs text-right font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" /> Linhas com
                          Erro
                        </span>
                      </TableHead>
                      <TableHead className="text-xs text-right font-semibold">
                        Valor Total (R$)
                      </TableHead>
                      <TableHead className="w-[120px] text-center text-xs font-semibold">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((item) => {
                      const isExpanded = expandedIds.has(item.id)
                      const hasDetails = Boolean(item.details && item.details.trim().length > 0)

                      return (
                        <React.Fragment key={item.id}>
                          <TableRow
                            className={`text-xs transition-colors ${
                              hasDetails ? 'cursor-pointer hover:bg-muted/40' : 'hover:bg-muted/20'
                            } ${isExpanded ? 'bg-muted/30' : ''}`}
                            onClick={() => {
                              if (hasDetails) toggleExpand(item.id)
                            }}
                          >
                            {/* Botão / Chevron de expansão */}
                            <TableCell className="px-2 text-center">
                              {hasDetails ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpand(item.id)
                                  }}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground transition-transform"
                                  title={isExpanded ? 'Recolher detalhes' : 'Ver detalhes de erros'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-foreground" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="inline-block w-3.5" />
                              )}
                            </TableCell>

                            {/* Nome do Arquivo */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-medium text-foreground max-w-[280px] sm:max-w-[340px] truncate"
                                  title={item.file_name}
                                >
                                  {item.file_name}
                                </span>
                                {item.file_type && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] uppercase font-mono px-1 py-0 h-4 shrink-0"
                                  >
                                    {item.file_type}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            {/* Data e Hora em DD/MM/AAAA HH:mm */}
                            <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                              {formatDate(item.imported_at)}
                            </TableCell>

                            {/* Linhas Importadas */}
                            <TableCell className="text-right font-mono font-semibold">
                              {item.imported_rows > 0 ? (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  {item.imported_rows.toLocaleString('pt-BR')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                              {item.total_rows > 0 && (
                                <span className="text-[10px] text-muted-foreground block font-normal">
                                  de {item.total_rows.toLocaleString('pt-BR')} total
                                </span>
                              )}
                            </TableCell>

                            {/* Linhas com Erro */}
                            <TableCell className="text-right font-mono font-semibold">
                              {item.error_rows > 0 ? (
                                <span className="text-destructive">
                                  {item.error_rows.toLocaleString('pt-BR')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>

                            {/* Valor Total Formatado 1.234,56 R$ com graceful fallback */}
                            <TableCell className="text-right font-mono font-semibold whitespace-nowrap">
                              {typeof item.total_value === 'number' && item.total_value > 0 ? (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  R${' '}
                                  {item.total_value.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* Badge de Status */}
                            <TableCell className="text-center">
                              {renderStatusBadge(item.status)}
                            </TableCell>
                          </TableRow>

                          {/* Linha expansível para detalhes dos erros e detalhamento breakdown */}
                          {isExpanded && (
                            <TableRow className="bg-muted/20 border-b">
                              <TableCell colSpan={7} className="p-3 pl-10">
                                <div className="rounded-md border border-border/60 bg-background/80 p-3 space-y-3 text-xs">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-primary" />
                                      Detalhamento da Importação
                                    </span>
                                    {item.error_rows > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] text-destructive border-destructive/30"
                                      >
                                        {item.error_rows} linha(s) com erro
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Breakdown de contadores: importados / ignorados (skipped) / duplicatas / valor total */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                                    <div className="p-2.5 rounded-lg bg-muted/40 border">
                                      <span className="text-[11px] text-muted-foreground block">
                                        Importados (Válidos)
                                      </span>
                                      <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        {typeof item.imported_rows === 'number'
                                          ? item.imported_rows.toLocaleString('pt-BR')
                                          : '—'}
                                      </span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-muted/40 border">
                                      <span className="text-[11px] text-muted-foreground block">
                                        Ignorados (Pulados)
                                      </span>
                                      <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                                        {typeof item.skipped_rows === 'number'
                                          ? item.skipped_rows.toLocaleString('pt-BR')
                                          : '—'}
                                      </span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-muted/40 border">
                                      <span className="text-[11px] text-muted-foreground block">
                                        Duplicatas Identificadas
                                      </span>
                                      <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                                        {typeof item.duplicate_rows === 'number'
                                          ? item.duplicate_rows.toLocaleString('pt-BR')
                                          : '—'}
                                      </span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-muted/40 border">
                                      <span className="text-[11px] text-muted-foreground block">
                                        Valor Total em R$
                                      </span>
                                      <span className="font-mono text-sm font-bold text-foreground">
                                        {typeof item.total_value === 'number' &&
                                        item.total_value > 0
                                          ? `R$ ${item.total_value.toLocaleString('pt-BR', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}`
                                          : '—'}
                                      </span>
                                    </div>
                                  </div>

                                  {hasDetails ? (
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-medium text-muted-foreground">
                                        Log / Detalhes registrados:
                                      </span>
                                      <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded max-h-48 overflow-y-auto leading-relaxed">
                                        {item.details}
                                      </pre>
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground italic text-[11px]">
                                      Sem detalhes adicionais de erros.
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Cards para Mobile (< 768px) */}
              <div className="md:hidden space-y-3 p-3">
                {filteredHistory.map((item) => {
                  const isExpanded = expandedIds.has(item.id)
                  const hasDetails = Boolean(item.details && item.details.trim().length > 0)

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border bg-card p-3.5 space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className="font-medium text-foreground text-xs truncate"
                            title={item.file_name}
                          >
                            {item.file_name}
                          </p>
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            {formatDate(item.imported_at)}
                          </span>
                        </div>
                        <div className="shrink-0">{renderStatusBadge(item.status)}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">
                            Importadas
                          </span>
                          <span className="font-mono font-bold text-emerald-600">
                            {item.imported_rows > 0
                              ? item.imported_rows.toLocaleString('pt-BR')
                              : '0'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Erros</span>
                          <span className="font-mono font-bold text-destructive">
                            {item.error_rows > 0 ? item.error_rows.toLocaleString('pt-BR') : '0'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">
                            Valor (R$)
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {typeof item.total_value === 'number' && item.total_value > 0
                              ? `R$ ${item.total_value.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Botão de expansão para ver detalhes */}
                      <div className="pt-1 border-t flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpand(item.id)}
                          className="h-7 text-xs gap-1 px-2"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" /> Ocultar detalhes
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-3.5 h-3.5" /> Ver detalhamento
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Detalhes expandidos no Mobile */}
                      {isExpanded && (
                        <div className="rounded-lg bg-muted/40 border p-3 space-y-2.5 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded bg-background border">
                              <span className="text-[10px] text-muted-foreground block">
                                Ignoradas
                              </span>
                              <span className="font-mono font-semibold text-amber-600">
                                {typeof item.skipped_rows === 'number' ? item.skipped_rows : '—'}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-background border">
                              <span className="text-[10px] text-muted-foreground block">
                                Duplicatas
                              </span>
                              <span className="font-mono font-semibold text-blue-600">
                                {typeof item.duplicate_rows === 'number'
                                  ? item.duplicate_rows
                                  : '—'}
                              </span>
                            </div>
                          </div>

                          {hasDetails ? (
                            <div className="space-y-1">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Log:
                              </span>
                              <pre className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground bg-background p-2 rounded max-h-36 overflow-y-auto">
                                {item.details}
                              </pre>
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground italic">
                              Sem detalhes adicionais.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>{' '}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
