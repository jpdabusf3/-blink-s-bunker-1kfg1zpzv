import pb from '@/lib/pocketbase/client'
import type { Factory } from '@/types'

const PB_EXCLUDED = [
  'swot',
  'matrix',
  'scoreHistory',
  'documents',
  'coordinates',
  'salesOwnerName',
  'technicalManagerName',
  'deadline',
]

function toPBData(data: Partial<Factory>): Record<string, any> {
  return Object.fromEntries(Object.entries(data).filter(([k]) => !PB_EXCLUDED.includes(k)))
}

function mapRecordToFactory(record: any): Factory {
  return {
    id: record.id,
    name: record.name || '',
    city: record.city || '',
    state: record.state || '',
    stateRegion: record.stateRegion,
    region: record.region || 'Norte',
    sector: record.sector || '',
    specialty: record.specialty,
    animalSpecies: record.animalSpecies,
    productLineAffinity: record.productLineAffinity,
    capacity: record.capacity || 0,
    potentialValue: record.potentialValue || 0,
    status: record.status || 'Prospeção',
    priority: record.priority || 'Medium',
    focusLevel: record.focusLevel || 3,
    lastInteraction: record.lastInteraction || new Date().toISOString(),
    contactName: record.contactName || '',
    contactPhone: record.contactPhone || '',
    operationTypes: record.operationTypes || '',
    productInterests: record.productInterests || '',
    funnelStage: record.funnelStage || 'Lead',
    winProbability: record.winProbability || 10,
    salesChannel: record.salesChannel,
    indirectChannelType: record.indirectChannelType,
    country: record.country || 'Brasil',
    address: record.address,
    profile_type: record.profile_type,
    notes: record.notes,
    suggested_approach: record.suggested_approach,
    contact_email: record.contact_email,
    salesOwner: record.salesOwner,
    salesOwnerName: record.expand?.salesOwner?.name || '',
    technicalManager: record.technicalManager,
    technicalManagerName: record.expand?.technicalManager?.name || '',
    ultima_edicao_origem: record.ultima_edicao_origem,
    created: record.created,
    swot: {
      strengths: '',
      weaknesses: '',
      opportunities: '',
      threats: '',
      generalAttractiveness: 50,
    },
    matrix: {
      financial: 5,
      technical: 5,
      fit: 5,
      openness: 5,
      competition: 5,
      urgency: 5,
      roi: 5,
    },
    scoreHistory: [{ date: record.created || new Date().toISOString(), score: 50 }],
  }
}

export async function getAllFactories(): Promise<Factory[]> {
  const records = await pb.collection('factories').getFullList({
    sort: '-created',
    expand: 'salesOwner,technicalManager',
  })
  return records.map(mapRecordToFactory)
}

export async function updateFactoryPB(id: string, data: Partial<Factory>) {
  return pb.collection('factories').update(id, toPBData(data) as any)
}

export async function createFactoryPB(data: Partial<Factory>) {
  return pb.collection('factories').create(toPBData(data) as any)
}

export async function deleteFactoryPB(id: string) {
  return pb.collection('factories').delete(id)
}
