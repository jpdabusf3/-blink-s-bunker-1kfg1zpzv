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
        {/* ESTADO 1: LOADING (Linhas skeleton no lugar da lista) */}
        {loading && history.length === 0 ? (
          <div className="space-y-2 py-4">
            <div className="h-10 w-full bg-muted/60 animate-pulse rounded" />
            <div className="h-10 w-full bg-muted/40 animate-pulse rounded" />
            <div className="h-10 w-full bg-muted/30 animate-pulse rounded" />
            <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
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
                : 'Nenhuma importação realizada ainda.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'Tente pesquisar por outro termo ou limpe o campo de busca.'
                : 'Envie um arquivo de faturamento ou relatório acima para registrar e alimentar o histórico do bunker.'}
            </p>
          </div>
        ) : (
          /* ESTADO 4: SUCCESS (Renderizado com fade-in sutil) */
          <div className="rounded-lg border overflow-hidden animate-fade-in">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[36px] px-2 text-center"></TableHead>
                  <TableHead className="text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> Nome do
                      Arquivo
                    </span>
                  </TableHead>
                  <TableHead className="w-[170px] text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
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

                        {/* Badge de Status */}
                        <TableCell className="text-center">
                          {renderStatusBadge(item.status)}
                        </TableCell>
                      </TableRow>

                      {/* Linha expansível para detalhes dos erros */}
                      {isExpanded && (
                        <TableRow className="bg-muted/20 border-b">
                          <TableCell colSpan={6} className="p-3 pl-10">
                            <div className="rounded-md border border-border/60 bg-background/80 p-3 space-y-2 text-xs">
                              <div className="flex items-center justify-between border-b pb-1.5">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  Detalhes da Importação / Log de Erros
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
                              {hasDetails ? (
                                <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded max-h-48 overflow-y-auto leading-relaxed">
                                  {item.details}
                                </pre>
                              ) : (
                                <p className="text-muted-foreground italic text-[11px]">
                                  Sem detalhes de erros.
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
        )}
      </CardContent>
    </Card>
  )
}
