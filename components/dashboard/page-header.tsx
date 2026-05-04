'use client'

import { cn } from '@/lib/utils'

type DashboardPageHeaderProps = {
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function DashboardPageHeader({
  title,
  description,
  action,
  className,
}: DashboardPageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-[1.75rem]">
          {title}
        </h1>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          {description}
        </p>
      </div>
      {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  )
}
