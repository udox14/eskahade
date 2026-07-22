# Theme and Design Tokens

## Framework
- Next.js 16 App Router, React 19, TypeScript.
- Tailwind CSS 4 utilities with a small custom Tailwind config.
- Icons: Phosphor in the application shell; Lucide in most feature pages.
- Toasts: Sonner.

## Dashboard visual language
- Canvas: `slate-50/50`; surfaces: white.
- Primary text: `slate-900`; secondary: `slate-500`; muted labels: `slate-400`.
- Primary operational accent: `emerald-700`; positive state: emerald/green.
- Attention: amber; danger: rose/red; informational: blue/cyan.
- Borders: `slate-200` or `slate-100`; shadows restrained (`shadow-sm`).
- Radius: controls 8–12px (`rounded-lg`/`rounded-xl`); large panels normally 12px. Avoid overusing `rounded-2xl` in dense finance UI.
- Page spacing: 24px vertical; compact internal spacing 8–16px.
- Headers: 24–28px bold title, 14px muted description; use `DashboardPageHeader`.
- Forms: 36–40px controls, clear labels above fields, compact help below.
- Tables: sticky/light header, 12–14px typography, right-aligned currency, status badges, subtle row separators.

## `app/globals.css` dashboard-relevant source
```css
@import "tailwindcss";
:root { --background: #ffffff; --foreground: #171717; }
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
body { background: var(--background); color: var(--foreground); font-family: Arial, Helvetica, sans-serif; }
```

## `tailwind.config.ts` source
```ts
import type { Config } from 'tailwindcss'
const config: Config = {
  darkMode: 'class',
  content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}','./src/components/**/*.{js,ts,jsx,tsx,mdx}','./src/app/**/*.{js,ts,jsx,tsx,mdx}','./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } }, extend: {} },
  plugins: [require('tailwindcss-animate')],
}
export default config
```
