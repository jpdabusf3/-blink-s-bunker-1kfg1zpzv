import pb from '@/lib/pocketbase/client'

export interface DashboardPreferences {
  id: string
  userId: string
  blocks: string[]
  period_view?: string
  created: string
  updated: string
}

export const DEFAULT_DASHBOARD_BLOCKS = [
  'metrics',
  'executive',
  'consolidated',
  'targets',
  'role-widgets',
  'maps',
  'distribution',
  'charts',
  'historical',
  'list',
  'gestor-comparison',
]

export async function getDashboardPreferences(): Promise<DashboardPreferences | null> {
  try {
    const list = await pb.collection('dashboard_preferences').getList<DashboardPreferences>(1, 1, {
      filter: `userId = "${pb.authStore.record?.id}"`,
    })
    return list.items[0] || null
  } catch {
    return null
  }
}

export async function saveDashboardPreferences(
  blocks: string[],
  periodView?: string,
): Promise<void> {
  const existing = await getDashboardPreferences()
  const data: Record<string, unknown> = { blocks }
  if (periodView !== undefined) data.period_view = periodView
  if (existing) {
    await pb.collection('dashboard_preferences').update(existing.id, data)
  } else {
    await pb.collection('dashboard_preferences').create({
      userId: pb.authStore.record?.id,
      ...data,
    })
  }
}

export async function savePeriodView(periodView: string): Promise<void> {
  const existing = await getDashboardPreferences()
  if (existing) {
    await pb.collection('dashboard_preferences').update(existing.id, { period_view: periodView })
  } else {
    await pb.collection('dashboard_preferences').create({
      userId: pb.authStore.record?.id,
      blocks: DEFAULT_DASHBOARD_BLOCKS,
      period_view: periodView,
    })
  }
}
