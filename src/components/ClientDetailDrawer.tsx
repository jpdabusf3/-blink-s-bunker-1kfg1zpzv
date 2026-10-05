import { useState, useEffect, useCallback, useRef, useId } from 'react'
import {
  X,
  Phone,
  MessageCircle,
  Mail,
  FileText,
  Calendar as CalendarIcon,
  Loader2,
  AlertCircle,
  Building2,
  Layers,
  Clock,
  Send,
  PlusCircle,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useIsMobile } from '@/hooks/use-mobile'
import { getFactoryById, updateFactoryPB } from '@/services/factories'
import {
  fetchClientInteractions,
  registerCallInteraction,
  addNoteInteraction,
  scheduleFollowUpInteraction,
  type ClientInteractionActivity,
  type CallOutcome,
} from '@/services/client-interactions'
import { getNextFunnelStage } from '@/services/agenda-service'
import { formatDateTime, cn } from '@/lib/utils'
import {
  type FunilVendasStatus,
  deriveFunilVendasStatus,
  STATUS_TO_FUNNEL_STAGE,
} from '@/lib/funnel-status'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import { logActivity } from '@/services/activity-logs'
import type { Factory, FunnelStage } from '@/types'

const STATUS_COLUMNS: readonly FunilVendasStatus[] = [
  'Ativo',
  'Inativo',
  'Negociações Encerradas',
] as const

const FUNIL_STAGES: readonly FunnelStage[] = [
  'Lead',
  'Primeiro Contato',
  'Diagnóstico Técnico',
  'Apresentação',
  'Teste/Trial',
  'Proposta',
  'Negociação',
  'Fechamento',
  'Pós-venda',
  'Perda',
] as const

const CALL_OUTCOMES: readonly CallOutcome[] = [
  'Sem resposta',
  'Interessado',
  'Reagendou',
  'Não interessou',
] as const

interface StageSuggestion {
  actionText: string
  daysOffset: number
}

function getSuggestedActionForStage(stage: string): StageSuggestion | null {
  switch (stage) {
    case 'Lead':
    case 'Novo lead':
      return {
        actionText: 'Fazer primeiro contato em 48h',
        daysOffset: 2,
      }
    case 'Primeiro Contato':
    case 'Contato feito':
    case 'Diagnóstico Técnico':
      return {
        actionText: 'Enviar proposta',
        daysOffset: 2,
      }
    case 'Apresentação':
    case 'Teste/Trial':
      return {
        actionText: 'Enviar proposta',
        daysOffset: 2,
      }
    case 'Proposta':
    case 'Proposta enviada':
    case 'Negociação':
      return {
        actionText: 'Fazer follow-up em 3 dias',
        daysOffset: 3,
      }
    case 'Fechamento':
    case 'Fechado':
    case 'Pós-venda':
      return {
        actionText: 'Agendar revisão em 30 dias',
        daysOffset: 30,
      }
    case 'Perda':
    default:
      return null
  }
}

export interface ClientDetailDrawerProps {
  clientId: string | null
  initialClient?: Factory | null
  open: boolean
  onClose: () => void
  onClientUpdated?: (updated: Factory) => void
  /** Elemento ou seletor de retorno de foco ao fechar (acessibilidade) */
  triggerRef?: React.RefObject<HTMLElement | null>
  /** Modo do funil: 'funil_vendas' (status_funil: Ativo/Inativo/Negociações Encerradas) ou 'funil' (funnelStage: Lead...Perda) */
  mode?: 'funil_vendas' | 'funil'
  /** Identificador de origem para os logs de auditoria ('funil' | 'funil_vendas') */
  origin?: 'funil' | 'funil_vendas'
}

