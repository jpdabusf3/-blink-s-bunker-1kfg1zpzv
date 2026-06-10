import { Factory, Order, Task, Region, Priority, Visit } from '@/types'

const today = new Date()
const getDates = () =>
  Array.from({ length: 6 }).map((_, i) =>
    new Date(today.getTime() - (5 - i) * 30 * 86400000).toISOString(),
  )

const scoreTrends = [
  getDates().map((d, i) => ({ date: d, score: 50 + i * 5 })),
  getDates().map((d, i) => ({ date: d, score: 60 + i * 2 })),
  getDates().map((d, i) => ({ date: d, score: 40 + i * 8 })),
  getDates().map((d, i) => ({ date: d, score: 30 + i * 3 })),
  getDates().map((d, i) => ({ date: d, score: 70 + i * 4 })),
]

const rawData: Array<[string, number | string, string, string, Priority]> = [
  ['Adames', 3, 'Pontes e Lacerda', 'Ruminantes', 'Medium'],
  ['AGRO ZOO NUTRIÇÃO ANIMAL', 3, 'Juscimeira', 'Ruminantes', 'Medium'],
  ['Agroceres Multimix', 1, 'Rondonópolis', 'Ruminantes', 'Low'],
  ['Agronortena', 5, 'Sinop, Mato Grosso', 'Ruminantes', 'High'],
  ['AgroPantanal', 1, 'Poconé', 'Ruminantes, Pet', 'Low'],
  ['Agrovale', 1, 'Nova Marilândia', 'Ruminantes', 'Low'],
  ['AgroVida', 1, 'Primavera do Leste', 'Ruminantes', 'Low'],
  ['Big Sal', 1, 'Nova Mutum', 'Ruminantes', 'Low'],
  ['COPERPHÓS NUTRIÇÃO ANIMAL', 3, 'Rondonópolis', 'Ruminantes', 'Medium'],
  ['Fortuna Nutrição Animal', 5, 'Nova Canaã, Bahia', 'Ruminantes', 'High'],
  ['Fortuna Nutripontes', 5, 'Pontes e Lacerda', 'Ruminantes', 'High'],
  ['Fortuna Sansão', 5, 'Castanheira, Mato Grosso', 'Ruminantes', 'High'],
  ['GP - COMERCIO DE CEREAIS E NUTRICAO ANIMAL', 1, 'Alta Floresta', '', 'Low'],
  ['Ideal Pork/Excelencia', 4, 'Nova Mutum', 'Ruminantes', 'High'],
  ['Kodyak Nutrição Animal', 1, 'Lucas do Rio Verde', 'Ruminantes', 'Low'],
  ['Multitrato', 5, 'Matupá', 'Ruminantes', 'High'],
  ['Neonutra nutrição e saúde animal', 3, 'Cuiabá', 'Ruminantes', 'Medium'],
  ['Nutrali', 3, 'Sinop, Mato Grosso', 'Ruminantes', 'Medium'],
  ['Nutribarra', 3, 'Barra do Bugres', 'Ruminantes', 'Medium'],
  ['Nutribio', 5, 'Sinop, Mato Grosso', 'Ruminantes', 'High'],
  ['Nutribras', 4, 'Cuiabá', 'Aves/Suínos, Pet', 'High'],
  ['Nutrideal', 5, 'Cuiabá', 'Ruminantes', 'High'],
  ['NutriMARQUES', 3, "Mirassol d'Oeste", 'Ruminantes', 'Medium'],
  ['GRANJA ZIANE', 3, 'Tangará da Serra', 'Ruminantes', 'Medium'],
  ['Nutrinorte', 5, 'Nova Santa Helena', 'Ruminantes', 'High'],
  ['OVOS TANGARÁ', 3, 'Tangará da Serra', 'Aves/Suínos', 'Medium'],
  ['NutriBase', 5, 'Rondonópolis', 'Ruminantes', 'High'],
  ['NutriVig - Nutrição Animal', 3, 'Sapezal', 'Muitiespecies', 'Medium'],
  ['Planutre', 5, 'Várzea Grande, Mato Grosso', 'Ruminantes', 'High'],
  ['Rações Bom Tempo', 3, 'Cáceres, Mato Grosso', 'Ruminantes', 'Medium'],
  ['Rações Centro', 3, 'Diamantino', '', 'Medium'],
  ['Rações Sorriso', 5, 'Sorriso', 'Ruminantes', 'High'],
  ['Radar Mix Nutrição Animal', 3, 'Tangará da Serra', 'Ruminantes', 'Medium'],
  ['Rebanho', 5, 'São José dos Quatro Marcos', 'Ruminantes', 'High'],
  ['Rico', 3, 'Cuiabá', 'Ruminantes', 'Medium'],
  ['Sansal', 3, 'Barra do Bugres', 'Ruminantes', 'Medium'],
  ['Zootec Nutrição Animal', 5, 'Rondonópolis', '', 'High'],
  ['SUPREMAX /GRA |ZOOTEC', 5, 'Tangará da Serra', 'Ruminantes', 'High'],
  ['VIDAN NUTRICAO ANIMAL', 1, 'Várzea Grande, Mato Grosso', '', 'Low'],
  ['Nelore Nutrição Animal', 3, 'Colíder', '', 'Medium'],
  ['MJ Nutrição Animal', 3, 'Rondonópolis', '', 'Medium'],
  ['Nutripura', 5, 'Rondonópolis', '', 'High'],
  ['Arojo', 5, 'Pontes e Lacerda', '', 'High'],
  ['Nutrivale', 1, 'Pontes e Lacerda', '', 'Low'],
  ['Dorum', 1, 'Alta Floresta', '', 'Low'],
  ['Matsuda', 3, 'Cuiabá', '', 'Medium'],
  ['Sal Gado', 5, 'Alta Floresta', '', 'High'],
  ['Qualinutri', 'Cliente', 'Juara', 'Ruminantes', 'High'],
  ['VB Alimentos', 2, 'Jaciara', 'PET', 'Low'],
  ['CONFRESA NUTRIÇÃO ANIMAL', 3, 'Confresa', 'Ruminantes', 'Medium'],
  ['Nutrix Pet Food', 5, 'Nova Marilândia', 'PET', 'High'],
  ['Marombi', 5, 'Sorriso', 'Aves', 'High'],
]

