import { useState, useEffect, useCallback } from 'react'
import { getFactoryChangeLogs, type FactoryChangeLogItem } from '@/services/factory-change-logs'
import { useRealtime } from '@/hooks/use-realtime'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { History, RotateCcw, AlertCircle, FileText, User, Calendar } from 'lucide-react'
import { formatDataHoraBR } from '@/lib/corporateDocuments'

export interface FactoryHistoryViewProps {
  factoryId?: string | null
}

export function FactoryHistoryView({ factoryId }: FactoryHistoryViewProps) {
  const [logs, setLogs] = useState<FactoryChangeLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    if (!factoryId) {
      setLogs([])
      setLoading(false)
      setError(false)
      return
    }

    setLoading(true)
    setError(false)
    try {
      const items = await getFactoryChangeLogs(factoryId)
      setLogs(items)
    } catch (err) {
      console.warn('[FactoryHistoryView] Erro ao carregar histórico:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [factoryId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('factory_change_logs', () => {
    loadData()
  })

  if (!factoryId) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/20">
        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
        <p className="font-medium text-foreground">Novo cliente</p>
        <p className="text-xs text-muted-foreground mt-1">
          O histórico de alterações será iniciado assim que o cliente for cadastrado.
        </p>
      </div>
    )
  }

  // 1. Estado Loading (Skeleton)
  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 border rounded-lg bg-card space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 2. Estado Erro com Retry
  if (error) {
    return (
      <div className="p-6 text-center border border-destructive/20 bg-destructive/5 rounded-lg space-y-3">
        <AlertCircle className="w-7 h-7 mx-auto text-destructive" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Não foi possível carregar o histórico
          </p>
          <p className="text-xs text-muted-foreground">
            Ocorreu uma falha ao consultar as alterações deste cliente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 text-xs">
          <RotateCcw className="w-3.5 h-3.5" /> Tentar novamente
        </Button>
      </div>
    )
  }

  // 3. Estado Vazio
  if (logs.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed rounded-lg bg-muted/20 space-y-2">
        <History className="w-8 h-8 mx-auto text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">Nenhuma alteração registrada</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          As futuras edições neste cadastro (quem editou, quando e o quê) serão registradas
          automaticamente aqui.
        </p>
      </div>
    )
  }

  // 4. Estado Sucesso: lista com timeline decrescente
  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <History className="w-3.5 h-3.5 text-primary" />
          {logs.length} alteração(ões) registrada(s)
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadData}
          className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
          title="Atualizar histórico"
        >
          <RotateCcw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      <div className="divide-y border rounded-lg overflow-hidden bg-card">
        {logs.map((log) => (
          <div key={log.id} className="p-3 text-xs space-y-1.5 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                {log.user_name || 'Sistema'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 font-mono">
                <Calendar className="w-3 h-3" />
                {formatDataHoraBR(log.created)}
              </span>
            </div>

            <p className="text-foreground/90 leading-relaxed font-normal pl-5">
              {log.change_summary}
            </p>

            {log.field && (
              <div className="pl-5 pt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 h-4 font-normal text-muted-foreground"
                >
                  campo: {log.field}
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
