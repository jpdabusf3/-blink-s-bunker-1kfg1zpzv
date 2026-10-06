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
import { Loader2, History, UserCheck, Search, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { fetchViaCep, resolveClientCoordinates } from '@/services/client-geocoding'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FactoryHistoryView } from '@/components/FactoryHistoryView'
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
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import {
  CLIENT_PROFILE_CATEGORIES,
  toCanonicalCategory,
  normalizeProfileList,
  type ClientProfileCategory,
} from '@/constants/clientCategories'
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
import { normalizeSellerName } from '@/lib/vendedorFilterHelper'
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
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [complemento, setComplemento] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepNotice, setCepNotice] = useState<string | null>(null)
  const [segmento, setSegmento] = useState<string>('none')
  const [categoria, setCategoria] = useState<string>('none')
  const [categoriaTouched, setCategoriaTouched] = useState(false)
  const [vendedorId, setVendedorId] = useState<string>('none')
  const [vendedorTouched, setVendedorTouched] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmProfileDialogOpen, setConfirmProfileDialogOpen] = useState(false)
  const [pendingSavePayload, setPendingSavePayload] = useState<Partial<Factory> | null>(null)
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados')

  // Membros ativos da equipe para vendedor
  const activeSellers = React.useMemo(() => {
    return gestaoTecnicaList
      .filter((m) => m.ativo !== false)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  }, [gestaoTecnicaList])

  // Inicializa o formulário ao abrir ou alterar cliente
  useEffect(() => {
    if (!open) return

    setActiveTab('dados')
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
      setCep(cliente.cep || '')
      setLogradouro(cliente.logradouro || '')
      setNumero(cliente.numero || '')
      setBairro(cliente.bairro || '')
      setComplemento(cliente.complemento || '')
      setCepNotice(null)
      const seg = cliente.carteira?.trim().toUpperCase()
      setSegmento(seg && (CLIENT_SEGMENTOS as readonly string[]).includes(seg) ? seg : 'none')

      // Categoria / Perfil
      const normProfiles = normalizeProfileList(cliente.profile_type)
      const canonicalMatch = normProfiles.length > 0 ? toCanonicalCategory(normProfiles[0]) : null
      setCategoria(canonicalMatch || (normProfiles.length > 0 ? normProfiles[0] : 'none'))
      setCategoriaTouched(false)

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
      setCep('')
      setLogradouro('')
      setNumero('')
      setBairro('')
      setComplemento('')
      setCepNotice(null)
      setSegmento('none')
      setCategoria('Indústria')
      setCategoriaTouched(false)
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

  // Máscara e busca automática de CEP via ViaCEP ao perder o foco (blur)
  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    if (digits.length > 5) {
      setCep(`${digits.slice(0, 5)}-${digits.slice(5)}`)
    } else {
      setCep(digits)
    }
    if (cepNotice) {
      setCepNotice(null)
    }
  }

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) return

    setCepLoading(true)
    setCepNotice(null)
    try {
      const data = await fetchViaCep(cleanCep)
      if (data && !data.erro) {
        if (data.logradouro) setLogradouro(data.logradouro)
        if (data.bairro) setBairro(data.bairro)
        if (data.localidade) setCidade(data.localidade)
        if (data.uf) {
          const upperUf = data.uf.trim().toUpperCase().slice(0, 2)
          if (BRAZILIAN_UFS.includes(upperUf as any)) {
            setUf(upperUf)
          }
        }
        if (data.complemento && !complemento) {
          setComplemento(data.complemento)
        }
      } else {
        setCepNotice('CEP não encontrado. Você pode continuar o cadastro normalmente.')
      }
    } catch (err) {
      console.warn('[ClienteFormDialog] Erro na busca de CEP:', err)
      setCepNotice('CEP não encontrado. Você pode continuar o cadastro normalmente.')
    } finally {
      setCepLoading(false)
    }
  }

  const executeSave = async (payloadToSave: Partial<Factory>) => {
    setSubmitting(true)
    const cleanName = (payloadToSave.name || '').trim()
    const digitsCnpj = (payloadToSave.cnpj || '').trim()
    const cleanUf = payloadToSave.state
    const cleanSeg = payloadToSave.carteira
    const finalVendedorName = payloadToSave.vendedor_name

    try {
      if (cliente) {
        // Atualizar
        await updateFactoryPB(cliente.id, payloadToSave)
        updateFactory(cliente.id, payloadToSave)

        logActivity(
          `Cliente atualizado: ${cleanName}`,
          `CNPJ: ${formatCNPJ(digitsCnpj)}, Cidade: ${payloadToSave.city || '-'}/${cleanUf || '-'}, Segmento: ${cleanSeg || '-'}, Categoria: ${Array.isArray(payloadToSave.profile_type) ? payloadToSave.profile_type.join(', ') : '-'}, Vendedor: ${finalVendedorName || 'Não atribuído'}`,
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
        const created = await createFactoryPB(payloadToSave)
        addFactory({ ...payloadToSave, id: created.id })

        logActivity(
          `Novo cliente cadastrado: ${cleanName}`,
          `CNPJ: ${formatCNPJ(digitsCnpj)}, Cidade: ${payloadToSave.city || '-'}/${cleanUf || '-'}, Segmento: ${cleanSeg || '-'}, Categoria: ${Array.isArray(payloadToSave.profile_type) ? payloadToSave.profile_type.join(', ') : '-'}, Vendedor: ${finalVendedorName || 'Não atribuído'}`,
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
      const fieldErrors = extractFieldErrors(err)
      const fieldErrorKeys = Object.keys(fieldErrors)

      if (fieldErrorKeys.length > 0) {
        // Mapeia erros do PocketBase para campos do formulário
        const mappedErrors: Record<string, string> = {}
        const errorDescriptions: string[] = []

        for (const [field, message] of Object.entries(fieldErrors)) {
          if (field === 'name') {
            mappedErrors.razaoSocial = message
            errorDescriptions.push(`Razão Social (${message})`)
          } else if (field === 'cnpj') {
            mappedErrors.cnpj = message
            errorDescriptions.push(`CNPJ (${message})`)
          } else if (field === 'profile_type') {
            mappedErrors.categoria = message
            errorDescriptions.push(`Categoria (${message})`)
          } else if (field === 'carteira') {
            mappedErrors.segmento = message
            errorDescriptions.push(`Segmento/Carteira (${message})`)
          } else if (field === 'vendedor_id') {
            mappedErrors.vendedor = message
            errorDescriptions.push(`Vendedor (${message})`)
          } else {
            mappedErrors[field] = message
            errorDescriptions.push(`${field} (${message})`)
          }
        }

        setErrors((prev) => ({ ...prev, ...mappedErrors }))
        toast.error(
          `Não foi possível salvar: campo(s) inválido(s): ${errorDescriptions.join(', ')}`,
        )
      } else {
        const msg = getErrorMessage(err)
        if (msg.toLowerCase().includes('cnpj') || msg.toLowerCase().includes('unique')) {
          setErrors((prev) => ({ ...prev, cnpj: 'Já existe um cliente com este CNPJ.' }))
          toast.error('Não foi possível salvar: Já existe um cliente com este CNPJ.')
        } else {
          toast.error(`Não foi possível salvar: ${msg}`)
        }
      }
    } finally {
      setSubmitting(false)
      setPendingSavePayload(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { razaoSocial?: string; cnpj?: string; categoria?: string } = {}

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
          filter: `(cnpj = '${digitsCnpj}' || cnpj = '${formatCNPJ(digitsCnpj)}') && is_deleted != true`,
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

      // Validação/Confirmação de Categoria Canônica
      // Se estiver editando um cliente e a categoria estiver vazia ('none') ou fora do padrão,
      // pedir confirmação ao usuário antes de salvar.
      const canonicalCategory = categoria !== 'none' ? toCanonicalCategory(categoria) : null
      const isCategoryValid = !!canonicalCategory

      // Formato padronizado gravado no PocketBase (array com categoria canônica, ex: ['Indústria'])
      const finalProfileType = canonicalCategory
        ? ([canonicalCategory] as unknown as Factory['profile_type'])
        : categoria !== 'none'
          ? ([categoria] as unknown as Factory['profile_type'])
          : (['Indústria'] as unknown as Factory['profile_type'])

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
        cep: cep.trim() || undefined,
        logradouro: logradouro.trim() || undefined,
        numero: numero.trim() || undefined,
        bairro: bairro.trim() || undefined,
        complemento: complemento.trim() || undefined,
        carteira: cleanSeg || cliente?.carteira,
        profile_type: finalProfileType,
        vendedor_id: finalVendedorId,
        vendedor_name: finalVendedorName ? normalizeSellerName(finalVendedorName) : undefined,
        observacoes: observacoes.trim() || undefined,
        notes: observacoes.trim() || undefined,
        suggested_approach: observacoes.trim() || cliente?.suggested_approach,
        salesOwner: cliente?.salesOwner || (user?.id ? user.id : undefined),
      }

      // Geocodificação hierárquica preventiva para salvar coordenadas imediatamente
      try {
        const geoRes = await resolveClientCoordinates({
          ...cliente,
          ...payload,
        })
        payload.precisao = geoRes.precisao
        if (typeof geoRes.latitude === 'number' && typeof geoRes.longitude === 'number') {
          payload.latitude = geoRes.latitude
          payload.longitude = geoRes.longitude
          payload.lat = geoRes.latitude
          payload.lng = geoRes.longitude
        }
      } catch (errGeo) {
        console.warn('[ClienteFormDialog] Geocodificação silenciosa no salvamento:', errGeo)
      }

      // Se estiver editando e a categoria estiver vazia ou inválida, interrompe e pede confirmação
      if (cliente && (!isCategoryValid || categoria === 'none')) {
        setPendingSavePayload(payload)
        setConfirmProfileDialogOpen(true)
        setSubmitting(false)
        return
      }

      await executeSave(payload)
    } catch (err: any) {
      console.error('[ClienteFormDialog] Erro na validação prévia:', err)
      toast.error('Ocorreu um erro ao preparar os dados do cliente.')
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
              ? 'Atualize os dados cadastrais do cliente ou consulte o histórico de alterações.'
              : 'Preencha os dados abaixo para cadastrar um novo cliente no CRM.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'dados' | 'historico')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="dados" className="gap-2 text-xs">
              <UserCheck className="w-3.5 h-3.5" />
              Dados do Cadastro
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2 text-xs">
              <History className="w-3.5 h-3.5" />
              Histórico de Alterações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-0 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className={
                      errors.cnpj ? 'border-destructive focus-visible:ring-destructive' : ''
                    }
                  />
                  {errors.cnpj && (
                    <p className="text-xs text-destructive font-medium">{errors.cnpj}</p>
                  )}
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

              {/* Endereço - Campos opcionais com busca ViaCEP */}
              <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Endereço e Localização
                    (Opcional)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Preencha o que tiver em mãos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* CEP com busca ViaCEP no blur */}
                  <div className="space-y-1 sm:col-span-1">
                    <Label htmlFor="cli-cep" className="text-xs">
                      CEP
                    </Label>
                    <div className="relative">
                      <Input
                        id="cli-cep"
                        value={cep}
                        onChange={handleCepChange}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        maxLength={9}
                        className="text-xs pr-8"
                      />
                      {cepLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Logradouro */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="cli-logradouro" className="text-xs">
                      Logradouro (Rua / Avenida)
                    </Label>
                    <Input
                      id="cli-logradouro"
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      placeholder="Ex: Avenida Melvin Jones"
                      className="text-xs"
                    />
                  </div>
                </div>

                {cepNotice && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {cepNotice}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Número */}
                  <div className="space-y-1">
                    <Label htmlFor="cli-numero" className="text-xs">
                      Número
                    </Label>
                    <Input
                      id="cli-numero"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Ex: 440 ou S/N"
                      className="text-xs"
                    />
                  </div>

                  {/* Bairro */}
                  <div className="space-y-1">
                    <Label htmlFor="cli-bairro" className="text-xs">
                      Bairro
                    </Label>
                    <Input
                      id="cli-bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Ex: Distrito Industrial"
                      className="text-xs"
                    />
                  </div>

                  {/* Complemento */}
                  <div className="space-y-1">
                    <Label htmlFor="cli-complemento" className="text-xs">
                      Complemento
                    </Label>
                    <Input
                      id="cli-complemento"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Ex: Lote 211, Galpão A"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Cidade */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="cli-cidade" className="text-xs">
                      Cidade
                    </Label>
                    <Input
                      id="cli-cidade"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: Cascavel"
                      className="text-xs"
                    />
                  </div>

                  {/* UF */}
                  <div className="space-y-1">
                    <Label htmlFor="cli-uf" className="text-xs">
                      UF
                    </Label>
                    <Select
                      value={uf || 'none'}
                      onValueChange={(val) => setUf(val === 'none' ? '' : val)}
                    >
                      <SelectTrigger id="cli-uf" className="text-xs">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 z-[9999]">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Perfil / Categoria Canônica */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-categoria">
                    Categoria / Perfil <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={categoria}
                    onValueChange={(val) => {
                      setCategoriaTouched(true)
                      setCategoria(val)
                      if (errors.categoria) {
                        setErrors((prev) => ({ ...prev, categoria: undefined }))
                      }
                    }}
                  >
                    <SelectTrigger
                      id="cli-categoria"
                      className={errors.categoria ? 'border-destructive' : ''}
                    >
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informada (pendente)</SelectItem>
                      {CLIENT_PROFILE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                      {/* Se houver uma categoria legada/outros não vazia */}
                      {categoria !== 'none' &&
                        !CLIENT_PROFILE_CATEGORIES.includes(categoria as ClientProfileCategory) && (
                          <SelectItem value={categoria}>Outra: {categoria}</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                  {errors.categoria && (
                    <p className="text-xs text-destructive font-medium">{errors.categoria}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Padrão uniforme para segmentação de carteira
                  </p>
                </div>

                {/* Segmento */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-segmento">Segmento (Espécie)</Label>
                  <Select
                    value={segmento}
                    onValueChange={(val) => {
                      setSegmento(val)
                      if (errors.segmento) {
                        setErrors((prev) => ({ ...prev, segmento: undefined }))
                      }
                    }}
                  >
                    <SelectTrigger
                      id="cli-segmento"
                      className={errors.segmento ? 'border-destructive' : ''}
                    >
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
                  {errors.segmento && (
                    <p className="text-xs text-destructive font-medium">{errors.segmento}</p>
                  )}
                </div>

                {/* Vendedor */}
                <div className="space-y-1.5">
                  <Label htmlFor="cli-vendedor">Vendedor Responsável</Label>
                  <Select
                    value={vendedorId}
                    onValueChange={(val) => {
                      setVendedorTouched(true)
                      setVendedorId(val)
                      if (errors.vendedor) {
                        setErrors((prev) => ({ ...prev, vendedor: undefined }))
                      }
                    }}
                  >
                    <SelectTrigger
                      id="cli-vendedor"
                      className={errors.vendedor ? 'border-destructive' : ''}
                    >
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                      {activeSellers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {normalizeSellerName(s.nome)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vendedor && (
                    <p className="text-xs text-destructive font-medium">{errors.vendedor}</p>
                  )}
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
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            <FactoryHistoryView factoryId={cliente?.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Diálogo de confirmação de categoria/perfil ao editar */}
      <AlertDialog
        open={confirmProfileDialogOpen}
        onOpenChange={(v) => {
          if (!v) {
            setConfirmProfileDialogOpen(false)
            setPendingSavePayload(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirme a categoria do cliente antes de salvar</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                Este cliente não possui uma categoria padronizada no catálogo oficial. Para manter a
                base uniforme e garantir relatórios consistentes, selecione ou confirme a categoria:
              </p>
              <div className="pt-2">
                <Label htmlFor="cli-confirm-cat" className="text-xs font-semibold text-foreground">
                  Selecione a categoria canônica:
                </Label>
                <div className="mt-1.5">
                  <Select
                    value={categoria === 'none' ? 'Indústria' : categoria}
                    onValueChange={(val) => setCategoria(val)}
                  >
                    <SelectTrigger id="cli-confirm-cat">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_PROFILE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmProfileDialogOpen(false)
                setPendingSavePayload(null)
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                const chosenCat =
                  categoria === 'none' ? 'Indústria' : toCanonicalCategory(categoria) || categoria
                setCategoria(chosenCat)
                setConfirmProfileDialogOpen(false)
                if (pendingSavePayload) {
                  const updatedPayload = {
                    ...pendingSavePayload,
                    profile_type: [chosenCat] as unknown as Factory['profile_type'],
                  }
                  void executeSave(updatedPayload)
                }
              }}
            >
              Confirmar e Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