const getRegionCoords = (region: string, i: number) => {
  const bases = {
    Norte: { lat: -11.0, lng: -55.0 },
    Sul: { lat: -16.0, lng: -54.0 },
    'Médio-Norte': { lat: -13.5, lng: -56.0 },
    Oeste: { lat: -15.0, lng: -58.0 },
    Leste: { lat: -14.0, lng: -52.0 },
  }
  const base = bases[region as keyof typeof bases] || bases['Norte']
  return {
    lat: base.lat + ((i % 10) - 5) * 0.2,
    lng: base.lng + ((i % 8) - 4) * 0.2,
  }
}

function getRegionForCity(city: string): Region {
  const c = city.toLowerCase()
  if (
    c.includes('sinop') ||
    c.includes('alta floresta') ||
    c.includes('matupá') ||
    c.includes('colíder') ||
    c.includes('juara') ||
    c.includes('castanheira') ||
    c.includes('santa helena')
  )
    return 'Norte'
  if (
    c.includes('rondonópolis') ||
    c.includes('juscimeira') ||
    c.includes('jaciara') ||
    c.includes('cuiabá') ||
    c.includes('várzea grande') ||
    c.includes('poconé')
  )
    return 'Sul'
  if (
    c.includes('tangará') ||
    c.includes('barra do bugres') ||
    c.includes('nova mutum') ||
    c.includes('lucas') ||
    c.includes('sorriso') ||
    c.includes('diamantino') ||
    c.includes('nova marilândia')
  )
    return 'Médio-Norte'
  if (
    c.includes('pontes e lacerda') ||
    c.includes('cáceres') ||
    c.includes('mirassol') ||
    c.includes('são josé') ||
    c.includes('sapezal')
  )
    return 'Oeste'
  if (c.includes('primavera') || c.includes('confresa') || c.includes('canaã')) return 'Leste'
  return 'Norte'
}

export const mockFactories: Factory[] = rawData.map((row, index) => {
  const id = (index + 1).toString()
  const name = row[0]
  const focusLevel = row[1]
  const city = row[2]
  const sector = row[3] || 'Geral'
  const priority = row[4]
  const region = getRegionForCity(city)
  const isClient = focusLevel === 'Cliente'

  return {
    id,
    name,
    focusLevel,
    city,
    sector,
    priority,
    region,
    productLineAffinity: 'Adsorventes',
    capacity: Math.floor(Math.random() * 10000) + 1000,
    potentialValue: 0,
    status: isClient ? 'Atendido' : 'Prospeção',
    lastInteraction: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    funnelStage: isClient ? 'Fechamento' : 'Lead',
    winProbability: priority === 'High' ? 80 : priority === 'Medium' ? 50 : 20,
    contactName: 'Contato ' + name.split(' ')[0],
    contactPhone: '65 9999-0000',
    operationTypes: 'Ração',
    productInterests: sector,
    documents: [],
    scoreHistory: scoreTrends[index % 5],
    coordinates: getRegionCoords(region, index),
    swot: {
      strengths: '',
      weaknesses: '',
      opportunities: '',
      threats: '',
      generalAttractiveness: priority === 'High' ? 90 : priority === 'Medium' ? 60 : 30,
    },
    matrix: {
      financial: priority === 'High' ? 9 : 5,
      technical: priority === 'High' ? 8 : 5,
      fit: priority === 'High' ? 9 : 5,
      openness: 5,
      competition: 5,
      urgency: 5,
      roi: priority === 'High' ? 8 : 5,
    },
  }
})

export const mockOrders: Order[] = [
  {
    id: 'o1',
    factoryId: '4', // Agronortena
    product: 'Blink Minerais+',
    quantity: 50,
    unitValue: 120,
    totalValue: 6000,
    orderDate: new Date(today.getTime() - 10 * 86400000).toISOString(),
  },
  {
    id: 'o2',
    factoryId: '4',
    product: 'Blink Enzimas',
    quantity: 20,
    unitValue: 300,
    totalValue: 6000,
    orderDate: new Date(today.getTime() - 40 * 86400000).toISOString(),
  },
  {
    id: 'o3',
    factoryId: '48', // Qualinutri
    product: 'Blink Prebio',
    quantity: 100,
    unitValue: 80,
    totalValue: 8000,
    orderDate: new Date(today.getTime() - 5 * 86400000).toISOString(),
  },
]

export const mockTasks: Task[] = [
  {
    id: 't1',
    factoryId: '1', // Adames
    description: 'Enviar kit de amostras de adsorventes',
    type: 'Enviar amostra',
    priority: 'Alta',
    completed: false,
    dueDate: new Date(today.getTime() + 2 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 't2',
    factoryId: '48', // Qualinutri
    description: 'Confirmar recebimento da minuta',
    type: 'Ligar para Follow-up',
    priority: 'Média',
    completed: true,
    dueDate: new Date(today.getTime() - 1 * 86400000).toISOString(),
    createdAt: new Date(today.getTime() - 3 * 86400000).toISOString(),
  },
]
