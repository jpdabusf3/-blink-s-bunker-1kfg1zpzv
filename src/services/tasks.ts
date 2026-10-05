import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import type { Task, TaskPriority, TaskType } from '@/types'

export interface TaskRecord {
  id: string
  user_id: string
  title: string
  description?: string
  due_date?: string
  status?: string
  priority?: string
  related_factory_id?: string
  created?: string
  updated?: string
}

export interface CreateTaskInput {
  user_id?: string
  title?: string
  description?: string
  due_date?: string
  dueDate?: string
  status?: string
  completed?: boolean
  priority?: TaskPriority | string
  related_factory_id?: string
  factoryId?: string
  type?: TaskType
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  due_date?: string
  dueDate?: string
  status?: string
  completed?: boolean
  priority?: TaskPriority | string
  related_factory_id?: string
  factoryId?: string
  type?: TaskType
}

/**
 * Converte um registro de tasks do PocketBase para a interface Task da aplicação.
 */
export function mapTaskRecord(r: any): Task {
  const isCompleted = r.status === 'concluida' || r.status === 'completed'
  const dueDateStr = r.due_date || r.dueDate || undefined
  const createdDate = r.created || new Date().toISOString()
  const rawPriority = r.priority || 'Média'
  const priority: TaskPriority =
    rawPriority === 'High' || rawPriority === 'Alta'
      ? 'Alta'
      : rawPriority === 'Low' || rawPriority === 'Baixa'
        ? 'Baixa'
        : 'Média'

  // Decodificar tipo se embutido ou fallback
  let taskType: TaskType = 'Outra'
  let cleanDesc = r.description || r.title || ''
  if (r.type && ['Enviar amostra', 'Ligar para Follow-up', 'Outra'].includes(r.type)) {
    taskType = r.type as TaskType
  } else if (cleanDesc.startsWith('[') && cleanDesc.includes(']')) {
    const endIdx = cleanDesc.indexOf(']')
    const candidateType = cleanDesc.substring(1, endIdx)
    if (['Enviar amostra', 'Ligar para Follow-up', 'Outra'].includes(candidateType)) {
      taskType = candidateType as TaskType
      cleanDesc = cleanDesc.substring(endIdx + 1).trim()
    }
  }

  const factoryId = r.related_factory_id || r.factoryId || ''

  return {
    id: r.id,
    user_id: r.user_id || undefined,
    title: r.title || cleanDesc || 'Tarefa sem título',
    factoryId,
    related_factory_id: factoryId,
    description: cleanDesc || r.title || '',
    type: taskType,
    dueDate: dueDateStr,
    due_date: dueDateStr,
    completed: isCompleted,
    status: r.status || (isCompleted ? 'concluida' : 'pendente'),
    priority,
    createdAt: createdDate,
    created: r.created,
    updated: r.updated,
  }
}

/**
 * Lista todas as tarefas cadastradas na collection tasks.
 */
export async function listTasks(): Promise<Task[]> {
  try {
    const records = await pb.collection('tasks').getFullList({
      sort: '-created',
      requestKey: null,
    })
    return records.map(mapTaskRecord)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Não foi possível listar as tarefas: ${msg}`)
  }
}

/**
 * Cria uma nova tarefa no PocketBase.
 */
export async function createTask(data: CreateTaskInput): Promise<Task> {
  try {
    const authId = pb.authStore.record?.id
    const finalUserId = data.user_id || authId
    if (!finalUserId) {
      throw new Error('Usuário autenticado não encontrado para vincular à tarefa.')
    }

    const title = (data.title || data.description || 'Nova Tarefa').trim()
    const description = (data.description || data.title || '').trim()
    const factoryId = data.related_factory_id || data.factoryId || null
    const dueDate = data.due_date || data.dueDate || null

    let status = data.status
    if (status === undefined) {
      status = data.completed ? 'concluida' : 'pendente'
    }

    const priority = data.priority || 'Média'

    // Se houver um tipo (ex: 'Enviar amostra'), codificamos no formato [Tipo] no description se útil
    let formattedDesc = description
    if (data.type && !description.startsWith(`[${data.type}]`)) {
      formattedDesc = `[${data.type}] ${description}`
    }

    const payload: Record<string, unknown> = {
      user_id: finalUserId,
      title: title || 'Tarefa sem título',
      description: formattedDesc,
      due_date: dueDate,
      status,
      priority,
      related_factory_id: factoryId,
    }

    const created = await pb.collection('tasks').create(payload)
    notifyDataChanged('tasks')
    return mapTaskRecord(created)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao cadastrar tarefa: ${msg}`)
  }
}

/**
 * Atualiza uma tarefa existente no PocketBase.
 */
export async function updateTask(id: string, data: UpdateTaskInput): Promise<Task> {
  try {
    const payload: Record<string, unknown> = {}

    if (data.title !== undefined) payload.title = data.title.trim()
    if (data.description !== undefined) {
      let desc = data.description.trim()
      if (data.type && !desc.startsWith(`[${data.type}]`)) {
        desc = `[${data.type}] ${desc}`
      }
      payload.description = desc
    }
    if (data.related_factory_id !== undefined || data.factoryId !== undefined) {
      payload.related_factory_id = data.related_factory_id || data.factoryId || null
    }

    const dueDate = data.due_date ?? data.dueDate
    if (dueDate !== undefined) {
      payload.due_date = dueDate || null
    }

    if (data.status !== undefined) {
      payload.status = data.status
    } else if (data.completed !== undefined) {
      payload.status = data.completed ? 'concluida' : 'pendente'
    }

    if (data.priority !== undefined) {
      payload.priority = data.priority
    }

    const updated = await pb.collection('tasks').update(id, payload)
    notifyDataChanged('tasks')
    return mapTaskRecord(updated)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao atualizar tarefa: ${msg}`)
  }
}

/**
 * Remove uma tarefa do PocketBase.
 */
export async function removeTask(id: string): Promise<boolean> {
  try {
    await pb.collection('tasks').delete(id)
    notifyDataChanged('tasks')
    return true
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao excluir tarefa: ${msg}`)
  }
}

/**
 * Exporta padrão com list, create, update, remove
 */
export const tasksService = {
  list: listTasks,
  create: createTask,
  update: updateTask,
  remove: removeTask,
}
