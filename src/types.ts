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

export type Sector =
  | 'Aves'
  | 'Suínos'
  | 'PET'
  | 'Aqua'
  | 'Bovinos de Corte'
  | 'Bovinos de Leite'
  | 'Bovinos em Geral'
  | 'Equinos'
  | 'Monogástricos'
  | 'Ruminantes'
  | 'Multiespécie'

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

export interface Order {
  id: string
  factoryId: string
  product: string
  quantity: number
  unitValue: number
  totalValue: number
  orderDate: string
}

export interface Factory {
  id: string
  name: string
  city: string
  region: Region
  sector?: Sector
  productLineAffinity?: ProductLine
  capacity: number
  potentialValue: number
  status: Status
  lastInteraction: string
  contactName: string
  contactPhone: string
  operationTypes: string
  productInterests: string
  funnelStage: FunnelStage
  winProbability: number
  deadline?: string
  documents?: Document[]
  scoreHistory?: ScoreHistory[]
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
