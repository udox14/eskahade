'use client'

import { createContext, useContext } from 'react'

export const DashboardMenuContext = createContext<() => void>(() => {})
export const DashboardSidebarContext = createContext<() => void>(() => {})

export function useDashboardMenu() {
  return useContext(DashboardMenuContext)
}

export function useDashboardSidebar() {
  return useContext(DashboardSidebarContext)
}
