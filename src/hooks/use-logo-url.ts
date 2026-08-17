import { useEffect, useRef, useState } from 'react'

const LOGO_STORAGE_URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/assets/Logo_Blink.png'

export interface UseLogoUrlResult {
  logoUrl: string | null
  isLoading: boolean
  hasError: boolean
}

/**
 * Resolves the Blink logo URL from Supabase Storage and validates that the
 * image actually loads. The result is cached for the lifetime of the module so
 * it only ever resolves once, even across hook instances.
 */
export function useLogoUrl(): UseLogoUrlResult {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)
  const hasResolved = useRef(false)

  useEffect(() => {
    if (hasResolved.current) return
    hasResolved.current = true

    let cancelled = false
    const url = LOGO_STORAGE_URL

    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      setLogoUrl(url)
      setIsLoading(false)
      setHasError(false)
    }
    img.onerror = () => {
      if (cancelled) return
      setLogoUrl(null)
      setIsLoading(false)
      setHasError(true)
    }
    img.src = url

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [])

  return { logoUrl, isLoading, hasError }
}
