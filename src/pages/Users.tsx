import { useState, useEffect } from 'react'
import { getUsers, getUserReport, type UserListItem, type UserReport } from '@/services/users'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Loader2,
  Users as UsersIcon,
  Target,
  Factory,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { exportUserReportToPDF, exportUserReportToExcel } from '@/lib/exportReports'

export default function Users() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [report, setReport] = useState<UserReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSelectUser = async (user: UserListItem) => {
    setSelectedUser(user)
    setReport(null)
    setReportLoading(true)
    try {
      const r = await getUserReport(user.id)
      setReport(r)
    } catch (e) {
      console.error(e)
    } finally {
      setReportLoading(false)
    }
  }

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
          <UsersIcon className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground text-sm">
            Monitore performance e atividades dos usuários.
          </p>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Usuários Registrados</CardTitle>
          <CardDescription>{users.length} usuário(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>País</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectUser(u)}
                    >
                      <TableCell className="font-medium">{u.name || 'N/A'}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.job_title || 'N/A'}</TableCell>
                      <TableCell>{u.geographicArea || 'N/A'}</TableCell>
                      <TableCell>{u.country || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Relatório de Atividades — {selectedUser?.name || selectedUser?.email}
            </DialogTitle>
          </DialogHeader>
          {!reportLoading && report && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportUserReportToExcel(selectedUser!, report!)}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportUserReportToPDF(selectedUser!, report!)}
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          )}
          {reportLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : report ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="shadow-subtle">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <Target className="w-5 h-5 text-primary mb-2" />
                    <div className="text-2xl font-bold">
                      {report.kpis.goalsAchieved.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Metas Atingidas</div>
                  </CardContent>
                </Card>
                <Card className="shadow-subtle">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <Factory className="w-5 h-5 text-yellow-500 mb-2" />
                    <div className="text-2xl font-bold">{report.kpis.prospects}</div>
                    <div className="text-xs text-muted-foreground">Prospectos</div>
                  </CardContent>
                </Card>
                <Card className="shadow-subtle">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
                    <div className="text-2xl font-bold">{report.kpis.homologated}</div>
                    <div className="text-xs text-muted-foreground">Fábricas Homologadas</div>
                  </CardContent>
                </Card>
                <Card className="shadow-subtle">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <TrendingUp className="w-5 h-5 text-blue-500 mb-2" />
                    <div className="text-sm font-bold">
                      {formatCurrency(report.kpis.totalOrdersValue)}
                    </div>
                    <div className="text-xs text-muted-foreground">Vendas Totais</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <span className="text-muted-foreground">Meta Total:</span>{' '}
                  <span className="font-semibold">
                    {formatCurrency(report.kpis.totalTargetsValue)}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <span className="text-muted-foreground">Total de Atividades:</span>{' '}
                  <span className="font-semibold">{report.logs.length}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-3">Histórico de Atividades</h4>
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
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              Falha ao carregar relatório.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
