import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import { normalizeSellerName } from '@/lib/vendedorFilterHelper'
import type { Factory } from '@/types'

export type CallOutcome = 'Sem resposta' | 'Interessado' | 'Reagendou' | 'Não interessou'

export interface ClientInteractionActivity {
  id: string
  action: string
  details?: string
  tipo?: 'status' | 'acao' | 'nota' | 'proximo_passo' | 'outro' | string
  origem?: string
  created: string
  userName?: string
  sourceCollection: 'activity_logs' | 'atividades' | 'deal_activities' | 'agenda_tasks'
}

export interface ClientInteractionData {
  client: Factory
  activities: ClientInteractionActivity[]
}

/**
 * Busca histórico unificado de interações do cliente (até 10 itens, mais recentes primeiro).
 * Combina activity_logs (recordId = clientId), deal_activities (deal_id = clientId) e atividades (cliente_id = clientId).
 */
export async function fetchClientInteractions(
  clientId: string,
): Promise<ClientInteractionActivity[]> {
  const [logsResult, dealActsResult, ativsResult] = await Promise.allSettled([
    pb.collection('activity_logs').getList(1, 20, {
      filter: `recordId = "${clientId}"`,
      sort: '-created',
      expand: 'user',
    }),
    pb.collection('deal_activities').getList(1, 20, {
      filter: `deal_id = "${clientId}"`,
      sort: '-created',
      expand: 'user_id',
    }),
    pb.collection('atividades').getList(1, 20, {
      filter: `cliente_id = "${clientId}"`,
      sort: '-created',
      expand: 'vendedor_id',
    }),
  ])

  const unified: ClientInteractionActivity[] = []

  if (logsResult.status === 'fulfilled' && logsResult.value?.items) {
    for (const item of logsResult.value.items) {
      const u = item.expand?.user as { name?: string; email?: string } | undefined
      unified.push({
        id: `log-${item.id}`,
        action: item.action || 'Atividade registrada',
        details: item.details || item.proximo_passo || '',
        tipo: item.tipo || 'acao',
        origem: item.origem || 'funil_vendas',
        created: item.created,
        userName: normalizeSellerName(u?.name || u?.email || ''),
        sourceCollection: 'activity_logs',
      })
    }
  }

  if (dealActsResult.status === 'fulfilled' && dealActsResult.value?.items) {
    for (const item of dealActsResult.value.items) {
      const u = item.expand?.user_id as { name?: string; email?: string } | undefined
      // Evita duplicar se já houver um activity_log com o mesmo action gravado no mesmo minuto
      const isDuplicate = unified.some(
        (uLog) =>
          uLog.action === item.activity_text &&
          Math.abs(new Date(uLog.created).getTime() - new Date(item.created).getTime()) < 60_000,
      )
      if (!isDuplicate) {
        unified.push({
          id: `deal-${item.id}`,
          action: item.activity_text || 'Atividade do negócio',
          details: '',
          tipo: 'acao',
          origem: 'funil_vendas',
          created: item.created,
          userName: normalizeSellerName(u?.name || u?.email || ''),
          sourceCollection: 'deal_activities',
        })
      }
    }
  }

  if (ativsResult.status === 'fulfilled' && ativsResult.value?.items) {
    for (const item of ativsResult.value.items) {
      const u = item.expand?.vendedor_id as { name?: string; email?: string } | undefined
      unified.push({
        id: `ativ-${item.id}`,
        action: item.descricao || `Atividade: ${item.tipo_atividade || 'comercial'}`,
        details: item.proximo_passo ? `Próximo passo: ${item.proximo_passo}` : '',
        tipo: 'acao',
        origem: item.origem || 'manual',
        created: item.created,
        userName: normalizeSellerName(u?.name || u?.email || ''),
        sourceCollection: 'atividades',
      })
    }
  }

  // Ordena por data decrescente e pega até 10 itens
  unified.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  return unified.slice(0, 10)
}

/**
 * Registra ligação telefônica vinculada ao cliente:
 * - Cria registro em activity_logs
 * - Cria registro em deal_activities
 * - Atualiza lastInteraction do cliente em factories
 * - Dispara notifyDataChanged para as coleções afetadas
 */
