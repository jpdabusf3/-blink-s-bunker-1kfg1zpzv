import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import {
  formatCNPJ,
  cleanDigits,
  isValidCNPJ,
  formatTelefone,
  BRAZILIAN_UFS,
  CLIENT_SEGMENTOS,
} from '@/lib/cnpj'
import { createFactoryPB, updateFactoryPB } from '@/services/factories'
import { useAppContext } from '@/store/AppContext'
import { useAuth } from '@/hooks/use-auth'
import { logActivity } from '@/services/activity-logs'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import type { Factory, GestaoTecnica } from '@/types'

export interface ClienteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente?: Factory | null
  gestaoTecnicaList: GestaoTecnica[]
  onSuccess: () => void
}

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
  gestaoTecnicaList,
  onSuccess,
}: ClienteFormDialogProps) {
  const { addFactory, updateFactory } = useAppContext()
  const { user } = useAuth()
  const { logAction } = useFunnelActivityLog()

  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [contato, setContato] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [segmento, setSegmento] = useState<string>('none')
  const [vendedorId, setVendedorId] = useState<string>('none')
  const [vendedorTouched, setVendedorTouched] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  const [errors, setErrors] = useState<{ razaoSocial?: string; cnpj?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  // Membros ativos da equipe para vendedor
  const activeSellers = React.useMemo(() => {
    return gestaoTecnicaList
      .filter((m) => m.ativo !== false)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  }, [gestaoTecnicaList])

  // Inicializa o formulário ao abrir ou alterar cliente
  useEffect(() => {
    if (!open) return

    setErrors({})
    setVendedorTouched(false)

    if (cliente) {
      setRazaoSocial(cliente.name || '')
      setCnpj(formatCNPJ(cliente.cnpj || ''))
      setContato(cliente.contato || cliente.contactName || '')
      setEmail(cliente.contact_email || '')
      setTelefone(formatTelefone(cliente.telefone || cliente.contactPhone || ''))
      setCidade(cliente.city || '')
      setUf(cliente.state ? cliente.state.trim().toUpperCase() : '')
      const seg = cliente.carteira?.trim().toUpperCase()
      setSegmento(seg && (CLIENT_SEGMENTOS as readonly string[]).includes(seg) ? seg : 'none')
      setVendedorId(cliente.vendedor_id || 'none')
      setObservacoes(cliente.observacoes || cliente.notes || cliente.suggested_approach || '')
    } else {
      // Novo cliente
      setRazaoSocial('')
      setCnpj('')
      setContato('')
      setEmail('')
      setTelefone('')
      setCidade('')
      setUf('')
      setSegmento('none')
      setObservacoes('')

      // Auto-vínculo comercial por autoria (EXCETO Fernanda Franco)
      const isFernanda =
        (user?.email || '').toLowerCase().includes('fernanda.franco') ||
        (user?.name || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase() === 'fernanda franco'

      if (isFernanda) {
        setVendedorId('none')
      } else if (user?.gestao_tecnica_id) {
        setVendedorId(user.gestao_tecnica_id)
      } else if (user?.name && activeSellers.length > 0) {
        const normUserName = user.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase()
        const match = activeSellers.find(
          (m) =>
            m.nome
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim()
              .toLowerCase() === normUserName,
        )
        setVendedorId(match ? match.id : 'none')
      } else {
        setVendedorId('none')
      }
    }
  }, [open, cliente, user, activeSellers])

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const formatted = formatCNPJ(raw)
    setCnpj(formatted)
    if (errors.cnpj) {
      setErrors((prev) => ({ ...prev, cnpj: undefined }))
    }
  }

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setTelefone(formatTelefone(raw))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { razaoSocial?: string; cnpj?: string } = {}

    // Validação inline obrigatória
    const cleanName = razaoSocial.trim()
    if (!cleanName) {
      newErrors.razaoSocial = 'Informe a razão social'
    }

    const digitsCnpj = cleanDigits(cnpj)
    if (!digitsCnpj || digitsCnpj.length !== 14 || !isValidCNPJ(digitsCnpj)) {
      newErrors.cnpj = 'CNPJ inválido'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)

    try {
      // Validação de unicidade do CNPJ no banco de dados (criar ou editar)
      // Procurar registros com o mesmo CNPJ (seja mascarado ou com apenas dígitos)
      try {
        const existingRecords = await pb.collection('factories').getFullList({
          filter: `cnpj = '${digitsCnpj}' || cnpj = '${formatCNPJ(digitsCnpj)}'`,
          limit: 10,
        })
        const conflict = existingRecords.find((r) => !cliente || r.id !== cliente.id)
        if (conflict) {
          setErrors({ cnpj: 'Já existe um cliente com este CNPJ.' })
          setSubmitting(false)
          return
        }
      } catch (errCheck) {
        console.warn('[ClienteFormDialog] Falha ao verificar CNPJ duplicado:', errCheck)
      }

      // Resolver vendedor
      const finalVendedorId = vendedorId !== 'none' ? vendedorId : undefined
      const resolvedMember = finalVendedorId
        ? activeSellers.find((m) => m.id === finalVendedorId)
        : null
      const finalVendedorName = resolvedMember ? resolvedMember.nome : undefined

      const cleanUf = uf ? uf.trim().toUpperCase().slice(0, 2) : undefined
      const cleanSeg = segmento !== 'none' ? segmento : undefined

      const payload: Partial<Factory> = {
        name: cleanName,
        cnpj: digitsCnpj, // salva formato limpo (padrão 14 dígitos)
        contato: contato.trim() || undefined,
        contactName: contato.trim() || undefined,
        contact_email: email.trim() || undefined,
        telefone: cleanDigits(telefone) || undefined,
        contactPhone: cleanDigits(telefone) || undefined,
        city: cidade.trim() || (cliente?.city ?? ''),
        state: cleanUf || cliente?.state,
        carteira: cleanSeg || cliente?.carteira,
        vendedor_id: finalVendedorId,
        vendedor_name: finalVendedorName,
        observacoes: observacoes.trim() || undefined,
        notes: observacoes.trim() || undefined,
        suggested_approach: observacoes.trim() || cliente?.suggested_approach,
        salesOwner: cliente?.salesOwner || (user?.id ? user.id : undefined),
      }

      if (cliente) {
        // Atualizar
        await updateFactoryPB(cliente.id, payload)
        updateFactory(cliente.id, payload)

        logActivity(
          `Cliente atualizado: ${cleanName}`,
          `CNPJ: ${formatCNPJ(digitsCnpj)}, Cidade: ${cidade}/${cleanUf || '-'}, Segmento: ${cleanSeg || '-'}, Vendedor: ${finalVendedorName || 'Não atribuído'}`,
          cliente.id,
          'factories',
        ).catch(() => {})

        logAction({
          action_type: 'update',
          entity_type: 'client',
          entity_id: cliente.id,
          entity_name: cleanName,
          description: `Atualizou cliente ${cleanName}`,
        })

        toast.success('Cliente salvo com sucesso.')
      } else {
        // Criar
        const created = await createFactoryPB(payload)
        addFactory({ ...payload, id: created.id })

        logActivity(
          `Novo cliente cadastrado: ${cleanName}`,
          `CNPJ: ${formatCNPJ(digitsCnpj)}, Cidade: ${cidade}/${cleanUf || '-'}, Segmento: ${cleanSeg || '-'}, Vendedor: ${finalVendedorName || 'Não atribuído'}`,
          created.id,
          'factories',
        ).catch(() => {})

        logAction({
          action_type: 'create',
          entity_type: 'client',
          entity_id: created.id,
          entity_name: cleanName,
          description: `Cadastrou cliente ${cleanName}`,
        })

        toast.success('Cliente salvo com sucesso.')
      }

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error('[ClienteFormDialog] Erro ao salvar:', err)
      const msg = err?.message || 'Não foi possível salvar o cliente.'
      if (msg.toLowerCase().includes('cnpj') || msg.toLowerCase().includes('unique')) {
        setErrors({ cnpj: 'Já existe um cliente com este CNPJ.' })
      } else {
        toast.error('Não foi possível salvar o cliente. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>
            {cliente
              ? 'Atualize os dados cadastrais do cliente.'
              : 'Preencha os dados abaixo para cadastrar um novo cliente no CRM.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Razão Social */}
          <div className="space-y-1.5">
            <Label htmlFor="cli-razaoSocial">
              Razão Social <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cli-razaoSocial"
              value={razaoSocial}
              onChange={(e) => {
                setRazaoSocial(e.target.value)
                if (errors.razaoSocial) {
                  setErrors((prev) => ({ ...prev, razaoSocial: undefined }))
                }
              }}
              placeholder="Ex: Granja São Paulo Nutrição Animal Ltda"
              className={
                errors.razaoSocial ? 'border-destructive focus-visible:ring-destructive' : ''
              }
            />
            {errors.razaoSocial && (
              <p className="text-xs text-destructive font-medium">{errors.razaoSocial}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CNPJ */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-cnpj">
                CNPJ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cli-cnpj"
                value={cnpj}
                onChange={handleCnpjChange}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className={errors.cnpj ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.cnpj && <p className="text-xs text-destructive font-medium">{errors.cnpj}</p>}
            </div>

            {/* Contato */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-contato">Contato (Nome)</Label>
              <Input
                id="cli-contato"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-email">E-mail</Label>
              <Input
                id="cli-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@empresa.com.br"
              />
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-telefone">Telefone</Label>
              <Input
                id="cli-telefone"
                value={telefone}
                onChange={handleTelefoneChange}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Cidade */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cli-cidade">Cidade</Label>
              <Input
                id="cli-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: Cascavel"
              />
            </div>

            {/* UF */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-uf">UF</Label>
              <Select
                value={uf || 'none'}
                onValueChange={(val) => setUf(val === 'none' ? '' : val)}
              >
                <SelectTrigger id="cli-uf">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="none">Selecione</SelectItem>
                  {BRAZILIAN_UFS.map((sigla) => (
                    <SelectItem key={sigla} value={sigla}>
                      {sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Segmento */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-segmento">Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger id="cli-segmento">
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {CLIENT_SEGMENTOS.map((seg) => (
                    <SelectItem key={seg} value={seg}>
                      {seg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendedor */}
            <div className="space-y-1.5">
              <Label htmlFor="cli-vendedor">Vendedor Responsável</Label>
              <Select
                value={vendedorId}
                onValueChange={(val) => {
                  setVendedorTouched(true)
                  setVendedorId(val)
                }}
              >
                <SelectTrigger id="cli-vendedor">
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                  {activeSellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="cli-observacoes">Observações</Label>
            <Textarea
              id="cli-observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais, histórico inicial de contato ou especificidades da operação..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : cliente ? (
                'Salvar Alterações'
              ) : (
                'Cadastrar Cliente'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
