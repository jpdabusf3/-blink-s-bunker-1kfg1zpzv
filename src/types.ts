export type Region =
  | 'Norte'
  | 'Nordeste'
  | 'Centro-Oeste'
  | 'Sudeste'
  | 'Sul'
  | 'Médio-Norte'
  | 'Oeste'
  | 'Leste'
  | 'Noroeste'
  | 'Sudoeste'
  | 'Centro'
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
  context_type?: string
  context_id?: string
  context_link?: string
  created: string
  updated: string
}

export type ChatContextType =
  | 'cliente'
  | 'pedido'
  | 'funil'
  | 'funil-vendas'
  | 'faturamento'
  | 'relatorio-vendas'
  | 'resumo'
  | 'mapa'
  | 'produtos'
  | 'equipe'
  | 'usuarios'
  | 'outro'

export interface ChatContextPayload {
  context_type?: ChatContextType | string
  context_id?: string
  context_titulo?: string
  context_link?: string
  context_extra?: Record<string, unknown>
}

export interface ChatConversa {
  id: string
  tipo: 'direta' | 'grupo'
  titulo?: string
  participantes?: string[]
  criador_id?: string
  ultima_mensagem_texto?: string
  ultima_mensagem_data?: string
  context_type?: string
  context_id?: string
  context_titulo?: string
  context_link?: string
  created: string
  updated: string
  expand?: {
    participantes?: Array<{
      id: string
      name?: string
      email?: string
      avatar?: string
      job_title?: string
    }>
    criador_id?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
  }
}

export interface ChatMensagem {
  id: string
  conversa_id: string
  autor_id: string
  autor_nome?: string
  texto: string
  context_type?: string
  context_id?: string
  context_titulo?: string
  context_link?: string
  context_extra?: Record<string, unknown>
  created: string
  updated: string
  isReadByMe?: boolean
  readCount?: number
  expand?: {
    autor_id?: {
      id: string
      name?: string
      email?: string
      avatar?: string
      job_title?: string
    }
  }
}

export interface ChatLeituraMensagem {
  id: string
  mensagem_id: string
  conversa_id: string
  user_id: string
  lida_em: string
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
  user_id?: string
  client_name?: string
  factoryId: string
  country?: string
  product: string
  line?: ProductLine | string
  quantity: number
  unitValue: number
  totalValue: number
  orderDate: string
  status?: string
  notes?: string
  unit_value?: number
  total_value?: number
  order_date?: string
  created?: string
  updated?: string
}

export type TaskType = 'Enviar amostra' | 'Ligar para Follow-up' | 'Outra'
export type TaskPriority = 'Baixa' | 'Média' | 'Alta'

export interface Task {
  id: string
  user_id?: string
  title?: string
  factoryId: string
  related_factory_id?: string
  description: string
  type: TaskType
  dueDate?: string
  due_date?: string
  completed: boolean
  status?: string
  priority: TaskPriority
  createdAt: string
  created?: string
  updated?: string
}

export interface Visit {
  id: string
  user_id?: string
  factoryId: string
  factory_id?: string
  date: string
  visit_date?: string
  summary: string
  notes?: string
  potentialValue: number
  potential_value?: number
  outcome?: string
  created?: string
  updated?: string
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
  lat?: number
  lng?: number
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
  contato?: string
  status_contato?: 'Champion' | 'Stakeholder' | 'Decisor' | 'Influenciador' | 'Gatekeepers'
  cnpj?: string
  telefone?: string
  observacoes?: string
  geocode_precision?: 'exact' | 'street' | 'city' | 'state' | 'failed' | string
  address_status?: 'complete' | 'partial' | 'inconsistent' | 'enriched' | 'failed' | string
  isApproximateCity?: boolean
  isApproximateState?: boolean
  locationFallbackPrecision?: 'exact' | 'street' | 'city' | 'state'
  enriched_at?: string
  standardized_address?: string
  latitude?: number
  longitude?: number
  precisao?: 'exata' | 'rua' | 'bairro' | 'cidade' | 'sem-localizacao'
  cep?: string
  logradouro?: string
  numero?: string
  bairro?: string
  complemento?: string
  updated?: string
  expand?: {
    gestor_tecnico_id?: { id: string; nome: string }
    vendedor_id?: { id: string; nome: string }
    [key: string]: any
  }
}

export type GestaoFuncao =
  | 'gestor_tecnico'
  | 'vendedor'
  | 'gestor_comercial'
  | 'gestor_especie'
  | 'diretor'
  | 'ceo'

export interface GestaoTecnica {
  id: string
  nome: string
  funcao: GestaoFuncao
  regiao: string
  carteira?: string
  ativo: boolean
  subclassificacao?: 'indiretos' | 'diretos' | string
  canal_vendas?: 'indireto' | 'direto' | string
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
  relatorio_pdf?: string
  created: string
  updated: string
  expand?: {
    cliente_id?: { id: string; name: string; city: string; state: string }
    vendedor_id?: { id: string; name: string }
  }
}

export type PlanoStatus = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'

export interface PlanoAcao {
  id: string
  descricao: string
  data_prevista?: string
  status: PlanoStatus
  cliente?: string
  vendedor?: string
  atividade_origem?: string
  origem?: 'audio' | 'manual' | 'excel' | string
  created: string
  updated: string
  expand?: {
    cliente?: { id: string; name: string }
    vendedor?: { id: string; name: string }
    atividade_origem?: { id: string; descricao: string }
  }
}
