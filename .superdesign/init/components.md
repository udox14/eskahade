# Shared UI Components

## DashboardPageHeader
- Source: `components/dashboard/page-header.tsx`
- Compact, shared dashboard title/description/action header.

```tsx
'use client'
import { cn } from '@/lib/utils'
type DashboardPageHeaderProps = { title: string; description: string; action?: React.ReactNode; className?: string }
export function DashboardPageHeader({ title, description, action, className }: DashboardPageHeaderProps) {
  return <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
    <div className="min-w-0"><h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem]">{title}</h1><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div>
    {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
  </div>
}
```

## ConfirmDialog
- Source: `components/ui/confirm-dialog.tsx`
- Application-wide imperative confirmation dialog with severity variants.
- Key API: `useConfirm()`.
- Pass the full source file when a target page imports it.

## Pagination
- Source: `components/ui/pagination.tsx`
- Shared compact pagination control.
- Pass the full source file when used.

## SantriPhotoAvatar
- Source: `components/ui/santri-photo-avatar.tsx`
- Shared student portrait/avatar with fallback identity treatment.
- Pass the full source file when used.

## Skeletons
- Source: `components/ui/skeletons.tsx`
- Shared loading placeholders for dashboard content.
- Pass the full source file when used.

## Existing visual primitives
The repository primarily uses inline Tailwind primitives rather than a packaged Card/Button/Input library. Repeated conventions:

```tsx
<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" />
<button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white" />
<input className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
<p className="text-xs font-bold uppercase tracking-wide text-slate-500" />
```
