import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { AdherenceStatus, ISODate } from '@/core/types'
import { fromISO, toISO, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useHistory } from '@/services/queries'
import { Button } from './ui/button'

const DOT: Record<AdherenceStatus, string> = {
  none: 'bg-transparent',
  within: 'bg-fiber',
  under: 'bg-carbs',
  over: 'bg-protein',
}

/** Month grid. Dots show logged days, colored by calorie-goal adherence from the history service. */
export function CalendarGrid({
  value,
  onChange,
  month: monthProp,
  onMonthChange,
}: {
  value: ISODate
  onChange: (d: ISODate) => void
  month?: Date
  onMonthChange?: (d: Date) => void
}) {
  const [internalMonth, setInternalMonth] = useState(() => startOfMonth(fromISO(value)))
  const month = monthProp ?? internalMonth
  const setMonth = onMonthChange ?? setInternalMonth
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const history = useHistory(toISO(gridStart), toISO(gridEnd))
  const stat = new Map(history.data?.days.map((d) => [d.date, d]))
  const today = todayISO()

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft className="size-5" />
        </Button>
        <span className="text-[15px] font-semibold" aria-live="polite">{format(month, 'MMMM yyyy')}</span>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-muted" aria-hidden>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1" role="grid">
        {days.map((d) => {
          const iso = toISO(d)
          const s = stat.get(iso)
          const selected = iso === value
          const inMonth = isSameMonth(d, month)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              aria-label={`${format(d, 'EEEE, MMMM d')}${s?.logged ? ', logged' : ''}`}
              className={cn(
                'mx-auto flex size-11 flex-col items-center justify-center rounded-full text-[15px] tabular transition',
                !inMonth && 'text-muted/40',
                selected ? 'bg-accent font-semibold text-white dark:text-background' : 'active:bg-surface-2',
                !selected && iso === today && 'font-semibold text-accent',
              )}
            >
              {format(d, 'd')}
              <span className={cn('mt-0.5 size-1 rounded-full', selected ? 'bg-current' : s ? DOT[s.adherence] : 'bg-transparent')} />
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-fiber" />Within goal</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-carbs" />Under</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-protein" />Over</span>
      </div>
    </div>
  )
}
