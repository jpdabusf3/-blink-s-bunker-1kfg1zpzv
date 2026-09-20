import pb from '@/lib/pocketbase/client'

export interface DealActivity {
  id: string
  deal_id: string
  user_id?: string
  activity_text: string
  created_at?: string
  created: string
  updated: string
  expand?: {
    user_id?: {
      id: string
      name: string
      email: string
    }
    deal_id?: {
      id: string
      name: string
    }
  }
}

/**
 * Cria um registro em deal_activities e espelha em activity_logs para que apareça
 * tanto na nova tabela quanto no ClientHistoryDialog existente.
 */
export async function recordDealActivity(params: {
  dealId: string
  activityText: string
  userId?: string
}): Promise<void> {
  const currentUserId = params.userId || pb.authStore.record?.id
  const nowIso = new Date().toISOString()

  // 1. Grava na collection deal_activities
  try {
    await pb.collection('deal_activities').create({
      deal_id: params.dealId,
      user_id: currentUserId || null,
      activity_text: params.activityText,
      created_at: nowIso,
    })
  } catch (err) {
    console.error('Falha ao gravar em deal_activities:', err)
  }

  // 2. Grava também em activity_logs para manter retrocompatibilidade com o histórico do cliente
  try {
    await pb.collection('activity_logs').create({
      user: currentUserId || null,
      action: params.activityText,
      details: '',
      recordId: params.dealId,
      target_collection: 'factories',
      tipo: 'acao',
      origem: 'agenda',
    })
  } catch (err) {
    console.error('Falha ao gravar em activity_logs:', err)
  }
}

/**
 * Retorna as atividades registradas de um negócio
 */
export async function getDealActivities(dealId: string): Promise<DealActivity[]> {
  try {
    return await pb.collection('deal_activities').getFullList<DealActivity>({
      filter: `deal_id = "${dealId}"`,
      sort: '-created',
      expand: 'user_id',
    })
  } catch (err) {
    console.warn('Erro ao buscar deal_activities:', err)
    return []
  }
}
