'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type PortalTheme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface PortalThemeContextValue {
  theme: PortalTheme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: PortalTheme) => void
}

const PortalThemeContext = createContext<PortalThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
})

export const THEME_STORAGE_KEY = 'eskahade_portal_theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: PortalTheme): ResolvedTheme {
  if (theme === 'system') return getSystemTheme()
  return theme
}

export function PortalThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<PortalTheme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [mounted, setMounted] = useState(false)

  // Initialize from localStorage or default to system
  useEffect(() => {
    try {
      const stored = (localStorage.getItem(THEME_STORAGE_KEY) as PortalTheme) || 'system'
      const validTheme: PortalTheme = ['light', 'dark', 'system'].includes(stored) ? stored : 'system'
      setThemeState(validTheme)
      const resolved = resolveTheme(validTheme)
      setResolvedTheme(resolved)

      if (resolved === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } catch {
      // Ignore localStorage access failures
    }
    setMounted(true)
  }, [])

  // Listen to OS scheme changes when in 'system' mode
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        const sys = mediaQuery.matches ? 'dark' : 'light'
        setResolvedTheme(sys)
        if (sys === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = (newTheme: PortalTheme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch {
      // Ignore
    }

    const resolved = resolveTheme(newTheme)
    setResolvedTheme(resolved)

    if (resolved === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <PortalThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </PortalThemeContext.Provider>
  )
}

export function usePortalTheme() {
  return useContext(PortalThemeContext)
}
