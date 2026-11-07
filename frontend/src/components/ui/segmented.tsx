import { cn } from '@/lib/utils'

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  stacked,
}: {
  /** Icon above a smaller label — fits 5+ options on a phone. */
  stacked?: boolean
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ReactNode }[]
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex bg-surface-2 p-1', stacked ? 'rounded-[20px]' : 'rounded-full', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              stacked
                ? 'flex min-h-13 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[11.5px] font-semibold transition-all [&_.emoji]:text-[18px]'
                : 'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-all',
              active ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
