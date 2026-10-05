/**
 * Helpers para formatação e validação de CNPJ, Telefone e UF brasileiros.
 */

export const BRAZILIAN_UFS = [
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

export const CLIENT_SEGMENTOS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'] as const

export type ClientSegmento = (typeof CLIENT_SEGMENTOS)[number]

/**
 * Remove qualquer caractere não numérico
 */
export function cleanDigits(val?: string | null): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '')
}

/**
 * Aplica máscara de CNPJ 00.000.000/0000-00 progressiva
 */
export function formatCNPJ(val?: string | null): string {
  const digits = cleanDigits(val).slice(0, 14)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

/**
 * Validação de CNPJ (com verificação dos 14 dígitos e dígitos verificadores)
 */
/**
 * Validação de CPF (com verificação dos 11 dígitos e dígitos verificadores)
 */
export function isValidCPF(cpf?: string | null): boolean {
  const digits = cleanDigits(cpf)
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digits.charAt(i), 10) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(digits.charAt(9), 10)) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digits.charAt(i), 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(digits.charAt(10), 10)) return false

  return true
}

/**
 * Validação de CNPJ (com verificação dos 14 dígitos e dígitos verificadores)
 */
export function isValidCNPJ(cnpj?: string | null): boolean {
  const digits = cleanDigits(cnpj)
  if (digits.length !== 14) return false

  // Rejeita sequências repetidas (00000000000000, 11111111111111, etc.)
  if (/^(\d)\1{13}$/.test(digits)) return false

  // Validação do primeiro dígito verificador
  let tamanho = digits.length - 2
  let numeros = digits.substring(0, tamanho)
  const digitos = digits.substring(tamanho)
  let soma = 0
  let pos = tamanho - 7

  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--
    if (pos < 2) pos = 9
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== Number(digitos.charAt(0))) return false

  // Validação do segundo dígito verificador
  tamanho = tamanho + 1
  numeros = digits.substring(0, tamanho)
  soma = 0
  pos = tamanho - 7

  for (let i = tamanho; i >= 1; i--) {
    soma += Number(numeros.charAt(tamanho - i)) * pos--
    if (pos < 2) pos = 9
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== Number(digitos.charAt(1))) return false

  return true
}

/**
 * Valida tanto CPF (11 dígitos) quanto CNPJ (14 dígitos)
 */
export function isValidCpfCnpj(val?: string | null): boolean {
  const digits = cleanDigits(val)
  if (digits.length === 11) return isValidCPF(digits)
  if (digits.length === 14) return isValidCNPJ(digits)
  return false
}

/**
 * Aplica máscara de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
 */
export function formatCpfCnpj(val?: string | null): string {
  const digits = cleanDigits(val)
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }
  return formatCNPJ(digits)
}

/**
 * Máscara de telefone brasileiro (fixo ou celular)
 */
export function formatTelefone(val?: string | null): string {
  const digits = cleanDigits(val).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}
