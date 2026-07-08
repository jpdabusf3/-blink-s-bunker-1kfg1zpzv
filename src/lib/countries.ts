export interface CountryOption {
  name: string
  regions: string[] | null
}

export const COUNTRIES: CountryOption[] = [
  { name: 'Brasil', regions: ['Norte', 'Nordeste', 'Sudeste', 'Centro-Oeste', 'Sul'] },
  { name: 'Argentina', regions: ['Norte', 'Litoral', 'Cuyo', 'Centro', 'Sur', 'Buenos Aires'] },
  { name: 'Uruguai', regions: ['Norte', 'Litoral', 'Centro', 'Sur'] },
  { name: 'Paraguai', regions: ['Norte', 'Sur', 'Este', 'Oeste', 'Centro'] },
  { name: 'Chile', regions: ['Norte Grande', 'Norte Chico', 'Centro', 'Sur', 'Austral'] },
  { name: 'Colômbia', regions: ['Caribe', 'Pacífica', 'Andina', 'Orinoquía', 'Amazonía'] },
  { name: 'Peru', regions: ['Norte', 'Centro', 'Sur', 'Oriente', 'Lima'] },
  { name: 'Bolívia', regions: ['Altiplano', 'Valles', 'Trópico', 'Chaco', 'Oriente'] },
  { name: 'Equador', regions: ['Costa', 'Sierra', 'Oriente', 'Galápagos'] },
  {
    name: 'Venezuela',
    regions: ['Capital', 'Central', 'Occidental', 'Llanos', 'Guayana', 'Insular'],
  },
  { name: 'México', regions: ['Norte', 'Centro-Norte', 'Bajío', 'Centro-Sur', 'Sureste'] },
  { name: 'Estados Unidos', regions: null },
  { name: 'Canadá', regions: null },
  { name: 'Panamá', regions: null },
  { name: 'Costa Rica', regions: null },
  { name: 'Guatemala', regions: null },
  { name: 'Outro', regions: null },
]
