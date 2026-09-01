import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

const ERROR_CODE_MAP: Record<string, string> = {
  PGRST116: 'Registro nao encontrado',
  '23505': 'Ja existe um registro com estes dados',
  '23503': 'Referencia invalida',
  '42501': 'Sem permissao',
  '23514': 'Valor invalido',
}

export function translateErrorCode(code: string | number): string | undefined {
  const str = String(code).trim()
  return ERROR_CODE_MAP[str]
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    if (error && typeof error === 'object') {
      const code = (error as { code?: string | number }).code
      if (code && ERROR_CODE_MAP[String(code)]) {
        return ERROR_CODE_MAP[String(code)]
      }
    }
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }

  // Check error response status / custom code
  const code = (error as { code?: string | number }).code
  if (code && ERROR_CODE_MAP[String(code)]) {
    return ERROR_CODE_MAP[String(code)]
  }

  // PocketBase status code mappings
  if (error.status === 404) {
    return ERROR_CODE_MAP['PGRST116'] || 'Registro nao encontrado'
  }
  if (error.status === 403 || error.status === 401) {
    return ERROR_CODE_MAP['42501'] || 'Sem permissao'
  }
  if (error.status === 400 && error.message?.toLowerCase().includes('unique')) {
    return ERROR_CODE_MAP['23505'] || 'Ja existe um registro com estes dados'
  }

  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