export function ClientDetailDrawer({
  clientId,
  initialClient,
  open,
  onClose,
  onClientUpdated,
  triggerRef,
  mode = 'funil_vendas',
  origin = 'funil_vendas',
}: ClientDetailDrawerProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { logAction } = useFunnelActivityLog()
  const drawerRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  // Estados de dados
  const [client, setClient] = useState<Factory | null>(initialClient || null)
  const [activities, setActivities] = useState<ClientInteractionActivity[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)

  // Sub-formulários de ações rápidas: 'none' | 'call' | 'note' | 'followup'
  const [activeForm, setActiveForm] = useState<'none' | 'call' | 'note' | 'followup'>('none')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Formulário de ligação
  const [callDate, setCallDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [callSummary, setCallSummary] = useState<string>('')
  const [callOutcome, setCallOutcome] = useState<CallOutcome>('Interessado')
  const [callSummaryError, setCallSummaryError] = useState<string>('')

  // Formulário de nota
  const [noteText, setNoteText] = useState<string>('')
  const [noteError, setNoteError] = useState<string>('')

  // Formulário de follow-up
  const [followUpDate, setFollowUpDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })
  const [followUpNote, setFollowUpNote] = useState<string>('')

  // Automação: Sugestão de Próximo Passo
  const [dismissedSuggestionStage, setDismissedSuggestionStage] = useState<string | null>(null)
  const [isSchedulingSuggestion, setIsSchedulingSuggestion] = useState<boolean>(false)

  // Automação: Avançar após ligação "Interessado"
  const [interestedAdvanceStage, setInterestedAdvanceStage] = useState<FunnelStage | null>(null)
  const [isAdvancingInterested, setIsAdvancingInterested] = useState<boolean>(false)

  // Status / Estágio no funil
  const [currentStatus, setCurrentStatus] = useState<FunilVendasStatus>('Ativo')
  const [currentStage, setCurrentStage] = useState<FunnelStage>('Lead')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false)

  // Carrega dados completos do cliente e histórico
  const loadData = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    setHasError(false)
    try {
      const [fetchedClient, fetchedActivities] = await Promise.all([
        getFactoryById(clientId),
        fetchClientInteractions(clientId),
      ])

      if (!fetchedClient) {
        throw new Error('Cliente não encontrado')
      }

      setClient(fetchedClient)
      setActivities(fetchedActivities)

      const statusVal =
        deriveFunilVendasStatus(fetchedClient.funnelStage, fetchedClient.ultimo_pedido) ||
        (fetchedClient.status_funil as FunilVendasStatus) ||
        'Ativo'
      setCurrentStatus(statusVal)
      setCurrentStage(fetchedClient.funnelStage || 'Lead')
    } catch (err) {
      console.error('[ClientDetailDrawer] Erro ao carregar dados:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (open && clientId) {
      setActiveForm('none')
      setCallSummary('')
      setCallSummaryError('')
      setNoteText('')
      setNoteError('')
      setFollowUpNote('')
      setDismissedSuggestionStage(null)
      setInterestedAdvanceStage(null)
      loadData()
    }
  }, [open, clientId, loadData])

  // Acessibilidade: gerenciar foco e tecla Escape
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // Foco inicial no container do drawer
    const timer = setTimeout(() => {
      drawerRef.current?.focus()
    }, 100)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
    }
  }, [open])

  const handleClose = () => {
    onClose()
    // Retorna foco para o card que disparou a abertura
    if (triggerRef?.current) {
      triggerRef.current.focus()
    }
  }

  // Manipulação de mudança de status no funil
  const handleFunnelStageChange = async (newValue: string) => {
    if (!client || !clientId || isUpdatingStatus) return

    if (mode === 'funil') {
      const newStage = newValue as FunnelStage
      if (newStage === currentStage) return
      const oldStage = currentStage

      setIsUpdatingStatus(true)
      setCurrentStage(newStage)
      const updatedClient: Factory = {
        ...client,
        funnelStage: newStage,
      }
      setClient(updatedClient)
      onClientUpdated?.(updatedClient)

      try {
        await updateFactoryPB(clientId, {
          funnelStage: newStage,
        } as any)

        // Log de auditoria geral
        await logActivity(
          `Estágio Funil: ${oldStage} → ${newStage}`,
          `Cliente: ${client.name}`,
          clientId,
          'factories',
          {
            tipo: 'status',
            status_anterior: oldStage,
            status_novo: newStage,
            origem: origin,
          },
        )

        // Automação: registrar no histórico do cliente "Status alterado para [stage name]"
        try {
          await pb.collection('activity_logs').create({
            user: user?.id || null,
            action: `Status alterado para ${newStage}`,
            details: `Mudança de estágio do funil de "${oldStage}" para "${newStage}".`,
            recordId: clientId,
            target_collection: 'factories',
            tipo: 'status',
            origem: origin,
          })
          const refreshedActs = await fetchClientInteractions(clientId)
          setActivities(refreshedActs)
        } catch (logErr) {
          console.warn('[ClientDetailDrawer] Falha ao gravar log de automação de status:', logErr)
        }

        logAction({
          action_type: 'status_change',
          entity_type: 'deal',
          entity_id: clientId,
          entity_name: client.name,
          old_value: oldStage,
          new_value: newStage,
          description: `Moveu ${client.name} de ${oldStage} para ${newStage}`,
        })

        toast({
          title: 'Status atualizado',
          description: `Cliente movido para ${newStage}.`,
        })
      } catch (err) {
        console.error('[ClientDetailDrawer] Falha ao atualizar estágio no funil:', err)
        // Reverter
        setCurrentStage(oldStage)
        setClient({
          ...client,
          funnelStage: oldStage,
        })
        toast({
          title: 'Erro ao atualizar status',
          description: 'Não foi possível salvar o novo status no servidor.',
          variant: 'destructive',
        })
      } finally {
        setIsUpdatingStatus(false)
      }
    } else {
      const newStatus = newValue as FunilVendasStatus
      if (newStatus === currentStatus) return
      const oldStatus = currentStatus
      const oldStage = client.funnelStage || STATUS_TO_FUNNEL_STAGE[oldStatus]
      const newStage = STATUS_TO_FUNNEL_STAGE[newStatus]

      setIsUpdatingStatus(true)
      setCurrentStatus(newStatus)
      const updatedClient: Factory = {
        ...client,
        status_funil: newStatus as any,
        funnelStage: newStage as any,
      }
      setClient(updatedClient)
      onClientUpdated?.(updatedClient)

      try {
        await updateFactoryPB(clientId, {
          status_funil: newStatus,
          funnelStage: newStage,
        } as any)

        // Log de auditoria geral
        await logActivity(
          `Status Funil de Vendas: ${oldStatus} → ${newStatus} (${newStage})`,
          `Cliente: ${client.name}`,
          clientId,
          'factories',
          {
            tipo: 'status',
            status_anterior: oldStatus,
            status_novo: newStatus,
            origem: origin,
          },
        )

        // Automação: registrar no histórico do cliente "Status alterado para [stage name]"
        try {
          await pb.collection('activity_logs').create({
            user: user?.id || null,
            action: `Status alterado para ${newStatus}`,
            details: `Mudança de status no funil de vendas de "${oldStatus}" para "${newStatus}".`,
            recordId: clientId,
            target_collection: 'factories',
            tipo: 'status',
            origem: origin,
          })
          const refreshedActs = await fetchClientInteractions(clientId)
          setActivities(refreshedActs)
        } catch (logErr) {
          console.warn('[ClientDetailDrawer] Falha ao gravar log de automação de status:', logErr)
        }

        logAction({
          action_type: 'status_change',
          entity_type: 'deal',
          entity_id: clientId,
          entity_name: client.name,
          old_value: oldStatus,
          new_value: newStatus,
          description: `Moveu ${client.name} de ${oldStatus} para ${newStatus} (${newStage})`,
        })

        toast({
          title: 'Status atualizado',
          description: `Cliente movido para ${newStatus}.`,
        })
      } catch (err) {
        console.error('[ClientDetailDrawer] Falha ao atualizar status:', err)
        // Reverter
        setCurrentStatus(oldStatus)
        setClient({
          ...client,
          status_funil: oldStatus as any,
          funnelStage: oldStage as any,
        })
        toast({
          title: 'Erro ao atualizar status',
          description: 'Não foi possível salvar o novo status no servidor.',
          variant: 'destructive',
        })
      } finally {
        setIsUpdatingStatus(false)
      }
    }
  }

  // Envio do formulário "Registrar ligação"
  const handleSaveCall = async () => {
    if (!client || !clientId) return
    const trimmed = callSummary.trim()
    if (trimmed.length < 3) {
      setCallSummaryError('Escreva pelo menos 3 caracteres')
      return
    }
    setCallSummaryError('')
    setIsSubmitting(true)
    try {
      await registerCallInteraction({
        clientId,
        clientName: client.name,
        summary: trimmed,
        outcome: callOutcome,
        dateStr: callDate,
        userId: user?.id,
        origem: origin,
      })

      logAction({
        action_type: 'create',
        entity_type: 'action_plan',
        entity_id: clientId,
        entity_name: client.name,
        description: `Registrou ligação com ${client.name} (${callOutcome}): ${trimmed}`,
      })

      toast({
        title: 'Atividade registrada',
        description: 'Ligação adicionada ao histórico do cliente com sucesso.',
      })

      setCallSummary('')
      setActiveForm('none')
      // Atualiza lista de atividades
      const refreshedActivities = await fetchClientInteractions(clientId)
      setActivities(refreshedActivities)
      // Atualiza lastInteraction local
      const nowIso = new Date().toISOString()
      const updatedClient = { ...client, lastInteraction: nowIso }
      setClient(updatedClient)
      onClientUpdated?.(updatedClient)

      // Se o resultado foi "Interessado", calcula próximo estágio e exibe botão de avanço
      if (callOutcome === 'Interessado') {
        const nextStg = getNextFunnelStage(currentStage) as FunnelStage | null
        if (nextStg && nextStg !== currentStage && nextStg !== 'Perda') {
          setInterestedAdvanceStage(nextStg)
        } else {
          setInterestedAdvanceStage(null)
        }
      } else {
        setInterestedAdvanceStage(null)
      }
    } catch (err) {
      console.error('[ClientDetailDrawer] Falha ao salvar ligação:', err)
      toast({
        title: 'Erro ao registrar ligação',
        description: 'Não foi possível salvar o registro de ligação.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Envio do formulário "Adicionar nota"
  const handleSaveNote = async () => {
    if (!client || !clientId) return
    const trimmed = noteText.trim()
    if (trimmed.length < 3) {
      setNoteError('Escreva pelo menos 3 caracteres')
      return
    }
    setNoteError('')
    setIsSubmitting(true)
    try {
      await addNoteInteraction({
        clientId,
        clientName: client.name,
        note: trimmed,
        userId: user?.id,
        origem: origin,
      })

      logAction({
        action_type: 'create',
        entity_type: 'action_plan',
        entity_id: clientId,
        entity_name: client.name,
        description: `Adicionou nota para ${client.name}: ${trimmed}`,
      })

      toast({
        title: 'Nota salva',
        description: 'Nota adicionada ao histórico do cliente com sucesso.',
      })

      setNoteText('')
      setActiveForm('none')
      const refreshedActivities = await fetchClientInteractions(clientId)
      setActivities(refreshedActivities)
      const nowIso = new Date().toISOString()
      const updatedClient = { ...client, lastInteraction: nowIso }
      setClient(updatedClient)
      onClientUpdated?.(updatedClient)
    } catch (err) {
      console.error('[ClientDetailDrawer] Falha ao salvar nota:', err)
      toast({
        title: 'Erro ao salvar nota',
        description: 'Não foi possível salvar a nota no servidor.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Envio do formulário "Agendar follow-up"
  const handleSaveFollowUp = async () => {
    if (!client || !clientId) return
    if (!followUpDate) {
      toast({
        title: 'Data obrigatória',
        description: 'Selecione uma data para o follow-up.',
        variant: 'destructive',
      })
      return
    }
    const cleanNote = followUpNote.trim()
    if (cleanNote && cleanNote.length < 3) {
      toast({
        title: 'Nota muito curta',
        description: 'Escreva pelo menos 3 caracteres ou deixe em branco.',
        variant: 'destructive',
      })
      return
    }
    setIsSubmitting(true)
    try {
      await scheduleFollowUpInteraction({
        clientId,
        clientName: client.name,
        followUpDate,
        note: cleanNote,
        userId: user?.id,
        origem: origin,
      })

      logAction({
        action_type: 'create',
        entity_type: 'action_plan',
        entity_id: clientId,
        entity_name: client.name,
        description: `Agendou follow-up com ${client.name} para ${followUpDate}`,
      })

      toast({
        title: 'Follow-up agendado',
        description: 'Compromisso criado na agenda e no histórico.',
      })

      setFollowUpNote('')
      setActiveForm('none')
      const refreshedActivities = await fetchClientInteractions(clientId)
      setActivities(refreshedActivities)
    } catch (err) {
      console.error('[ClientDetailDrawer] Falha ao agendar follow-up:', err)
      toast({
        title: 'Erro ao agendar follow-up',
        description: 'Não foi possível criar o follow-up.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Automação: Agendar Próximo Passo Sugerido em 1 clique
  const handleScheduleSuggestion = async () => {
    if (!client || !clientId) return
    const stageForMapping = (mode === 'funil' ? currentStage : currentStatus) || 'Lead'
    const suggestion = getSuggestedActionForStage(stageForMapping)
    if (!suggestion) return

    setIsSchedulingSuggestion(true)
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + suggestion.daysOffset)
      const followUpDateStr = targetDate.toISOString().split('T')[0]

      await scheduleFollowUpInteraction({
        clientId,
        clientName: client.name,
        followUpDate: followUpDateStr,
        note: suggestion.actionText,
        userId: user?.id,
        origem: origin,
      })

      logAction({
        action_type: 'create',
        entity_type: 'action_plan',
        entity_id: clientId,
        entity_name: client.name,
        description: `Agendou follow-up sugerido "${suggestion.actionText}" para ${followUpDateStr}`,
      })

      toast({
        title: 'Follow-up agendado com sucesso',
        description: `${suggestion.actionText} agendado para ${followUpDateStr.split('-').reverse().join('/')}.`,
      })

      // Oculta a sugestão deste estágio após agendar
      setDismissedSuggestionStage(stageForMapping)
      const refreshedActivities = await fetchClientInteractions(clientId)
      setActivities(refreshedActivities)
    } catch (err) {
      console.error('[ClientDetailDrawer] Falha ao agendar sugestão:', err)
      toast({
        title: 'Não foi possível registrar a automação',
        description: 'Ocorreu uma falha ao agendar o follow-up sugerido.',
        variant: 'destructive',
      })
    } finally {
      setIsSchedulingSuggestion(false)
    }
  }

  // Automação: Avançar estágio após ligação "Interessado"
  const handleAdvanceInterested = async () => {
    if (!interestedAdvanceStage || !clientId || !client) return
    setIsAdvancingInterested(true)
    try {
      await handleFunnelStageChange(interestedAdvanceStage)
      toast({
        title: 'Estágio avançado com sucesso',
        description: `Cliente avançado para ${interestedAdvanceStage}.`,
      })
      setInterestedAdvanceStage(null)
    } catch (err) {
      console.error('[ClientDetailDrawer] Erro ao avançar estágio:', err)
      toast({
        title: 'Não foi possível registrar a automação',
        description: 'Falha ao avançar estágio do cliente.',
        variant: 'destructive',
      })
    } finally {
      setIsAdvancingInterested(false)
    }
  }

  // Ações de contato externo (WhatsApp e E-mail)
  const handleOpenWhatsApp = () => {
    if (!client) return
    const rawPhone = client.telefone || client.contactPhone || ''
    const cleanPhone = rawPhone.replace(/\D/g, '')
    if (!cleanPhone) {
      toast({
        title: 'Telefone não cadastrado',
        description: 'O cliente não possui telefone válido para contato por WhatsApp.',
        variant: 'destructive',
      })
      return
    }
    const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    const msg = encodeURIComponent(`Olá, ${client.contactName || client.name}!`)
    window.open(`https://wa.me/${fullNumber}?text=${msg}`, '_blank', 'noopener,noreferrer')
  }

  const handleOpenEmail = () => {
    if (!client) return
    const email = client.contact_email || ''
    if (!email) {
      toast({
        title: 'E-mail não cadastrado',
        description: 'O cliente não possui e-mail cadastrado.',
        variant: 'destructive',
      })
      return
    }
    const subject = encodeURIComponent(`Contato comercial - ${client.name}`)
    window.open(`mailto:${email}?subject=${subject}`, '_self')
  }

  if (!open) return null

  // Segmento / Carteira do cliente
  const segment = client?.carteira || client?.sector || client?.grupo_cliente || 'Não informado'
  const phone = client?.telefone || client?.contactPhone || '—'
  const email = client?.contact_email || '—'
  const company = client?.name || 'Cliente'

  // Mapeamento da sugestão para o estágio atual
  const activeStageKey = (mode === 'funil' ? currentStage : currentStatus) || 'Lead'
  const currentSuggestion = getSuggestedActionForStage(activeStageKey)
  const showSuggestionCard =
    !loading &&
    !hasError &&
    !!client &&
    !!currentSuggestion &&
    dismissedSuggestionStage !== activeStageKey

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {/* Overlay transparente com backdrop suave para manter o funil visível */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Container: 40% largura em telas desktop, bottom sheet em mobile */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={cn(
          'relative z-50 flex flex-col bg-card text-card-foreground shadow-2xl border-l transition-all outline-none animate-in',
          // Desktop: 40% da tela deslizando da direita
          'w-full md:w-[40%] md:min-w-[420px] md:max-w-[640px] md:h-full md:slide-in-from-right',
          // Mobile (<768px): bottom sheet tela cheia com alça de arrasto
          'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:h-[92vh] max-md:rounded-t-2xl max-md:border-t max-md:slide-in-from-bottom',
        )}
      >
        {/* Mobile Drag Handle */}
        {isMobile && (
          <div className="pt-3 pb-1 flex justify-center shrink-0">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Header do Drawer */}
        <div className="p-4 sm:p-5 border-b flex items-start justify-between gap-3 shrink-0 bg-card/60 backdrop-blur-sm sticky top-0 z-20">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Status no funil:</span>
              <div className={mode === 'funil' ? 'w-56' : 'w-48'}>
                {mode === 'funil' ? (
                  <Select
                    value={currentStage}
                    onValueChange={(val) => handleFunnelStageChange(val)}
                    disabled={loading || hasError || isUpdatingStatus}
                  >
                    <SelectTrigger
                      className="h-8 text-xs font-semibold"
                      aria-label="Status no funil"
                    >
                      <SelectValue placeholder="Selecione o estágio" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNIL_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage} className="text-xs">
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={currentStatus}
                    onValueChange={(val) => handleFunnelStageChange(val)}
                    disabled={loading || hasError || isUpdatingStatus}
                  >
                    <SelectTrigger
                      className="h-8 text-xs font-semibold"
                      aria-label="Status no funil"
                    >
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_COLUMNS.map((status) => (
                        <SelectItem key={status} value={status} className="text-xs">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>

            <h2
              id={titleId}
              className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate"
            >
              {loading ? <Skeleton className="h-6 w-48 inline-block" /> : company}
            </h2>
            <p id={descriptionId} className="text-xs text-muted-foreground truncate">
              {loading ? (
                <Skeleton className="h-4 w-32 inline-block mt-1" />
              ) : (
                `${client?.city || ''}${client?.state ? ` - ${client.state}` : ''} • ${segment}`
              )}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full shrink-0"
            onClick={handleClose}
            aria-label="Fechar painel do cliente"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Corpo do Drawer com rolagem */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">
          {/* ESTADO 1: LOADING */}
          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Skeleton className="h-9 w-full rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            </div>
          )}

          {/* ESTADO 3: ERROR */}
          {!loading && hasError && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed rounded-xl space-y-3 bg-destructive/5">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-foreground">
                  Não foi possível carregar os dados do cliente
                </p>
                <p className="text-xs text-muted-foreground">
                  Ocorreu uma falha na conexão. Por favor, tente novamente.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={loadData} className="gap-2">
                <RotateCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
            </div>
          )}

          {/* ESTADO 4: SUCCESS */}
          {!loading && !hasError && client && (
            <div className="space-y-5 animate-fade-in">
              {/* Informações detalhadas do cliente */}
              <div className="rounded-xl border bg-card/60 p-4 shadow-sm space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Empresa / Razão Social
                    </span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      {client.name}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Segmento / Carteira
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                      <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                      {segment}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">Telefone</span>
                    <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                      {phone}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">E-mail</span>
                    <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                      {email}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Estágio atual no funil
                    </span>
                    <span className="font-medium text-foreground mt-0.5 inline-block">
                      <Badge variant="outline" className="text-[11px]">
                        {mode === 'funil'
                          ? client.funnelStage || currentStage
                          : client.funnelStage || currentStatus}
                      </Badge>
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Última interação
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {client.lastInteraction ? formatDateTime(client.lastInteraction) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Automação: Botão de Avanço de Estágio após ligação "Interessado" */}
              {interestedAdvanceStage && (
                <div
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 shadow-sm space-y-2 animate-in fade-in slide-in-from-top-1"
                  role="region"
                  aria-label="Avançar estágio do cliente"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Cliente interessado na conversa
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => setInterestedAdvanceStage(null)}
                      aria-label="Dispensar sugestão de avanço"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A conversa indicou interesse. Deseja avançar este cliente no funil?
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setInterestedAdvanceStage(null)}
                      disabled={isAdvancingInterested}
                    >
                      Depois
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleAdvanceInterested}
                      disabled={isAdvancingInterested}
                    >
                      {isAdvancingInterested ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="w-3.5 h-3.5" />
                      )}
                      Avançar para {interestedAdvanceStage}
                    </Button>
                  </div>
                </div>
              )}

              {/* Automação: Card "Próximo passo sugerido" */}
              {showSuggestionCard && currentSuggestion && (
                <div
                  className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 shadow-sm space-y-2 animate-in fade-in slide-in-from-top-1"
                  role="region"
                  aria-label="Próximo passo sugerido"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-2 w-2 rounded-full bg-primary" />
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Próximo passo sugerido
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground -mt-1 -mr-1"
                      onClick={() => setDismissedSuggestionStage(activeStageKey)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setDismissedSuggestionStage(activeStageKey)
                        }
                      }}
                      aria-label="Dispensar sugestão de próximo passo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <p className="text-xs text-foreground font-medium flex items-center gap-1.5">
                    {currentSuggestion.actionText}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Recomendado para o estágio{' '}
                    <strong className="font-semibold text-foreground">{activeStageKey}</strong>.
                  </p>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setDismissedSuggestionStage(activeStageKey)}
                      disabled={isSchedulingSuggestion}
                    >
                      Dispensar
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={handleScheduleSuggestion}
                      disabled={isSchedulingSuggestion}
                    >
                      {isSchedulingSuggestion ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CalendarIcon className="w-3.5 h-3.5" />
                      )}
                      Agendar
                    </Button>
                  </div>
                </div>
              )}

              {/* Seção de Ações Rápidas */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ações Rápidas
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={activeForm === 'call' ? 'default' : 'outline'}
                    onClick={() => setActiveForm(activeForm === 'call' ? 'none' : 'call')}
                    className="gap-1.5 text-xs h-9 justify-start"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    Registrar ligação
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenWhatsApp}
                    className="gap-1.5 text-xs h-9 justify-start text-emerald-600 hover:text-emerald-700"
                    title="Abrir WhatsApp com o telefone do cliente"
                  >
                    <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    Enviar WhatsApp
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenEmail}
                    className="gap-1.5 text-xs h-9 justify-start text-blue-600 hover:text-blue-700"
                    title="Enviar e-mail para o endereço do cliente"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    Enviar e-mail
                  </Button>

                  <Button
                    size="sm"
                    variant={activeForm === 'note' ? 'default' : 'outline'}
                    onClick={() => setActiveForm(activeForm === 'note' ? 'none' : 'note')}
                    className="gap-1.5 text-xs h-9 justify-start"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    Adicionar nota
                  </Button>

                  <Button
                    size="sm"
                    variant={activeForm === 'followup' ? 'default' : 'outline'}
                    onClick={() => setActiveForm(activeForm === 'followup' ? 'none' : 'followup')}
                    className="gap-1.5 text-xs h-9 justify-start sm:col-span-2"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                    Agendar follow-up
                  </Button>
                </div>

                {/* Sub-formulário inline: Registrar Ligação */}
                {activeForm === 'call' && (
                  <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-primary" /> Registrar Ligação
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setActiveForm('none')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <Label className="text-xs">Data da ligação</Label>
                        <Input
                          type="date"
                          value={callDate}
                          onChange={(e) => setCallDate(e.target.value)}
                          className="h-8 text-xs"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Resultado</Label>
                        <Select
                          value={callOutcome}
                          onValueChange={(val) => setCallOutcome(val as CallOutcome)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CALL_OUTCOMES.map((o) => (
                              <SelectItem key={o} value={o} className="text-xs">
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <Label className="text-xs">Resumo da conversa *</Label>
                      <Textarea
                        rows={2}
                        placeholder="Descreva brevemente os pontos abordados..."
                        value={callSummary}
                        onChange={(e) => {
                          setCallSummary(e.target.value)
                          if (callSummaryError && e.target.value.trim().length >= 3) {
                            setCallSummaryError('')
                          }
                        }}
                        disabled={isSubmitting}
                        className={cn(
                          'text-xs resize-none',
                          callSummaryError && 'border-destructive',
                        )}
                      />
                      {callSummaryError && (
                        <p className="text-[11px] text-destructive mt-0.5">{callSummaryError}</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveForm('none')}
                        disabled={isSubmitting}
                        className="h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveCall}
                        disabled={isSubmitting}
                        className="h-8 text-xs gap-1.5"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Salvar ligação
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sub-formulário inline: Adicionar Nota */}
                {activeForm === 'note' && (
                  <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" /> Adicionar Nota
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setActiveForm('none')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1 text-xs">
                      <Label className="text-xs">Nota *</Label>
                      <Textarea
                        rows={3}
                        placeholder="Escreva observações ou anotações sobre este cliente..."
                        value={noteText}
                        onChange={(e) => {
                          setNoteText(e.target.value)
                          if (noteError && e.target.value.trim().length >= 3) {
                            setNoteError('')
                          }
                        }}
                        disabled={isSubmitting}
                        className={cn('text-xs resize-none', noteError && 'border-destructive')}
                      />
                      {noteError && (
                        <p className="text-[11px] text-destructive mt-0.5">{noteError}</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveForm('none')}
                        disabled={isSubmitting}
                        className="h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNote}
                        disabled={isSubmitting}
                        className="h-8 text-xs gap-1.5"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Salvar nota
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sub-formulário inline: Agendar Follow-up */}
                {activeForm === 'followup' && (
                  <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-primary" /> Agendar Follow-up
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setActiveForm('none')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1 text-xs">
                      <Label className="text-xs">Data do follow-up *</Label>
                      <Input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="h-8 text-xs"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-1 text-xs">
                      <Label className="text-xs">Observação (opcional)</Label>
                      <Textarea
                        rows={2}
                        placeholder="Ex: Ligar para verificar decisão sobre proposta..."
                        value={followUpNote}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        disabled={isSubmitting}
                        className="text-xs resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveForm('none')}
                        disabled={isSubmitting}
                        className="h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveFollowUp}
                        disabled={isSubmitting}
                        className="h-8 text-xs gap-1.5"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Agendar follow-up
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Histórico Recente de Atividades (até 10 itens) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> Histórico Recente (
                    {activities.length})
                  </h3>
                </div>

                {/* ESTADO 2: EMPTY */}
                {activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed rounded-xl space-y-3 bg-muted/20">
                    <Clock className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Nenhuma atividade registrada ainda
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveForm('call')}
                      className="gap-1.5 text-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Registrar primeira atividade
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activities.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-lg border bg-card text-xs space-y-1 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-foreground leading-snug">
                            {act.action}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {formatDateTime(act.created)}
                          </span>
                        </div>

                        {act.details && (
                          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                            {act.details}
                          </p>
                        )}

                        {act.userName && (
                          <div className="text-[10px] text-muted-foreground pt-0.5">
                            Por: <span className="font-medium text-foreground">{act.userName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
