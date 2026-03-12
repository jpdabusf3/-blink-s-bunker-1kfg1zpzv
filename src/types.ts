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

export interface Document {
  id: string
  name: string
  url: string
  size: number
  uploadedAt: string
}

export interface Factory {
  id: string
  name: string
  city: string
  region: Region
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
