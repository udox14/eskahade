'use client'

import { createContext, useContext } from 'react'

export const DashboardMenuContext = createContext<() => void>(() => {})

export function useDashboardMenu() {
  return useContext(DashboardMenuContext)
}
