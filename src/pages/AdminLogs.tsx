import { useState, useEffect, useMemo } from 'react'
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
import { ScrollText, Shield, FileSpreadsheet, FileText, Filter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { exportActivityLogsToPDF, exportActivityLogsToExcel } from '@/lib/exportReports'
import { ActivityLog } from '@/types'

export default function AdminLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [objectFilter, setObjectFilter] = useState('all')

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

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (userFilter) {
        const userName = log.expand?.user?.name || ''
        const userEmail = log.expand?.user?.email || ''
        const q = userFilter.toLowerCase()
        if (!userName.toLowerCase().includes(q) && !userEmail.toLowerCase().includes(q)) {
          return false
        }
      }

      if (actionFilter !== 'all') {
        const action = log.action.toLowerCase()
        switch (actionFilter) {
          case 'created': {
            if (!action.includes('created')) return false
            break
          }
          case 'updated': {
            if (!action.includes('updated')) return false
            break
          }
          case 'deleted': {
            if (!action.includes('deleted')) return false
            break
          }
          case 'logged': {
            if (!action.includes('logged') && !action.includes('signed')) return false
            break
          }
          case 'other': {
            if (
              action.includes('created') ||
              action.includes('updated') ||
              action.includes('deleted') ||
              action.includes('logged') ||
              action.includes('signed')
            )
              return false
            break
          }
        }
      }

      if (objectFilter !== 'all') {
        if (log.collectionName !== objectFilter) return false
      }

      const logDate = new Date(log.created)
      if (startDate && logDate < new Date(startDate + 'T00:00:00')) return false
      if (endDate && logDate > new Date(endDate + 'T23:59:59')) return false

      return true
    })
  }, [logs, userFilter, actionFilter, startDate, endDate, objectFilter])

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

  const hasFilters =
    userFilter || actionFilter !== 'all' || startDate || endDate || objectFilter !== 'all'

  const clearFilters = () => {
    setUserFilter('')
    setActionFilter('all')
    setStartDate('')
    setEndDate('')
    setObjectFilter('all')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportActivityLogsToExcel(filteredLogs)}
            disabled={filteredLogs.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportActivityLogsToPDF(filteredLogs)}
            disabled={filteredLogs.length === 0}
          >
            <FileText className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Logs de Atividade
          </CardTitle>
          <CardDescription>
            {filteredLogs.length} de {logs.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4 p-4 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Usuário</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo de Ação</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="created">Criação</SelectItem>
                  <SelectItem value="updated">Atualização</SelectItem>
                  <SelectItem value="deleted">Exclusão</SelectItem>
                  <SelectItem value="logged">Login / Cadastro</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:w-40">
              <Label className="text-xs text-muted-foreground mb-1 block">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="sm:w-40">
              <Label className="text-xs text-muted-foreground mb-1 block">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="sm:w-44">
              <Label className="text-xs text-muted-foreground mb-1 block">Objeto</Label>
              <Select value={objectFilter} onValueChange={setObjectFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os objetos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os objetos</SelectItem>
                  <SelectItem value="factories">Fábricas</SelectItem>
                  <SelectItem value="orders">Pedidos</SelectItem>
                  <SelectItem value="targets">Metas</SelectItem>
                  <SelectItem value="users">Usuários</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  Limpar
                </Button>
              </div>
            )}
          </div>

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
                    <TableHead>Objeto</TableHead>
                    <TableHead className="text-right">Data e Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        {hasFilters
                          ? 'Nenhum registro encontrado com os filtros aplicados.'
                          : 'Nenhuma atividade registrada.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.expand?.user?.name || log.expand?.user?.email || 'Sistema'}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.details || '-'}
                        </TableCell>
                        <TableCell>
                          {log.collectionName ? (
                            <Badge variant="outline" className="text-xs">
                              {log.collectionName === 'factories'
                                ? 'Fábrica'
                                : log.collectionName === 'orders'
                                  ? 'Pedido'
                                  : log.collectionName === 'targets'
                                    ? 'Meta'
                                    : log.collectionName === 'users'
                                      ? 'Usuário'
                                      : log.collectionName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
