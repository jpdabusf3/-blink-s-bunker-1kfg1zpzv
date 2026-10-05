/**
 * Utilitário de destaque visual e rolagem suave para navegação contextual
 */

export function highlightElement(elementIdOrSelector: string, durationMs = 3500): boolean {
  if (typeof document === 'undefined') return false

  // Tenta por id exato primeiro
  let target = document.getElementById(elementIdOrSelector)

  // Se não encontrou, tenta por querySelector ou atributo data-*
  if (!target) {
    try {
      target =
        document.querySelector(`[data-highlight-id="${elementIdOrSelector}"]`) ||
        document.querySelector(`[data-id="${elementIdOrSelector}"]`) ||
        document.querySelector(`[data-record-id="${elementIdOrSelector}"]`) ||
        document.querySelector(elementIdOrSelector)
    } catch {
      target = null
    }
  }

  if (!target) return false

  try {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const originalTransition = target.style.transition
    const originalBoxShadow = target.style.boxShadow
    const originalOutline = target.style.outline
    const originalBackgroundColor = target.style.backgroundColor

    target.classList.add('blink-highlight-pulse')
    target.style.outline = '3px solid hsl(var(--primary))'
    target.style.outlineOffset = '2px'
    target.style.transition = 'all 0.3s ease-in-out'

    setTimeout(() => {
      if (target) {
        target.classList.remove('blink-highlight-pulse')
        target.style.transition = originalTransition
        target.style.boxShadow = originalBoxShadow
        target.style.outline = originalOutline
        target.style.backgroundColor = originalBackgroundColor
      }
    }, durationMs)

    return true
  } catch (err) {
    console.warn('[highlightElement] Falha ao destacar elemento:', err)
    return false
  }
}

/**
 * Utilitário para formatar tempo relativo em português
 */
export function formatRelativeTimeBR(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 45) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffHour < 24) return `há ${diffHour}h`
  if (diffDay === 1) return 'ontem'
  if (diffDay < 7) return `há ${diffDay} dias`

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
