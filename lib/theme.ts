'use client'

import { createTheme, type MantineColorsTuple, Button } from '@mantine/core'

// Palet hijau brand ESKAHADE (anchor #15803d = green-700 Tailwind)
const brandGreen: MantineColorsTuple = [
  '#f0fdf4',
  '#dcfce7',
  '#bbf7d0',
  '#86efac',
  '#4ade80',
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#166534',
  '#14532d',
]

export const theme = createTheme({
  primaryColor: 'brand',
  // shade 7 = #15803d (sama dengan themeColor PWA & brand lama)
  primaryShade: { light: 7, dark: 6 },
  colors: {
    brand: brandGreen,
  },
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  headings: { fontFamily: "'Plus Jakarta Sans', sans-serif" },
  defaultRadius: 'md',
  // Breakpoint diselaraskan ke skala Tailwind agar mapping responsif presisi.
  // Tailwind→Mantine (geser satu): sm→xs, md→sm, lg→md, xl:/lg, 2xl→xl
  breakpoints: {
    xs: '40em', // 640  (Tailwind sm)
    sm: '48em', // 768  (Tailwind md)
    md: '64em', // 1024 (Tailwind lg)
    lg: '80em', // 1280 (Tailwind xl)
    xl: '96em', // 1536 (Tailwind 2xl)
  },
  components: {
    Button: Button.extend({
      defaultProps: {
        fw: 700,
      },
    }),
  },
})
