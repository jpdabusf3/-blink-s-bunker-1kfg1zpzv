import { useState, useEffect } from 'react'
import { getUsers, type UserListItem } from '@/services/users'
import { getInvitations, deleteInvitation, type Invitation } from '@/services/invitations'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users as UsersIcon,
  UserPlus,
  Trash2,
  Loader2,
  Download,
  BarChart3,
  Pencil,
  MessageCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Mail,
} from 'lucide-react'
import { InvitationForm } from '@/components/InvitationForm'
import { SellerRegistrationForm } from '@/components/SellerRegistrationForm'
import { TeamPerformanceDashboard } from '@/components/TeamPerformanceDashboard'
import { UserActivityDialog } from '@/components/UserActivityDialog'
import { UserEditDialog } from '@/components/UserEditDialog'
import { toast } from 'sonner'
import { exportTeamToExcel } from '@/lib/exportReports'

export default function TeamManagement() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null)
  const [showSellerForm, setShowSellerForm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [u, i] = await Promise.all([getUsers(), getInvitations()])
      setUsers(u)
      setInvitations(i)
    } catch (e) {
      console.error(e)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('users', () => loadData())
  useRealtime('invitations', () => loadData())

  const getInvitationStatus = (inv: Invitation): string => {
    if (inv.status === 'accepted') return 'accepted'
    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) return 'expired'
    return inv.status || 'pending'
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      accepted: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      expired: 'bg-red-100 text-red-800',
    }
    const labels: Record<string, string> = {
      accepted: 'Aceito',
      pending: 'Pendente',
      expired: 'Expirado',
    }
    return (
      <Badge className={`${styles[status] || styles.pending} border-transparent`}>
        {labels[status] || labels.pending}
      </Badge>
    )
  }

  const handleExport = () => {
    setExporting(true)
    try {
      exportTeamToExcel(users)
      toast.success('Relatório da equipe exportado com sucesso.')
    } catch {
      toast.error('Erro ao exportar relatório.')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteInvitation = async (id: string) => {
    setDeletingInviteId(id)
    try {
      await deleteInvitation(id)
      toast.success('Convite excluído com sucesso.')
      loadData()
    } catch {
      toast.error('Erro ao remover convite. Tente novamente.')
    } finally {
      setDeletingInviteId(null)
    }
  }

  const handleUserClick = (user: UserListItem) => {
    setSelectedUser(user)
    setShowUserDialog(true)
  }

  const handleEditClick = (user: UserListItem) => {
    setEditingUser(user)
    setShowEditDialog(true)
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <UsersIcon className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão de Equipe</h1>
            <p className="text-muted-foreground text-sm">
              Convide membros, defina cargos e gerencie permissões.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || users.length === 0}
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar Relatório
          </Button>
          <Button onClick={() => setShowSellerForm(true)} variant="secondary" className="gap-2">
            <UserPlus className="w-4 h-4" /> Cadastrar Vendedor
          </Button>
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <UserPlus className="w-4 h-4" /> Convidar Usuário
          </Button>
        </div>
      </div>

      {loadError && !loading && (
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-destructive/10 rounded-full text-destructive">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Não foi possível carregar a equipe
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Ocorreu uma falha na comunicação com o banco de dados. Verifique sua conexão e tente
                novamente.
              </p>
            </div>
            <Button onClick={loadData} variant="outline" className="gap-2 mt-2">
              <RotateCcw className="w-4 h-4" /> Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="shadow-subtle">
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-8 w-8 mx-auto rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        !loadError && (
          <Tabs defaultValue="performance">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="performance" className="gap-1.5">
                <BarChart3 className="w-4 h-4" /> Painel Executivo
              </TabsTrigger>
              <TabsTrigger value="users">Usuários ({users.length})</TabsTrigger>
              <TabsTrigger value="invitations">Convites ({invitations.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="performance">
              <TeamPerformanceDashboard />
            </TabsContent>

            <TabsContent value="users">
              <Card className="shadow-subtle">
                <CardHeader>
                  <CardTitle>Usuários Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Região</TableHead>
                          <TableHead>País</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="p-8">
                              <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
                                <div className="p-3 bg-primary/10 rounded-full text-primary">
                                  <UsersIcon className="w-8 h-8" />
                                </div>
                                <h4 className="text-base font-semibold text-foreground">
                                  Nenhum usuário cadastrado
                                </h4>
                                <p className="text-xs text-muted-foreground max-w-sm">
                                  Comece convidando um novo membro ou cadastrando um vendedor para a
                                  equipe.
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => setShowInvite(true)}
                                    className="gap-1.5 text-xs"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" /> Convidar Usuário
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowSellerForm(true)}
                                    className="gap-1.5 text-xs"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" /> Cadastrar Vendedor
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          users.map((u) => (
                            <TableRow
                              key={u.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleUserClick(u)}
                            >
                              <TableCell className="font-medium">{u.name || 'N/A'}</TableCell>
                              <TableCell className="text-sm">{u.email}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{u.job_title || 'N/A'}</Badge>
                              </TableCell>
                              <TableCell>{u.geographicArea || 'N/A'}</TableCell>
                              <TableCell>{u.country || 'N/A'}</TableCell>
                              <TableCell>
                                {u.whatsapp ? (
                                  <div className="flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm whitespace-nowrap">{u.whatsapp}</span>
                                    {u.whatsapp_validated ? (
                                      <Badge className="bg-green-100 text-green-800 border-transparent gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Validado
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-100 text-amber-800 border-transparent gap-1">
                                        <XCircle className="w-3 h-3" /> Não validado
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {u.deactivated ? (
                                  <Badge className="bg-red-100 text-red-800 border-transparent">
                                    Desativado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800 border-transparent">
                                    Ativo
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEditClick(u)
                                    }}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invitations">
              <Card className="shadow-subtle">
                <CardHeader>
                  <CardTitle>Convites Enviados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expira em</TableHead>
                          <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="p-8">
                              <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
                                <div className="p-3 bg-primary/10 rounded-full text-primary">
                                  <Mail className="w-8 h-8" />
                                </div>
                                <h4 className="text-base font-semibold text-foreground">
                                  Nenhum convite pendente
                                </h4>
                                <p className="text-xs text-muted-foreground max-w-sm">
                                  Convide novos colaboradores por e-mail para ingressarem na
                                  plataforma.
                                </p>
                                <Button
                                  size="sm"
                                  onClick={() => setShowInvite(true)}
                                  className="gap-1.5 text-xs mt-2"
                                >
                                  <UserPlus className="w-3.5 h-3.5" /> Enviar Convite
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          invitations.map((inv) => {
                            const status = getInvitationStatus(inv)
                            return (
                              <TableRow key={inv.id}>
                                <TableCell className="font-medium">{inv.name}</TableCell>
                                <TableCell className="text-sm">{inv.email}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{inv.role}</Badge>
                                </TableCell>
                                <TableCell>{statusBadge(status)}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {inv.expiresAt
                                    ? new Date(inv.expiresAt).toLocaleDateString('pt-BR')
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={deletingInviteId === inv.id}
                                      onClick={() => handleDeleteInvitation(inv.id)}
                                      title="Excluir convite"
                                    >
                                      {deletingInviteId === inv.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                                      ) : (
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )
      )}

      <InvitationForm open={showInvite} onOpenChange={setShowInvite} onSuccess={loadData} />
      <SellerRegistrationForm
        open={showSellerForm}
        onOpenChange={setShowSellerForm}
        onSuccess={loadData}
      />
      <UserActivityDialog
        user={selectedUser}
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
      />
      <UserEditDialog
        user={editingUser}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={loadData}
      />
    </div>
  )
}
