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

// Map common PocketBase error messages to Portuguese (pt-BR).
function translate(message: string): string {
  if (!message) return ''
  const lower = message.toLowerCase()
  if (lower.includes('failed to authenticate') || lower.includes('invalid login'))
    return 'Email ou senha incorretos.'
  if (lower.includes('unauthorized') || lower.includes('requires authentication'))
    return 'Você precisa estar logado para acessar esta página.'
  if (lower.includes('forbidden') || lower.includes('you are not allowed'))
    return 'Você não tem permissão para realizar esta ação.'
  if (lower.includes('the request was aborted'))
    return 'A requisição foi cancelada. Tente novamente.'
  if (lower.includes('network request failed') || lower.includes('failed to fetch'))
    return 'Não foi possível conectar ao servidor. Verifique sua internet.'
  if (lower.includes('timeout')) return 'A operação demorou demais. Tente novamente.'
  return message
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error) {
      const translated = translate(error.message)
      return translated || 'Não foi possível concluir a operação. Tente novamente.'
    }
    return 'Não foi possível concluir a operação. Tente novamente.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) return msgs.join(' ')
  const translated = translate(error.message)
  return translated || 'Não foi possível concluir a operação. Tente novamente.'
}
