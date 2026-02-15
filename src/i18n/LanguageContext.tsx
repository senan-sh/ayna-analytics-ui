import { useState, type ReactNode } from 'react'
import { LanguageContext } from './languageStore'
import { TRANSLATIONS, type LanguageCode } from './translations'

const STORAGE_KEY = 'ayna-ui-language'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'az' || stored === 'en' || stored === 'ru') {
      return stored
    }
    return 'en'
  })

  const setLanguage = (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(STORAGE_KEY, nextLanguage)
  }

  const t = (key: string): string => {
    const activeDict = TRANSLATIONS[language]
    return activeDict[key] ?? TRANSLATIONS.en[key] ?? key
  }

  const value = {
    language,
    setLanguage,
    t,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