export async function registerCallInteraction(params: {
  clientId: string
  clientName: string
  summary: string
  outcome: CallOutcome
  dateStr?: string // YYYY-MM-DD
  userId?: string
  origem?: string
}): Promise<void> {
  const currentUserId = params.userId || pb.authStore.record?.id
  const actionText = `Ligação (${params.outcome}): ${params.summary.trim()}`
  const nowIso = params.dateStr
    ? new Date(`${params.dateStr}T12:00:00Z`).toISOString()
    : new Date().toISOString()

  // 1. Grava no activity_logs
  await pb.collection('activity_logs').create({
    user: currentUserId || null,
    action: actionText,
    details: `Resultado: ${params.outcome}. Resumo: ${params.summary.trim()}`,
    recordId: params.clientId,
    target_collection: 'factories',
    tipo: 'acao',
    origem: params.origem || 'funil_vendas',
  })

  // 2. Grava no deal_activities
  try {
    await pb.collection('deal_activities').create({
      deal_id: params.clientId,
      user_id: currentUserId || null,
      activity_text: actionText,
      created_at: nowIso,
    })
  } catch (err) {
    console.warn('[registerCallInteraction] Falha ao gravar em deal_activities:', err)
  }

  // 3. Atualiza lastInteraction no cliente
  try {
    await pb.collection('factories').update(params.clientId, {
      lastInteraction: nowIso,
    })
  } catch (err) {
    console.warn('[registerCallInteraction] Falha ao atualizar lastInteraction:', err)
  }

  notifyDataChanged('activity_logs')
  notifyDataChanged('deal_activities')
  notifyDataChanged('factories')
}

/**
 * Adiciona nota rápida vinculada ao cliente:
 * - Cria registro em activity_logs
 * - Cria registro em deal_activities
 * - Atualiza lastInteraction do cliente
 * - Dispara notifyDataChanged
 */
export async function addNoteInteraction(params: {
  clientId: string
  clientName: string
  note: string
  userId?: string
  origem?: string
}): Promise<void> {
  const currentUserId = params.userId || pb.authStore.record?.id
  const actionText = `Nota: ${params.note.trim()}`
  const nowIso = new Date().toISOString()

  // 1. Grava no activity_logs
  await pb.collection('activity_logs').create({
    user: currentUserId || null,
    action: actionText,
    details: params.note.trim(),
    recordId: params.clientId,
    target_collection: 'factories',
    tipo: 'nota',
    origem: params.origem || 'funil_vendas',
  })

  // 2. Grava no deal_activities
  try {
    await pb.collection('deal_activities').create({
      deal_id: params.clientId,
      user_id: currentUserId || null,
      activity_text: actionText,
      created_at: nowIso,
    })
  } catch (err) {
    console.warn('[addNoteInteraction] Falha ao gravar deal_activities:', err)
  }

  // 3. Atualiza lastInteraction no cliente
  try {
    await pb.collection('factories').update(params.clientId, {
      lastInteraction: nowIso,
    })
  } catch (err) {
    console.warn('[addNoteInteraction] Falha ao atualizar lastInteraction:', err)
  }

  notifyDataChanged('activity_logs')
  notifyDataChanged('deal_activities')
  notifyDataChanged('factories')
}

/**
 * Agenda follow-up vinculado ao cliente:
 * - Cria registro na collection agenda_tasks (task_type = 'outro' com título e notas de follow-up)
 * - Cria espelho em activity_logs e deal_activities
 * - Dispara notifyDataChanged
 */
export async function scheduleFollowUpInteraction(params: {
  clientId: string
  clientName: string
  followUpDate: string // YYYY-MM-DD
  note?: string
  userId?: string
  origem?: string
}): Promise<void> {
  const currentUserId = params.userId || pb.authStore.record?.id
  if (!currentUserId) {
    throw new Error('Usuário não autenticado')
  }

  const cleanNote = params.note?.trim() || ''
  const title = `Follow-up com ${params.clientName}`
  const dateFormatted = params.followUpDate.split('-').reverse().join('/')

  // 1. Grava em agenda_tasks
  await pb.collection('agenda_tasks').create({
    user_id: currentUserId,
    title,
    task_type: 'outro',
    client_name: params.clientName,
    deal_id: params.clientId,
    task_date: params.followUpDate.includes(' ')
      ? params.followUpDate
      : `${params.followUpDate} 09:00:00`,
    start_time: '09:00',
    end_time: '09:30',
    status: 'agendada',
    notes: cleanNote ? `Follow-up: ${cleanNote}` : 'Follow-up agendado',
  })

  // 2. Grava log de atividade
  const actionText = `Follow-up agendado para ${dateFormatted}${cleanNote ? `: ${cleanNote}` : ''}`
  try {
    await pb.collection('activity_logs').create({
      user: currentUserId,
      action: actionText,
      details: cleanNote,
      recordId: params.clientId,
      target_collection: 'factories',
      tipo: 'proximo_passo',
      proximo_passo: `Follow-up em ${dateFormatted}`,
      origem: params.origem || 'funil_vendas',
    })
  } catch (err) {
    console.warn('[scheduleFollowUpInteraction] Falha ao gravar activity_logs:', err)
  }

  try {
    await pb.collection('deal_activities').create({
      deal_id: params.clientId,
      user_id: currentUserId,
      activity_text: actionText,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[scheduleFollowUpInteraction] Falha ao gravar deal_activities:', err)
  }

  notifyDataChanged('agenda_tasks')
  notifyDataChanged('activity_logs')
  notifyDataChanged('deal_activities')
}
