import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Layout as LayoutIcon,
  Save,
  Download,
  Eye,
  RotateCcw,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { useLayoutVersions } from '@/hooks/use-layout-versions'
import { PAGE_NAME_OPTIONS, type LayoutVersion } from '@/services/layout-versions'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function VersionListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({ onSave }: { onSave: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <LayoutIcon className="w-14 h-14 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground">Nenhuma versao salva</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Salve a configuracao atual do layout para poder restaura-la no futuro.
      </p>
      <Button onClick={onSave} className="mt-6 gap-2">
        <Save className="w-4 h-4" />
        Salvar versao atual
      </Button>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <AlertTriangle className="w-14 h-14 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground">
        Nao foi possivel carregar as configuracoes.
      </h3>
      <Button variant="outline" onClick={onRetry} className="mt-6 gap-2">
        <RefreshCw className="w-4 h-4" />
        Tentar novamente
      </Button>
    </div>
  )
}

export default function ConfiguracoesLayout() {
  const [pageName, setPageName] = useState('/funil')
  const {
    versions,
    activeVersion,
    loading,
    error,
    hasMore,
    loadMore,
    fetchVersions,
    saveVersion,
    restoreVersion,
    deleteVersion,
  } = useLayoutVersions(pageName)

  // Save modal
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [saveConfig, setSaveConfig] = useState('')
  const [saving, setSaving] = useState(false)

  // View modal
  const [viewVersion, setViewVersion] = useState<LayoutVersion | null>(null)

  // Restore confirmation
  const [restoreTarget, setRestoreTarget] = useState<LayoutVersion | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<LayoutVersion | null>(null)

  const openSaveModal = () => {
    setSaveLabel('')
    setSaveConfig(activeVersion?.config_data || '')
    setSaveOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveVersion({
        page_name: pageName,
        config_data: saveConfig,
        version_label: saveLabel,
      })
      toast.success('Configuracao salva!')
      setSaveOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('ativa')) {
        toast.error('Ja existe uma versao ativa para esta pagina')
      } else if (msg.includes('permiss')) {
        toast.error('Sem permissao.')
      } else {
        toast.error('Erro ao salvar configuracao. Tente novamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    if (!activeVersion) {
      toast.error('Nenhuma versao ativa para exportar.')
      return
    }
    const blob = new Blob([activeVersion.config_data], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safePage = pageName.replace(/^\//, '').replace(/\//g, '-') || 'page'
    const dateStr = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `layout-${safePage}-${dateStr}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleRestore = async () => {
    if (!restoreTarget) return
    try {
      await restoreVersion(restoreTarget.id)
      toast.success('Versao restaurada com sucesso!')
      setRestoreTarget(null)
      if (viewVersion) setViewVersion(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('permiss')) {
        toast.error('Sem permissao.')
      } else {
        toast.error('Nao foi possivel restaurar esta versao. Tente novamente.')
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteVersion(deleteTarget.id)
      toast.success('Versao excluida.')
      setDeleteTarget(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('ativa')) {
        toast.error('Nao e possivel excluir a versao ativa.')
      } else if (msg.includes('permiss')) {
        toast.error('Sem permissao.')
      } else {
        toast.error('Erro de conexao. Verifique sua internet.')
      }
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracoes de Layout</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie e restaure versoes anteriores do layout
        </p>
      </div>

      {/* Current version card */}
      <Card className="p-4 shadow-subtle">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <Select value={pageName} onValueChange={setPageName}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="Pagina" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_NAME_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeVersion && <Badge variant="default">Ativa</Badge>}
            </div>
            {activeVersion ? (
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Rotulo: </span>
                  <span className="font-medium">
                    {activeVersion.version_label || 'Versao sem nome'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data: </span>
                  <span className="font-medium">{formatDate(activeVersion.created)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma versao ativa para esta pagina.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={openSaveModal} className="gap-2">
              <Save className="w-4 h-4" />
              Salvar versao atual
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </div>
        </div>
      </Card>

      {/* Versions list */}
      <Card className="p-4 shadow-subtle flex-1">
        <h2 className="text-lg font-semibold mb-3">Versoes salvas</h2>
        {loading && versions.length === 0 ? (
          <VersionListSkeleton />
        ) : error ? (
          <ErrorState onRetry={() => fetchVersions(pageName, 1)} />
        ) : versions.length === 0 ? (
          <EmptyState onSave={openSaveModal} />
        ) : (
          <div className="space-y-3 animate-fade-in">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {v.version_label || 'Versao sem nome'}
                    </span>
                    {v.is_active && <Badge variant="default">Ativa</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(v.created)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewVersion(v)}
                    className="gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Visualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={v.is_active}
                    onClick={() => setRestoreTarget(v)}
                    className="gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={v.is_active}
                    onClick={() => setDeleteTarget(v)}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Save modal */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salvar versao</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="version-label">Rotulo (opcional)</Label>
              <Input
                id="version-label"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="Ex: Layout com coluna de metas"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="config-data">Configuracao</Label>
              <Textarea
                id="config-data"
                rows={8}
                value={saveConfig}
                onChange={(e) => setSaveConfig(e.target.value)}
                placeholder="Cole ou edite a configuracao do layout aqui..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View modal */}
      <Dialog open={!!viewVersion} onOpenChange={(v) => !v && setViewVersion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Visualizar versao</DialogTitle>
          </DialogHeader>
          {viewVersion && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Rotulo</span>
                  <span className="font-medium">
                    {viewVersion.version_label || 'Versao sem nome'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Data</span>
                  <span className="font-medium">{formatDate(viewVersion.created)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Pagina</span>
                  <span className="font-medium">{viewVersion.page_name}</span>
                </div>
              </div>
              <Textarea
                rows={10}
                value={viewVersion.config_data}
                readOnly
                className="font-mono text-xs"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (viewVersion && !viewVersion.is_active) {
                  setRestoreTarget(viewVersion)
                }
              }}
              disabled={!viewVersion || viewVersion.is_active}
              className="gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar esta versao
            </Button>
            <Button onClick={() => setViewVersion(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <Dialog open={!!restoreTarget} onOpenChange={(v) => !v && setRestoreTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restaurar versao</DialogTitle>
          </DialogHeader>
          {restoreTarget && (
            <p className="text-sm text-muted-foreground">
              Deseja restaurar a versao &quot;{restoreTarget.version_label || 'Versao sem nome'}
              &quot; de {formatDate(restoreTarget.created)}? A configuracao atual sera substituida.
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRestore}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir versao</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm text-muted-foreground">
              Excluir a versao &quot;{deleteTarget.version_label || 'Versao sem nome'}&quot; de{' '}
              {formatDate(deleteTarget.created)}? Esta acao nao pode ser desfeita.
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
