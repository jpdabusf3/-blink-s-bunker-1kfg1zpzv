import pb from '@/lib/pocketbase/client'

export interface ExcelTemplate {
  id: string
  name: string
  charts_config: any
  isActive: boolean
}

export async function getActiveTemplate(): Promise<ExcelTemplate | null> {
  try {
    const templates = await pb.collection('excel_templates').getFullList({
      filter: 'isActive = true',
    })
    if (templates.length === 0) return null
    const t = templates[0]
    return {
      id: t.id,
      name: t.name || '',
      charts_config: t.charts_config,
      isActive: true,
    }
  } catch {
    return null
  }
}
