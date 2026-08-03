import pb from '@/lib/pocketbase/client'
import type { Factory } from '@/types'

const PB_EXCLUDED = [
  'swot',
  'matrix',
  'scoreHistory',
  'documents',
  'coordinates',
  'salesOwnerName',
  'deadline',
]

function toPBData(data: Partial<Factory>): Record<string, any> {
  return Object.fromEntries(Object.entries(data).filter(([k]) => !PB_EXCLUDED.includes(k)))
}

export async function updateFactoryPB(id: string, data: Partial<Factory>) {
  return pb.collection('factories').update(id, toPBData(data) as any)
}

export async function createFactoryPB(data: Partial<Factory>) {
  return pb.collection('factories').create(toPBData(data) as any)
}
