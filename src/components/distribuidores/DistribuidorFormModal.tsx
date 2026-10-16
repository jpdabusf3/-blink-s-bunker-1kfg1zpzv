import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { BLINK_UF_LIST } from '@/constants/blinkProducts'
import {
  createDistribuidor,
  updateDistribuidor,
  type Distribuidor,
} from '@/services/distribuidores-service'
import { useAuth } from '@/hooks/use-auth'

interface DistribuidorFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  distribuidor?: Distribuidor | null
  onSuccess: (dist: Distribuidor) => void
}

export function DistribuidorFormModal({
  open,
  onOpenChange,
  distribuidor,
  onSuccess,
}: DistribuidorFormModalProps) {
  const { user } = useAuth()
  const isEditing = Boolean(distribuidor?.id)

  const [nome, setNome] = useState(distribuidor?.nome || '')
  const [cnpj, setCnpj] = useState(distribuidor?.cnpj || '')
  const [contatoNome, setContatoNome] = useState(distribuidor?.contato_nome || '')
  const [contatoEmail, setContatoEmail] = useState(distribuidor?.contato_email || '')
  const [contatoTelefone, setContatoTelefone] = useState(distribuidor?.contato_telefone || '')
  const [ufs, setUfs] = useState<string[]>(distribuidor?.ufs_atuacao || [])
  const [contratoInicio, setContratoInicio] = useState(
    distribuidor?.contrato_inicio ? distribuidor.contrato_inicio.slice(0, 10) : '',
  )
  const [contratoFim, setContratoFim] = useState(
    distribuidor?.contrato_fim ? distribuidor.contrato_fim.slice(0, 10) : '',
  )
  const [status, setStatus] = useState<string>(distribuidor?.status || 'ativo')
  const [observacoes, setObservacoes] = useState(distribuidor?.observacoes || '')
  const [saving, setSaving] = useState(false)

  // Atualizar quando props mudarem
  React.useEffect(() => {
    if (distribuidor) {
      setNome(distribuidor.nome || '')
      setCnpj(distribuidor.cnpj || '')
      setContatoNome(distribuidor.contato_nome || '')
      setContatoEmail(distribuidor.contato_email || '')
      setContatoTelefone(distribuidor.contato_telefone || '')
      setUfs(distribuidor.ufs_atuacao || [])
      setContratoInicio(
        distribuidor.contrato_inicio ? distribuidor.contrato_inicio.slice(0, 10) : '',
      )
      setContratoFim(distribuidor.contrato_fim ? distribuidor.contrato_fim.slice(0, 10) : '')
      setStatus(distribuidor.status || 'ativo')
      setObservacoes(distribuidor.observacoes || '')
    } else {
      setNome('')
      setCnpj('')
      setContatoNome('')
      setContatoEmail('')
      setContatoTelefone('')
      setUfs([])
      setContratoInicio('')
      setContratoFim('')
      setStatus('ativo')
      setObservacoes('')
    }
  }, [distribuidor, open])

  const toggleUf = (uf: string) => {
    if (ufs.includes(uf)) {
      setUfs(ufs.filter((u) => u !== uf))
    } else {
      setUfs([...ufs, uf])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('Informe a razão social ou nome do distribuidor.')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<Distribuidor> = {
        nome: nome.trim(),
        cnpj: cnpj.trim(),
        contato_nome: contatoNome.trim(),
        contato_email: contatoEmail.trim(),
        contato_telefone: contatoTelefone.trim(),
        ufs_atuacao: ufs,
        contrato_inicio: contratoInicio ? new Date(contratoInicio).toISOString() : undefined,
        contrato_fim: contratoFim ? new Date(contratoFim).toISOString() : undefined,
        status,
        observacoes: observacoes.trim(),
      }

      let res: Distribuidor
      if (isEditing && distribuidor?.id) {
        res = await updateDistribuidor(distribuidor.id, payload, user)
        toast.success(`Cadastro de '${res.nome}' atualizado com sucesso!`)
      } else {
        res = await createDistribuidor(payload, user)
        toast.success(`Distribuidor '${res.nome}' cadastrado com sucesso!`)
      }

      onSuccess(res)
      onOpenChange(false)
    } catch (err: any) {
      console.error('[DistribuidorFormModal] Erro ao salvar:', err)
      toast.error(err?.message || 'Falha ao salvar distribuidor. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isEditing ? 'Editar Cadastro do Distribuidor' : 'Novo Distribuidor'}
          </DialogTitle>
          <DialogDescription>
            Defina os dados cadastrais, canal de contato, vigência do contrato e UFs de atuação
            oficial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="nome" className="text-xs font-semibold">
                Razão Social / Nome do Distribuidor *
              </Label>
              <Input
                id="nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: FeedPro Science Nutrition"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnpj" className="text-xs font-semibold">
                CNPJ
              </Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-semibold">
                Status Operacional
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contatoNome" className="text-xs font-semibold">
                Nome do Contato Principal
              </Label>
              <Input
                id="contatoNome"
                value={contatoNome}
                onChange={(e) => setContatoNome(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contatoTelefone" className="text-xs font-semibold">
                Telefone / WhatsApp
              </Label>
              <Input
                id="contatoTelefone"
                value={contatoTelefone}
                onChange={(e) => setContatoTelefone(e.target.value)}
                placeholder="(62) 99999-9999"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="contatoEmail" className="text-xs font-semibold">
                E-mail de Contato
              </Label>
              <Input
                id="contatoEmail"
                type="email"
                value={contatoEmail}
                onChange={(e) => setContatoEmail(e.target.value)}
                placeholder="comercial@distribuidor.com.br"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contratoInicio" className="text-xs font-semibold">
                Início do Contrato
              </Label>
              <Input
                id="contratoInicio"
                type="date"
                value={contratoInicio}
                onChange={(e) => setContratoInicio(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contratoFim" className="text-xs font-semibold">
                Fim do Contrato (Vigência)
              </Label>
              <Input
                id="contratoFim"
                type="date"
                value={contratoFim}
                onChange={(e) => setContratoFim(e.target.value)}
              />
            </div>
          </div>

          {/* UFs de atuação */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label className="text-xs font-semibold">
              UFs de Atuação Homologadas ({ufs.length} selecionadas)
            </Label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-md border border-border/40">
              {BLINK_UF_LIST.map((uf) => {
                const isSelected = ufs.includes(uf)
                return (
                  <Badge
                    key={uf}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer select-none text-xs px-2.5 py-0.5 hover:opacity-80 transition-opacity"
                    onClick={() => toggleUf(uf)}
                  >
                    {uf}
                    {isSelected && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes" className="text-xs font-semibold">
              Observações Comerciais e Parcerias
            </Label>
            <Textarea
              id="observacoes"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações sobre política comercial, prazos, exclusividade ou canais atendidos..."
            />
          </div>

          <DialogFooter className="pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Cadastrar Distribuidor'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
