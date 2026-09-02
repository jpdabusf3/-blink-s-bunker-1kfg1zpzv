/**
 * Catálogo padrão de 40 produtos Blink Biotech para seleção rápida em NFs manuais e automáticas.
 */

export interface BlinkProductItem {
  codigo: string
  nome: string
  label: string
}

export const BLINK_CATALOG_PRODUCTS: BlinkProductItem[] = [
  { codigo: 'BBMO.BE001', nome: 'Blink Mos SC', label: 'BBMO.BE001 — Blink Mos SC' },
  { codigo: 'BBMO.BE003', nome: 'Blink BetaLink SC', label: 'BBMO.BE003 — Blink BetaLink SC' },
  { codigo: 'BBMY.CO001', nome: 'Blink Mycolink SC', label: 'BBMY.CO001 — Blink Mycolink SC' },
  { codigo: 'BBMY.CO003', nome: 'Blink Mycolink P SC', label: 'BBMY.CO003 — Blink Mycolink P SC' },
  { codigo: 'BBMY.CO005', nome: 'Blink Mycolink S SC', label: 'BBMY.CO005 — Blink Mycolink S SC' },
  { codigo: 'BPMI.OR001', nome: 'Blink Calcium 17 SC', label: 'BPMI.OR001 — Blink Calcium 17 SC' },
  { codigo: 'BPMI.OR003', nome: 'Blink Calcium 22 SC', label: 'BPMI.OR003 — Blink Calcium 22 SC' },
  {
    codigo: 'BPMI.OR005',
    nome: 'Blink Chromium 10 SC',
    label: 'BPMI.OR005 — Blink Chromium 10 SC',
  },
  {
    codigo: 'BPMI.OR007',
    nome: 'Blink Chromium 20 SC',
    label: 'BPMI.OR007 — Blink Chromium 20 SC',
  },
  { codigo: 'BPMI.OR009', nome: 'Blink Cobalt 10 SC', label: 'BPMI.OR009 — Blink Cobalt 10 SC' },
  { codigo: 'BPMI.OR013', nome: 'Blink Copper 17 SC', label: 'BPMI.OR013 — Blink Copper 17 SC' },
  { codigo: 'BPMI.OR015', nome: 'Blink Copper 22 SC', label: 'BPMI.OR015 — Blink Copper 22 SC' },
  { codigo: 'BPMI.OR017', nome: 'Blink Iron 17 SC', label: 'BPMI.OR017 — Blink Iron 17 SC' },
  { codigo: 'BPMI.OR019', nome: 'Blink Iron 22 SC', label: 'BPMI.OR019 — Blink Iron 22 SC' },
  {
    codigo: 'BPMI.OR021',
    nome: 'Blink Magnesium 10 SC',
    label: 'BPMI.OR021 — Blink Magnesium 10 SC',
  },
  {
    codigo: 'BPMI.OR025',
    nome: 'Blink Manganese 17 SC',
    label: 'BPMI.OR025 — Blink Manganese 17 SC',
  },
  {
    codigo: 'BPMI.OR027',
    nome: 'Blink Manganese 22 SC',
    label: 'BPMI.OR027 — Blink Manganese 22 SC',
  },
  {
    codigo: 'BPMI.OR029',
    nome: 'Blink Selenium 2.0 SC',
    label: 'BPMI.OR029 — Blink Selenium 2.0 SC',
  },
  {
    codigo: 'BPMI.OR031',
    nome: 'Blink Selenium 6.0 SC',
    label: 'BPMI.OR031 — Blink Selenium 6.0 SC',
  },
  { codigo: 'BPMI.OR033', nome: 'Blink Zinc 17 SC', label: 'BPMI.OR033 — Blink Zinc 17 SC' },
  { codigo: 'BPMI.OR035', nome: 'Blink Zinc 22 SC', label: 'BPMI.OR035 — Blink Zinc 22 SC' },
  { codigo: 'BPMY.ST001', nome: 'Blink Ycw SC', label: 'BPMY.ST001 — Blink Ycw SC' },
  { codigo: 'BPMY.ST003', nome: 'Blink Lev 32 SC', label: 'BPMY.ST003 — Blink Lev 32 SC' },
  { codigo: 'BPMY.ST005', nome: 'Blink Lev 35 SC', label: 'BPMY.ST005 — Blink Lev 35 SC' },
  { codigo: 'BPMY.ST007', nome: 'Blink Lev 37 SC', label: 'BPMY.ST007 — Blink Lev 37 SC' },
  { codigo: 'BPMY.ST009', nome: 'Blink Lev 40 SC', label: 'BPMY.ST009 — Blink Lev 40 SC' },
  { codigo: 'BPMY.ST013', nome: 'Blink Hydro 35 SC', label: 'BPMY.ST013 — Blink Hydro 35 SC' },
  { codigo: 'BPMY.ST015', nome: 'Blink Hydro 37 SC', label: 'BPMY.ST015 — Blink Hydro 37 SC' },
  { codigo: 'BPMY.ST017', nome: 'Blink Hydro 40 SC', label: 'BPMY.ST017 — Blink Hydro 40 SC' },
  { codigo: 'BBMI.XS001', nome: 'Blink Blend Beef SC', label: 'BBMI.XS001 — Blink Blend Beef SC' },
  {
    codigo: 'BBMI.XS003',
    nome: 'Blink Blend Breeder SC',
    label: 'BBMI.XS003 — Blink Blend Breeder SC',
  },
  {
    codigo: 'BBMI.XS005',
    nome: 'Blink Blend Cattle SC',
    label: 'BBMI.XS005 — Blink Blend Cattle SC',
  },
  {
    codigo: 'BBMI.XS007',
    nome: 'Blink Blend Dairy SC',
    label: 'BBMI.XS007 — Blink Blend Dairy SC',
  },
  {
    codigo: 'BBMI.XS009',
    nome: 'Blink Blend Poultry SC',
    label: 'BBMI.XS009 — Blink Blend Poultry SC',
  },
  {
    codigo: 'BBMI.XS011',
    nome: 'Blink Blend Swine SC',
    label: 'BBMI.XS011 — Blink Blend Swine SC',
  },
  {
    codigo: 'BBMI.XS015',
    nome: 'BlinkBlend Poultry GA SC',
    label: 'BBMI.XS015 — BlinkBlend Poultry GA SC',
  },
  { codigo: 'BBMI.XS017', nome: 'Blink Blend PET SC', label: 'BBMI.XS017 — Blink Blend PET SC' },
  {
    codigo: 'BBMI.XS019',
    nome: 'BlinkBlend PET SpecialD SC',
    label: 'BBMI.XS019 — BlinkBlend PET SpecialD SC',
  },
  {
    codigo: 'BBMI.XS021',
    nome: 'BlinkBlend Pet CF SC',
    label: 'BBMI.XS021 — BlinkBlend Pet CF SC',
  },
  {
    codigo: 'BBMI.XS022',
    nome: 'BlinkBlend Pet ADX SC',
    label: 'BBMI.XS022 — BlinkBlend Pet ADX SC',
  },
]

export const BLINK_UF_LIST = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

export const BLINK_ESPECIE_MANUAL_OPTIONS = [
  'AVES',
  'PETS',
  'RUMINANTES',
  'SUINOS',
  'AQUA',
] as const

export const BLINK_CANAL_MANUAL_OPTIONS = ['Direto', 'Distribuidor', 'Representante'] as const
