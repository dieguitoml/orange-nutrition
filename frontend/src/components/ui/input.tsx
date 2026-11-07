import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted/80 outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-[13px] font-medium text-muted', className)} {...props} />
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return (
    <p role="alert" className="text-[13px] text-danger">
      {children}
    </p>
  )
}
