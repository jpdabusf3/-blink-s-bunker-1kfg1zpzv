export const COUNTRY_TO_CONTINENT: Record<string, string> = {
  Brasil: 'América do Sul',
  Argentina: 'América do Sul',
  Uruguai: 'América do Sul',
  Paraguai: 'América do Sul',
  Chile: 'América do Sul',
  Colômbia: 'América do Sul',
  Peru: 'América do Sul',
  Bolívia: 'América do Sul',
  Equador: 'América do Sul',
  Venezuela: 'América do Sul',
  México: 'América do Norte',
  'Estados Unidos': 'América do Norte',
  Canadá: 'América do Norte',
  Panamá: 'América Central',
  'Costa Rica': 'América Central',
  Guatemala: 'América Central',
}

export function getContinent(country: string): string {
  return COUNTRY_TO_CONTINENT[country] || 'Outro'
}
