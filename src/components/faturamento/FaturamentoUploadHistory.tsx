import { useState, useMemo } from 'react'
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
  User,
  Calendar,
  Layers,
  Search,
  RotateCcw,
} from 'lucide-react'
import type { UploadHistoryItem } from '@/services/resumo-vendas'

interface FaturamentoUploadHistoryProps {
  history: UploadHistoryItem[]
  loading: boolean
  onRefresh: () => void
}

export function FaturamentoUploadHistory({
  history,
  loading,
  onRefresh,
}: FaturamentoUploadHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history
    const term = searchTerm.toLowerCase()
    return history.filter(
      (item) =>
        item.fileName.toLowerCase().includes(term) ||
        item.authorName.toLowerCase().includes(term) ||
        item.authorEmail.toLowerCase().includes(term) ||
        item.details.toLowerCase().includes(term),
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

  const renderStatusBadge = (status: UploadHistoryItem['status']) => {
    switch (status) {
      case 'concluido':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 gap-1 text-[11px]"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Concluído
          </Badge>
        )
      case 'parcial':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800 gap-1 text-[11px]"
          >
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Parcial
          </Badge>
        )
      case 'erro':
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/30 gap-1 text-[11px]"
          >
            <XCircle className="w-3 h-3 text-destructive" />
            Erro
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            Concluído
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
              Histórico de Uploads de Faturamento
              {history.length > 0 && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {history.length} {history.length === 1 ? 'upload' : 'uploads'}
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
        {loading && history.length === 0 ? (
          <div className="space-y-2 py-4">
            <div className="h-9 w-full bg-muted/60 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/40 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/30 animate-pulse rounded" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 text-center bg-muted/10">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {searchTerm
                ? 'Nenhum upload encontrado para este filtro.'
                : 'Nenhuma importação realizada ainda.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'Tente pesquisar por outro termo ou limpe o campo de busca.'
                : 'Envie um arquivo Excel (.xlsx) de faturamento acima para registrar e alimentar o histórico do bunker.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[170px] text-xs">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Data / Hora
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> Arquivo
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" /> Autor (Quem importou)
                    </span>
                  </TableHead>
                  <TableHead className="text-xs text-right font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-muted-foreground" /> Registros
                    </span>
                  </TableHead>
                  <TableHead className="w-[130px] text-center text-xs font-semibold">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/20 text-xs">
                    <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                      {formatDate(item.created)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className="font-medium text-foreground max-w-[260px] truncate"
                          title={item.fileName}
                        >
                          {item.fileName}
                        </span>
                        {item.details && (
                          <span
                            className="text-[11px] text-muted-foreground truncate max-w-[340px]"
                            title={item.details}
                          >
                            {item.details}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{item.authorName}</span>
                        {item.authorEmail && (
                          <span className="text-[11px] text-muted-foreground">
                            {item.authorEmail}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {item.importedCount > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {item.importedCount.toLocaleString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                      {item.duplicatesCount > 0 && (
                        <span className="text-[10px] text-muted-foreground block font-normal">
                          ({item.duplicatesCount} duplicados)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{renderStatusBadge(item.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
