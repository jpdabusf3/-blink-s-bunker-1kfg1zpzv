// Pontos de referência fixos da Blink Bioscience
// Coordenadas geocodificadas e validadas via OpenStreetMap / Nominatim:
// 1. Centro de Distribuição (Maringá/PR): Av. Melvin Jones, Parque Industrial Bandeirantes -> lat: -23.42836, lng: -51.97895
// 2. Fábrica (Hernandarias, Paraguai): Supercarretera Itaipú -> lat: -25.41485, lng: -54.61351
// 3. Matriz (Indaiatuba/SP): Rua André Adolfo Ferrari, 107 -> lat: -23.13782, lng: -47.23181
// 4. Escritório (São Paulo/SP): Rua Verbo Divino, 2001 - Torre B -> lat: -23.63102, lng: -46.71338

export interface BlinkLocation {
  id: string
  name: string
  subtitle: string
  type: 'cd' | 'fabrica' | 'matriz' | 'escritorio'
  lat: number
  lng: number
  addressText: string
  phone?: string
}

export const BLINK_MARINGA_CD: BlinkLocation = {
  id: 'blink-cd-maringa',
  name: 'Centro de Distribuição (CD) — Maringá/PR',
  subtitle: 'BIOSCIENCE BRASIL LTDA',
  type: 'cd',
  lat: -23.42836,
  lng: -51.97895,
  addressText:
    'BIOSCIENCE BRASIL LTDA. Avenida Melvim Jones, 440 - Lte 211 - Parque Industrial Bandeirantes, Maringa - PR, CEP: 87.070-030.',
  phone: '19996315979',
}

export const BLINK_LOCATIONS: BlinkLocation[] = [
  BLINK_MARINGA_CD,
  {
    id: 'blink-fabrica-py',
    name: 'FÁBRICA — Paraguai',
    subtitle: 'Blink Bioscience S.A.',
    type: 'fabrica',
    lat: -25.41485,
    lng: -54.61351,
    addressText:
      'Blink Bioscience S.A. — Supercarretera, 60, ciudad Hernandarias, Departamento de Alto Paraná, Paraguay',
  },
  {
    id: 'blink-matriz-indaiatuba',
    name: 'ESCRITÓRIO MATRIZ — Indaiatuba/SP',
    subtitle: 'INDAIATUBA MATRIZ',
    type: 'matriz',
    lat: -23.13782,
    lng: -47.23181,
    addressText:
      'INDAIATUBA MATRIZ — R. André Adolfo Ferrari, 107, Zona Industrial – Nova Era, Indaiatuba / SP',
  },
  {
    id: 'blink-escritorio-sp',
    name: 'ESCRITÓRIO — São Paulo/SP',
    subtitle: 'ESCRITÓRIO - SÃO PAULO',
    type: 'escritorio',
    lat: -23.63102,
    lng: -46.71338,
    addressText:
      'ESCRITÓRIO - SÃO PAULO — Rua Verbo Divino 2001 - Torre B - cj 404, Vila Cruzeiro, São Paulo / SP',
  },
]
