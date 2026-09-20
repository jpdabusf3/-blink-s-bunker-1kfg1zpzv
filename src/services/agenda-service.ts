import pb from '@/lib/pocketbase/client'

export type AgendaTaskType = 'reuniao' | 'visita' | 'evento' | 'ligacao' | 'outro'
export type AgendaTaskStatus = 'agendada' | 'concluida' | 'cancelada'

export interface DealOption {
  id: string
  name: string
  city?: string
  state?: string
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
        fields: 'id,name,city,state',
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

    return pb.collection('agenda_tasks').create<AgendaTask>(payload, {
      expand: 'deal_id',
    })
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

    return pb.collection('agenda_tasks').update<AgendaTask>(id, payload, {
      expand: 'deal_id',
    })
  },

  /**
   * Atualiza status da tarefa (ex: agendada -> concluida / cancelada)
   */
  async updateStatus(id: string, status: AgendaTaskStatus): Promise<AgendaTask> {
    return pb.collection('agenda_tasks').update<AgendaTask>(
      id,
      { status },
      {
        expand: 'deal_id',
      },
    )
  },

  /**
   * Exclui tarefa
   */
  async deleteTask(id: string): Promise<boolean> {
    return pb.collection('agenda_tasks').delete(id)
  },
}
