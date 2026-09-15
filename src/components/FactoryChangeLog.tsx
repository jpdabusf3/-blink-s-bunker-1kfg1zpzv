import { useState, useEffect } from 'react'
import { getActivityLogsByRecord } from '@/services/activity-logs'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { ActivityLog } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, ScrollText } from 'lucide-react'

function getActionBadge(action: string) {
  if (action.includes('Created'))
    return <Badge className="bg-green-100 text-green-800 border-transparent">{action}</Badge>
  if (action.includes('Updated'))
    return <Badge className="bg-blue-100 text-blue-800 border-transparent">{action}</Badge>
  if (action.includes('Deleted'))
    return <Badge className="bg-red-100 text-red-800 border-transparent">{action}</Badge>
  if (action.includes('Logged') || action.includes('Signed'))
    return <Badge className="bg-purple-100 text-purple-800 border-transparent">{action}</Badge>
  return <Badge variant="secondary">{action}</Badge>
}

export function FactoryChangeLog({ factoryId }: { factoryId: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadLogs = async () => {
    try {
      const data = await getActivityLogsByRecord(factoryId, 'factories')
      setLogs(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [factoryId])

  useRealtimeData('activity_logs', loadLogs)

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ScrollText className="w-4 h-4" />
        {logs.length} registro(s) de alteração
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead className="text-right">Data e Hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground h-16">
                  Nenhuma alteração registrada para esta fábrica.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {log.expand?.user?.name || log.expand?.user?.email || 'Sistema'}
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell className="text-muted-foreground">{log.details || '-'}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">
                    {new Date(log.created).toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
