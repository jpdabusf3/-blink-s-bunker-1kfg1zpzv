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
  'gestor_tecnico_name',
  'deadline',
]

function toPBData(data: Partial<Factory>): Record<string, any> {
  return Object.fromEntries(Object.entries(data).filter(([k]) => !PB_EXCLUDED.includes(k)))
}

export function mapRecordToFactory(record: any): Factory {
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
    gestor_tecnico_id: record.gestor_tecnico_id,
    gestor_tecnico_name:
      record.expand?.gestor_tecnico?.nome || record.expand?.gestor_tecnico_id?.nome || '',
    vendedor_id: record.vendedor_id,
    vendedor_name:
      record.vendedor_name ||
      record.expand?.vendedor?.nome ||
      record.expand?.vendedor_id?.nome ||
      '',
    ultima_edicao_origem: record.ultima_edicao_origem,
    carteira: record.carteira,
    grupo_cliente: record.grupo_cliente,
    status_funil: record.status_funil,
    valor_medio: record.valor_medio || 0,
    valor_atual: record.valor_atual || 0,
    ultimo_pedido: record.ultimo_pedido,
    proximos_passos: record.proximos_passos,
    acao: record.acao,
    data_importacao: record.data_importacao,
    contato: record.contato,
    status_contato: record.status_contato,
    cnpj: record.cnpj,
    lat: typeof record.lat === 'number' ? record.lat : record.lat ? Number(record.lat) : undefined,
    lng: typeof record.lng === 'number' ? record.lng : record.lng ? Number(record.lng) : undefined,
    geocode_precision: record.geocode_precision,
    address_status: record.address_status,
    enriched_at: record.enriched_at,
    standardized_address: record.standardized_address,
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

export async function getFactoryById(id: string): Promise<Factory | null> {
  try {
    const record = await pb.collection('factories').getOne(id, {
      expand:
        'salesOwner,salesOwner.gestao_tecnica_id,technicalManager,gestor_tecnico,vendedor,gestor_tecnico_id,vendedor_id',
    })
    return mapRecordToFactory(record)
  } catch {
    return null
  }
}

export async function getAllFactories(): Promise<Factory[]> {
  const records = await pb.collection('factories').getFullList({
    sort: '-created',
    expand:
      'salesOwner,salesOwner.gestao_tecnica_id,technicalManager,gestor_tecnico,vendedor,gestor_tecnico_id,vendedor_id',
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
