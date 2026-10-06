import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export type AgendaTaskType = 'reuniao' | 'visita' | 'evento' | 'ligacao' | 'outro'
export type AgendaTaskStatus = 'agendada' | 'concluida' | 'cancelada'

export interface DealOption {
  id: string
  name: string
  city?: string
  state?: string
  funnelStage?: string
}

export interface AgendaTask {
  id: string
  user_id: string
  title: string
  task_type: AgendaTaskType
  client_name?: string
  deal_id?: string
  task_date: string // YYYY-MM-DD or ISO string
  start_time?: string // HH:mm
  end_time?: string // HH:mm
  status: AgendaTaskStatus
  notes?: string
  created: string
  updated: string
  expand?: {
    deal_id?: {
      id: string
      name: string
      funnelStage?: string
      city?: string
      state?: string
    }
  }
}

export interface AgendaTaskInput {
  title: string
  task_type: AgendaTaskType
  client_name?: string
  deal_id?: string
  task_date: string
  start_time?: string
  end_time?: string
  status?: AgendaTaskStatus
  notes?: string
}

export const TASK_TYPE_LABELS: Record<AgendaTaskType, string> = {
  reuniao: 'Reunião',
  visita: 'Visita',
  evento: 'Evento',
  ligacao: 'Ligação',
  outro: 'Outro',
}

