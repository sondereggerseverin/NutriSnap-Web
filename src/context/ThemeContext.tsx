import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AppTheme, APP_THEMES, applyTheme, getStoredThemeId, getThemeById, setStoredThemeId } from '../lib/themes'

interface ThemeContextValue {
  theme: AppTheme
  themes: AppTheme[]
  setTheme: (id: string) => void
}

const initialTheme = getThemeById(getStoredThemeId())

const ThemeContext = createContext<ThemeContextValue>({
  theme: initialTheme,
  themes: APP_THEMES,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(initialTheme)

  // Beim ersten Rendern anwenden, damit CSS-Variablen auch nach einem Reload
  // sofort zum gespeicherten Theme passen (nicht erst nach der nächsten Auswahl).
  useEffect(() => {
    applyTheme(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setTheme(id: string) {
    const next = getThemeById(id)
    setThemeState(next)
    setStoredThemeId(next.id)
    applyTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, themes: APP_THEMES, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
