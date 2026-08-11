export type Region = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul'
export type Status = 'Atendido' | 'Não atendido' | 'Prospeção'
export type FunnelStage =
  | 'Lead'
  | 'Primeiro Contato'
  | 'Diagnóstico Técnico'
  | 'Apresentação'
  | 'Teste/Trial'
  | 'Proposta'
  | 'Negociação'
  | 'Fechamento'
  | 'Pós-venda'
  | 'Perda'

export type Priority = 'High' | 'Medium' | 'Low'

export type ProductLine =
  | 'Adsorventes'
  | 'Prebióticos'
  | 'Minerais Orgânicos'
  | 'Blends'
  | 'Ingredientes'

export interface Document {
  id: string
  name: string
  url: string
  size: number
  uploadedAt: string
}

export interface ScoreHistory {
  date: string
  score: number
}

export interface AppNotification {
  id: string
  userId: string
  title: string
  message: string
  type: 'success' | 'warning' | 'info' | 'error'
  isRead: boolean
  targetId?: string
  milestone?: string
  region?: string
  created: string
  updated: string
}

export interface Target {
  id: string
  name: string
  targetValue: number
  categoryType: 'General' | 'Region' | 'Channel' | 'ProductLine'
  categoryValue: string
  startDate: string
  endDate: string
  created: string
  updated: string
}

export interface Order {
  id: string
  factoryId: string
  country?: string
  product: string
  line?: ProductLine | string
  quantity: number
  unitValue: number
  totalValue: number
  orderDate: string
}

export type TaskType = 'Enviar amostra' | 'Ligar para Follow-up' | 'Outra'
export type TaskPriority = 'Baixa' | 'Média' | 'Alta'

export interface Task {
  id: string
  factoryId: string
  description: string
  type: TaskType
  dueDate?: string
  completed: boolean
  priority: TaskPriority
  createdAt: string
}

export interface Visit {
  id: string
  factoryId: string
  date: string
  summary: string
  potentialValue: number
}

export interface ActivityLog {
  id: string
  user: string
  action: string
  details: string
  recordId?: string
  collectionName?: string
  target_collection?: string
  created: string
  updated: string
  expand?: {
    user?: {
      id: string
      name: string
      email: string
      job_title: string
      geographicArea: string
      country: string
    }
  }
}

export interface Factory {
  id: string
  name: string
  city: string
  country?: string
  region: Region | Region[] | string | string[]
  sector?: string
  specialty?: string
  animalSpecies?:
    | 'Ruminantes'
    | 'Aves'
    | 'Suinos'
    | 'Pet'
    | 'Aqua'
    | 'Equinos'
    | 'Outros'
    | 'Multi espécie'
    | string
    | string[]
  productLineAffinity?: ProductLine | ProductLine[] | string | string[]
  capacity: number
  potentialValue: number
  status: Status | Status[] | string | string[]
  priority?: Priority | Priority[] | string | string[]
  focusLevel?: number | string
  lastInteraction: string
  contactName: string
  contactPhone: string
  operationTypes: string
  productInterests: string
  funnelStage: FunnelStage
  winProbability: number
  deadline?: string
  state?: string
  stateRegion?:
    | 'Sul'
    | 'Norte'
    | 'Oeste'
    | 'Leste'
    | 'Nordeste'
    | 'Noroeste'
    | 'Sudeste'
    | 'Sudoeste'
    | 'Centro'
  salesChannel?: 'Direct' | 'Indirect'
  indirectChannelType?:
    | 'Representantes'
    | 'Distribuidores'
    | 'Revendas'
    | 'Cooperativas'
    | 'Indústrias'
  documents?: Document[]
  scoreHistory?: ScoreHistory[]
  coordinates?: {
    lat: number
    lng: number
  }
  swot: {
    strengths: string
    weaknesses: string
    opportunities: string
    threats: string
    generalAttractiveness: number
  }
  matrix: {
    financial: number
    technical: number
    fit: number
    openness: number
    competition: number
    urgency: number
    roi: number
  }
  profile_type?:
    | 'Indústria'
    | 'Cooperativa'
    | 'Integradora'
    | 'Premixeira'
    | 'Produtores'
    | 'Outros'
    | 'Distribuidor'
    | string
  salesOwner?: string
  salesOwnerName?: string
  technicalManager?: string
  technicalManagerName?: string
  created?: string
  notes?: string
  suggested_approach?: string
  contact_email?: string
  address?: string
  ultima_edicao_origem?: 'manual' | 'audio' | 'excel'
  carteira?: string
  grupo_cliente?: string
  gestor_tecnico_id?: string
  gestor_tecnico_name?: string
  vendedor_id?: string
  vendedor_name?: string
  status_funil?: 'Inativo' | 'Mensal' | 'Ativo'
  valor_medio?: number
  valor_atual?: number
  ultimo_pedido?: string
  proximos_passos?: string
  acao?: string
  data_importacao?: string
}

export interface GestaoTecnica {
  id: string
  nome: string
  funcao: 'gestor_tecnico' | 'vendedor'
  regiao: string
  carteira?: string
  ativo: boolean
  created: string
  updated: string
}

export interface Atividade {
  id: string
  cliente_id: string
  vendedor_id: string
  tipo_atividade: string
  etapa_funil: string
  valor_estimado: number
  descricao: string
  proximo_passo: string
  data_proxima_acao: string
  pendencias: string
  origem: 'audio' | 'manual' | 'excel'
  audio_transcrito: string
  confianca: number
  carteira?: string
  grupo_cliente?: string
  created: string
  updated: string
  expand?: {
    cliente_id?: { id: string; name: string; city: string; state: string }
    vendedor_id?: { id: string; name: string }
  }
}
