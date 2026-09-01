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

export const ERROR_MESSAGES_PT: Record<string, string> = {
  PGRST116: 'Registro nao encontrado',
  '23505': 'Ja existe um produto com este codigo',
  '23503': 'Referencia invalida',
  '42501': 'Sem permissao',
  '23514': 'Valor invalido',
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error) {
      if (ERROR_MESSAGES_PT[error.message]) return ERROR_MESSAGES_PT[error.message]
      return error.message
    }
    return 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) {
    return msgs.map((m) => ERROR_MESSAGES_PT[m] || m).join(' ')
  }
  if (error.status === 404) return ERROR_MESSAGES_PT.PGRST116
  if (error.status === 403 || error.status === 401) return ERROR_MESSAGES_PT['42501']
  if (error.status === 400 && error.message?.includes('UNIQUE')) return ERROR_MESSAGES_PT['23505']
  return error.message || 'An unexpected error occurred.'
}