export const TASK_STATUS_LABELS: Record<AgendaTaskStatus, string> = {
  agendada: 'Agendada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

/**
 * Nomes amigáveis em português para montagem de textos de atividades (Regra 5).
 * reuniao -> Reunião
 * visita -> Visita
 * evento -> Evento
 * ligacao -> Ligação
 * outro -> Tarefa
 */
export const TASK_TYPE_ACTIVITY_NAMES: Record<AgendaTaskType, string> = {
  reuniao: 'Reunião',
  visita: 'Visita',
  evento: 'Evento',
  ligacao: 'Ligação',
  outro: 'Tarefa',
}

/** Formata data para o padrão DD/MM/YYYY */
export function formatBRDateOnly(dateStr?: string): string {
  if (!dateStr) return ''
  const clean = dateStr.split(' ')[0].split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

/**
 * Ordem canônica das etapas do funil de vendas (stages de factories).
 */
export const FUNNEL_STAGES_ORDER: string[] = [
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
]

/**
 * Retorna a próxima etapa do funil com base na etapa atual.
 * Se já for a última etapa ou Perda, retorna null.
 */
export function getNextFunnelStage(currentStage?: string | null): string | null {
  if (!currentStage) return FUNNEL_STAGES_ORDER[0]
  const idx = FUNNEL_STAGES_ORDER.indexOf(currentStage)
  if (idx === -1) {
    // Se não encontrada, assume que pode começar em Lead
    return FUNNEL_STAGES_ORDER[0]
  }
  if (idx >= FUNNEL_STAGES_ORDER.length - 1) {
    return null // Já na última etapa
  }
  return FUNNEL_STAGES_ORDER[idx + 1]
}

/**
 * Verifica se o estágio atual é o último do funil.
 */
export function isLastFunnelStage(currentStage?: string | null): boolean {
  if (!currentStage) return false
  const idx = FUNNEL_STAGES_ORDER.indexOf(currentStage)
  return idx !== -1 && idx >= FUNNEL_STAGES_ORDER.length - 1
}

/**
 * Gera texto de atividade para criação de tarefa (Regra 5)
 * Ex: "Reunião agendada: [título da tarefa] em [data]"
 */
export function buildActivityTextCreated(
  taskType: AgendaTaskType,
  title: string,
  taskDate: string,
): string {
  const typeName = TASK_TYPE_ACTIVITY_NAMES[taskType] || 'Tarefa'
  const dateFormatted = formatBRDateOnly(taskDate)
  return `${typeName} agendada: ${title} em ${dateFormatted}`
}

/**
 * Gera texto de atividade para conclusão de tarefa (Regra 5)
 * Ex: "Visita concluída: [título da tarefa]"
 */
export function buildActivityTextCompleted(taskType: AgendaTaskType, title: string): string {
  const typeName = TASK_TYPE_ACTIVITY_NAMES[taskType] || 'Tarefa'
  return `${typeName} concluída: ${title}`
}

/**
 * Gera texto de atividade para cancelamento de tarefa (Regra 5)
 * Ex: "Tarefa cancelada: [título da tarefa]"
 */
export function buildActivityTextCancelled(taskType: AgendaTaskType, title: string): string {
  const typeName = TASK_TYPE_ACTIVITY_NAMES[taskType] || 'Tarefa'
  return `${typeName} cancelada: ${title}`
}

export const agendaService = {
  /**
   * Lista tarefas para um intervalo de datas (ex: semana inteira)
   */
  async listTasks(startDateStr?: string, endDateStr?: string): Promise<AgendaTask[]> {
    const filters: string[] = []

    if (startDateStr && endDateStr) {
      // task_date >= startDateStr and task_date <= endDateStr
      // Format should compare date strings safely
      filters.push(
        `task_date >= "${startDateStr} 00:00:00" && task_date <= "${endDateStr} 23:59:59"`,
      )
    } else if (startDateStr) {
      filters.push(`task_date >= "${startDateStr} 00:00:00"`)
    }

    const filter = filters.length > 0 ? filters.join(' && ') : ''

    return pb.collection('agenda_tasks').getFullList<AgendaTask>({
      filter: filter || undefined,
      sort: 'task_date,start_time,created',
      expand: 'deal_id',
    })
  },

  /**
   * Lista todas as tarefas do usuário autenticado
   */
  async getAllTasks(): Promise<AgendaTask[]> {
    return pb.collection('agenda_tasks').getFullList<AgendaTask>({
      sort: 'task_date,start_time,created',
      expand: 'deal_id',
    })
  },

  /**
   * Busca clientes/deals para select no formulário
   */
  async listDeals(): Promise<DealOption[]> {
    try {
      const records = await pb.collection('factories').getFullList<DealOption>({
        filter: 'is_deleted != true',
        fields: 'id,name,city,state,funnelStage',
        sort: 'name',
      })
      return records
    } catch (e) {
      console.warn('Erro ao carregar factories para deals:', e)
      return []
    }
  },

  /**
   * Cria nova tarefa
   */
  async createTask(input: AgendaTaskInput): Promise<AgendaTask> {
    const currentUserId = pb.authStore.record?.id
    if (!currentUserId) {
      throw new Error('Usuário não autenticado')
    }

    const payload: Record<string, any> = {
      user_id: currentUserId,
      title: input.title.trim(),
      task_type: input.task_type,
      client_name: input.client_name?.trim() || '',
      deal_id: input.deal_id || null,
      task_date: input.task_date.includes(' ') ? input.task_date : `${input.task_date} 00:00:00`,
      start_time: input.start_time?.trim() || '',
      end_time: input.end_time?.trim() || '',
      status: input.status || 'agendada',
      notes: input.notes?.trim() || '',
    }

    const created = await pb.collection('agenda_tasks').create<AgendaTask>(payload, {
      expand: 'deal_id',
    })
    notifyDataChanged('agenda_tasks')
    return created
  },

  /**
   * Atualiza tarefa existente
   */
  async updateTask(id: string, input: Partial<AgendaTaskInput>): Promise<AgendaTask> {
    const payload: Record<string, any> = {}

    if (input.title !== undefined) payload.title = input.title.trim()
    if (input.task_type !== undefined) payload.task_type = input.task_type
    if (input.client_name !== undefined) payload.client_name = input.client_name?.trim() || ''
    if (input.deal_id !== undefined) payload.deal_id = input.deal_id || null
    if (input.task_date !== undefined) {
      payload.task_date = input.task_date.includes(' ')
        ? input.task_date
        : `${input.task_date} 00:00:00`
    }
    if (input.start_time !== undefined) payload.start_time = input.start_time?.trim() || ''
    if (input.end_time !== undefined) payload.end_time = input.end_time?.trim() || ''
    if (input.status !== undefined) payload.status = input.status
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || ''

    const updated = await pb.collection('agenda_tasks').update<AgendaTask>(id, payload, {
      expand: 'deal_id',
    })
    notifyDataChanged('agenda_tasks')
    return updated
  },

  /**
   * Atualiza status da tarefa (ex: agendada -> concluida / cancelada)
   */
  async updateStatus(id: string, status: AgendaTaskStatus): Promise<AgendaTask> {
    const updated = await pb.collection('agenda_tasks').update<AgendaTask>(
      id,
      { status },
      {
        expand: 'deal_id',
      },
    )
    notifyDataChanged('agenda_tasks')
    return updated
  },

  /**
   * Exclui tarefa
   */
  async deleteTask(id: string): Promise<boolean> {
    const res = await pb.collection('agenda_tasks').delete(id)
    notifyDataChanged('agenda_tasks')
    return res
  },
}
