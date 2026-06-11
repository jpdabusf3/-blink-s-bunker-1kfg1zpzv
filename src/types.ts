export type Region = 'Norte' | 'Sul' | 'Leste' | 'Oeste' | 'Médio-Norte'
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

export interface Factory {
  id: string
  name: string
  city: string
  region: Region
  sector?: string
  productLineAffinity?: ProductLine
  capacity: number
  potentialValue: number
  status: Status
  priority?: Priority
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
}
