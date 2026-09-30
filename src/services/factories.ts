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

// Allowed values for strict single-select fields in PocketBase 'factories' collection
const ALLOWED_SELECT_VALUES: Record<string, readonly string[]> = {
  carteira: ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'],
  tipo: ['Cliente', 'Prospecto'],
  status_funil: ['Inativo', 'Mensal', 'Ativo'],
  stateRegion: [
    'Sul',
    'Norte',
    'Oeste',
    'Leste',
    'Nordeste',
    'Noroeste',
    'Sudeste',
    'Sudoeste',
    'Centro',
  ],
  ultima_edicao_origem: ['manual', 'audio', 'excel'],
  region: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'],
  status_contato: ['Champion', 'Stakeholder', 'Decisor', 'Influenciador', 'Gatekeepers'],
  geocode_precision: ['exact', 'street', 'city', 'failed'],
  address_status: ['complete', 'partial', 'inconsistent', 'enriched', 'failed'],
  salesChannel: ['Direct', 'Indirect'],
  indirectChannelType: [
    'Representantes',
    'Distribuidores',
    'Revendas',
    'Cooperativas',
    'Indústrias',
  ],
}

// Relation fields pointing to other collections (users, gestao_tecnica)
const RELATION_FIELDS = new Set([
  'vendedor_id',
  'gestor_tecnico_id',
  'salesOwner',
  'technicalManager',
])

// Fields that may be sent as arrays or multi-selects in the app
const MULTI_SELECT_FIELDS = new Set([
  'profile_type',
  'animalSpecies',
  'productLineAffinity',
  'region',
  'status',
  'priority',
])

export function toPBData(data: Partial<Factory>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const [key, rawValue] of Object.entries(data)) {
    if (PB_EXCLUDED.includes(key)) continue
    if (rawValue === undefined) continue

    // 1. Relations: "" or "none" must be sent as null so PocketBase clears the relation without 400
    if (RELATION_FIELDS.has(key)) {
      if (rawValue === '' || rawValue === 'none' || rawValue === null) {
        result[key] = null
      } else {
        result[key] = String(rawValue).trim()
      }
      continue
    }

    // 2. Strict Selects: "" or "none" or unlisted value must be null
    if (key in ALLOWED_SELECT_VALUES) {
      if (rawValue === '' || rawValue === 'none' || rawValue === null) {
        result[key] = null
        continue
      }
      const strVal = String(rawValue).trim()
      const allowed = ALLOWED_SELECT_VALUES[key]
      const match = allowed.find((v) => v.toLowerCase() === strVal.toLowerCase())
      result[key] = match ? match : null
      continue
    }

    // 3. Multiselects: clean array of non-empty strings (no '', no 'none')
    if (MULTI_SELECT_FIELDS.has(key)) {
      if (Array.isArray(rawValue)) {
        const cleaned = rawValue
          .map((v) => (typeof v === 'string' ? v.trim() : String(v).trim()))
          .filter((v) => v !== '' && v.toLowerCase() !== 'none')
        result[key] = cleaned
      } else if (rawValue === '' || rawValue === 'none' || rawValue === null) {
        result[key] = []
      } else if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim()
        result[key] = trimmed && trimmed.toLowerCase() !== 'none' ? [trimmed] : []
      } else {
        result[key] = rawValue
      }
      continue
    }

    // Default handling for other fields
    result[key] = rawValue
  }

  return result
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
    telefone: record.telefone || record.contactPhone,
    observacoes: record.observacoes || record.notes,
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
