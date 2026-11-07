import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-[var(--radius-card)] border border-border/70 bg-surface p-5 shadow-[0_1px_2px_rgba(37,42,38,0.04)]', className)}
      {...props}
    />
  )
}
