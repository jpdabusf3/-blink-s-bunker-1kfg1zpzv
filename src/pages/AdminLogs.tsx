import { useState, useEffect } from 'react'
import { getActivityLogs } from '@/services/activity-logs'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollText, Shield } from 'lucide-react'
import { ActivityLog } from '@/types'

export default function AdminLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadLogs = async () => {
    try {
      const data = await getActivityLogs()
      setLogs(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  useRealtime('activity_logs', () => {
    loadLogs()
  })

  const getActionBadge = (action: string) => {
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

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
          <ScrollText className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria de Atividades</h1>
          <p className="text-muted-foreground text-sm">
            Histórico completo de acessos e ações dos usuários.
          </p>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Logs de Atividade
          </CardTitle>
          <CardDescription>{logs.length} registro(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead className="text-right">Data e Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                        Nenhuma atividade registrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.expand?.user?.name || log.expand?.user?.email || 'Sistema'}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.details || '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {new Date(log.created).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
