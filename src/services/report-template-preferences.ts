import pb from '@/lib/pocketbase/client'
import type { ReportTemplateKey } from '@/lib/reportTemplates'
import { DEFAULT_REPORT_TEMPLATE } from '@/lib/reportTemplates'

/** Dashboard preferences extended with the persisted visual-report model. */
export interface DashboardPreferences {
  id: string
  userId: string
  blocks: string[]
  period_view?: string
  modelo_visual_relatorio?: string
  created: string
  updated: string
}

/**
 * Load the user's persisted "Modelo Visual" report preference.
 * Falls back to the default template when nothing is stored.
 */
export async function getReportTemplatePreference(): Promise<ReportTemplateKey> {
  try {
    const list = await pb.collection('dashboard_preferences').getList<DashboardPreferences>(1, 1, {
      filter: `userId = "${pb.authStore.record?.id}"`,
    })
    const pref = list.items[0]?.modelo_visual_relatorio
    if (pref === 'executivo' || pref === 'tecnico' || pref === 'comercial') return pref
    return DEFAULT_REPORT_TEMPLATE
  } catch {
    return DEFAULT_REPORT_TEMPLATE
  }
}

/**
 * Persist the user's chosen "Modelo Visual" report template, creating the
 * dashboard_preferences record if it does not exist yet.
 */
export async function saveReportTemplatePreference(modelo: ReportTemplateKey): Promise<void> {
  const userId = pb.authStore.record?.id
  if (!userId) return
  let existing: DashboardPreferences | null = null
  try {
    const list = await pb.collection('dashboard_preferences').getList<DashboardPreferences>(1, 1, {
      filter: `userId = "${userId}"`,
    })
    existing = list.items[0] || null
  } catch {
    existing = null
  }
  if (existing) {
    await pb.collection('dashboard_preferences').update(existing.id, {
      modelo_visual_relatorio: modelo,
    })
  } else {
    await pb.collection('dashboard_preferences').create({
      userId,
      blocks: [],
      modelo_visual_relatorio: modelo,
    })
  }
}
