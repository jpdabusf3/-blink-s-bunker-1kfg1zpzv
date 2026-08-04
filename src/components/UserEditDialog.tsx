import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { COUNTRIES } from '@/lib/countries'
import { manageUser, getUserHistory, type UserListItem } from '@/services/users'
import type { ActivityLog } from '@/types'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { Loader2, Save, Trash2, RotateCcw, History } from 'lucide-react'

const ROLES = ['CEO', 'Diretor', 'Gestor', 'Gerente', 'Manager', 'Vendedor', 'Comum']

function badgeFor(a: string) {
  if (a.includes('editado'))
    return <Badge className="bg-blue-100 text-blue-800 border-transparent">{a}</Badge>
  if (a.includes('excluído'))
    return <Badge className="bg-red-100 text-red-800 border-transparent">{a}</Badge>
  if (a.includes('recuperado'))
    return <Badge className="bg-green-100 text-green-800 border-transparent">{a}</Badge>
  return <Badge variant="secondary">{a}</Badge>
}

export function UserEditDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: UserListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [country, setCountry] = useState('Brasil')
  const [geoArea, setGeoArea] = useState('')
  const [deactivated, setDeactivated] = useState(false)
  const [history, setHistory] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [confirmRec, setConfirmRec] = useState(false)

  useEffect(() => {
    if (user && open) {
      setName(user.name || '')
      setJobTitle(user.job_title || '')
      setCountry(user.country || 'Brasil')
      setGeoArea(user.geographicArea || '')
      setDeactivated(!!user.deactivated)
      setLoading(true)
      getUserHistory(user.id)
        .then(setHistory)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [user, open])

  const selectedCountry = COUNTRIES.find((c) => c.name === country)

  const handleAction = async (
    action: 'edit' | 'deactivate' | 'reactivate',
    data?: { name?: string; job_title?: string; geographicArea?: string; country?: string },
  ) => {
    if (!user) return
    setSubmitting(true)
    try {
      await manageUser(user.id, action, data)
      const msg =
        action === 'edit' ? 'atualizado' : action === 'deactivate' ? 'desativado' : 'reativado'
      toast.success(`Usuário ${msg} com sucesso.`)
      setConfirmDel(false)
      setConfirmRec(false)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Usuário — {user?.name || user?.email}
            {deactivated && (
              <Badge className="bg-red-100 text-red-800 border-transparent">Desativado</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="edit">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="edit">Editar Dados</TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Cargo / Função</Label>
              <Select value={jobTitle} onValueChange={setJobTitle}>
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-country">País</Label>
              <Select
                value={country}
                onValueChange={(v) => {
                  setCountry(v)
                  setGeoArea('')
                }}
              >
                <SelectTrigger id="edit-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-region">Região</Label>
              {selectedCountry?.regions ? (
                <Select value={geoArea} onValueChange={setGeoArea}>
                  <SelectTrigger id="edit-region">
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCountry.regions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="edit-region"
                  value={geoArea}
                  onChange={(e) => setGeoArea(e.target.value)}
                  placeholder="Região"
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="history">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-muted-foreground p-8">Nenhum histórico registrado.</p>
            ) : (
              <div className="h-[300px] overflow-y-auto rounded-lg border p-3 space-y-3">
                {history.map((log) => (
                  <div key={log.id} className="border-b pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      {badgeFor(log.action)}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {log.details && <p className="text-sm text-muted-foreground">{log.details}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Por: {log.expand?.user?.name || log.expand?.user?.email || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {deactivated ? (
            <Button variant="outline" onClick={() => setConfirmRec(true)} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Recuperar
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmDel(true)} className="gap-2">
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
          )}
          <Button
            onClick={() =>
              handleAction('edit', { name, job_title: jobTitle, geographicArea: geoArea, country })
            }
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o usuário {user?.name || user?.email}? Ele não poderá
              mais acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAction('deactivate')}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmRec} onOpenChange={setConfirmRec}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recuperação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reativar o usuário {user?.name || user?.email}? O acesso ao
              sistema será restaurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleAction('reactivate')}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
