import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { type Language, translations } from '@/lib/i18n'

interface I18nContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('blink_lang')
    if (saved === 'pt' || saved === 'en' || saved === 'es') return saved
    return 'pt'
  })

  useEffect(() => {
    localStorage.setItem('blink_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Language) => setLangState(l)
  const t = (key: string) => translations[lang][key] || translations.pt[key] || key

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}
