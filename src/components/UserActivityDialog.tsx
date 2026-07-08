import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Target, Factory, CheckCircle2, TrendingUp } from 'lucide-react'
import { getUserReport, type UserListItem, type UserReport } from '@/services/users'
import { formatCurrency } from '@/lib/utils'

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

export function UserActivityDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [report, setReport] = useState<UserReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user && open) {
      setLoading(true)
      setReport(null)
      getUserReport(user.id)
        .then(setReport)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [user, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Ações — {user?.name || user?.email}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : report ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="shadow-subtle">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Target className="w-4 h-4 text-primary mb-1" />
                  <div className="text-xl font-bold">{report.kpis.goalsAchieved.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Metas</div>
                </CardContent>
              </Card>
              <Card className="shadow-subtle">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Factory className="w-4 h-4 text-yellow-500 mb-1" />
                  <div className="text-xl font-bold">{report.kpis.prospects}</div>
                  <div className="text-xs text-muted-foreground">Prospectos</div>
                </CardContent>
              </Card>
              <Card className="shadow-subtle">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mb-1" />
                  <div className="text-xl font-bold">{report.kpis.homologated}</div>
                  <div className="text-xs text-muted-foreground">Homologadas</div>
                </CardContent>
              </Card>
              <Card className="shadow-subtle">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <TrendingUp className="w-4 h-4 text-blue-500 mb-1" />
                  <div className="text-sm font-bold">
                    {formatCurrency(report.kpis.totalOrdersValue)}
                  </div>
                  <div className="text-xs text-muted-foreground">Vendas</div>
                </CardContent>
              </Card>
            </div>
            <div className="max-h-[300px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground h-16">
                        Nenhuma atividade registrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.details || '-'}
                        </TableCell>
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
        ) : (
          <div className="text-center text-muted-foreground p-8">Falha ao carregar relatório.</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
