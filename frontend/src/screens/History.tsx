import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronRight as Chevron } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NUTRIENTS, type DayStat, type MicronutrientKey } from '@/core/types'
import { CalendarGrid } from '@/components/CalendarPicker'
import { ChartCard, NutritionBarChart, NutritionLineChart, type ChartDatum, type SeriesDef } from '@/components/NutritionChart'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SegmentedControl } from '@/components/ui/segmented'
import { fromISO, toISO } from '@/lib/dates'
import { grams, kcal } from '@/lib/format'
import { useSelectedDate } from '@/lib/selectedDate'
import { cn } from '@/lib/utils'
import { useGoals, useHistory } from '@/services/queries'

type Range = 'week' | 'month'

const MICRO_OPTIONS: MicronutrientKey[] = ['iron', 'calcium', 'vitaminC', 'vitaminD', 'magnesium', 'potassium', 'sodium', 'vitaminB12', 'folate']

export function HistoryScreen() {
  const { date, setDate } = useSelectedDate()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('week')
  const [anchor, setAnchor] = useState(() => fromISO(date))
  const [micro, setMicro] = useState<MicronutrientKey>('iron')
  const goals = useGoals()

  const [start, end] = useMemo(
    () =>
      range === 'week'
        ? [startOfWeek(anchor, { weekStartsOn: 1 }), endOfWeek(anchor, { weekStartsOn: 1 })]
        : [startOfMonth(anchor), endOfMonth(anchor)],
    [anchor, range],
  )
  const history = useHistory(toISO(start), toISO(end))
  const step = (n: number) => setAnchor((a) => (range === 'week' ? addDays(a, 7 * n) : addMonths(a, n)))
  const rangeLabel =
    range === 'week'
      ? `${format(start, 'MMM d')} – ${format(end, start.getMonth() === end.getMonth() ? 'd' : 'MMM d')}`
      : format(start, 'MMMM yyyy')

  const openDay = (iso: string) => {
    setDate(iso)
    navigate('/')
  }

  const data: ChartDatum[] = useMemo(
    () =>
      (history.data?.days ?? []).map((d) => ({
        label: range === 'week' ? format(fromISO(d.date), 'EEEEE') : format(fromISO(d.date), 'd'),
        fullLabel: format(fromISO(d.date), 'EEE, MMM d'),
        calories: d.logged ? d.totals.calories : null,
        protein: d.logged ? d.totals.protein : null,
        carbs: d.logged ? d.totals.carbs : null,
        fat: d.logged ? d.totals.fat : null,
        fiber: d.logged ? d.totals.fiber : null,
        micro: d.logged && d.micros[micro] !== undefined ? d.micros[micro]! : null,
      })),
    [history.data, micro, range],
  )

  const h = history.data
  const microInfo = NUTRIENTS[micro]
  const macroSeries: SeriesDef[] = [
    { key: 'protein', name: 'Protein', color: 'protein', unit: 'g' },
    { key: 'carbs', name: 'Carbs', color: 'carbs', unit: 'g' },
    { key: 'fat', name: 'Fat', color: 'fat', unit: 'g' },
  ]

  return (
    <div className="animate-fade-up">
      <PageHeader title="History" />
      <SegmentedControl
        label="Range"
        value={range}
        onChange={setRange}
        className="mb-4"
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
      />
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label={`Previous ${range}`} onClick={() => step(-1)}>
          <ChevronLeft className="size-5" />
        </Button>
        <span className="text-[15px] font-semibold" aria-live="polite">
          {rangeLabel}
        </span>
        <Button variant="ghost" size="icon" aria-label={`Next ${range}`} onClick={() => step(1)}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : !h ? (
        <LoadingState rows={4} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Avg calories" value={h.daysLogged ? kcal(h.averages.calories) : '—'} unit={h.daysLogged ? 'kcal' : ''} />
            <Metric label="Days logged" value={`${h.daysLogged}`} unit={`of ${h.days.length}`} />
            <Metric label="Within calorie goal" value={`${h.daysWithinCalorieGoal}`} unit={h.daysLogged ? `of ${h.daysLogged} days` : ''} />
            <Metric label="Protein goal met" value={`${h.daysMeetingProtein}`} unit={h.daysLogged ? `of ${h.daysLogged} days` : ''} />
          </div>

          {h.daysLogged === 0 ? (
            <Card>
              <p className="py-6 text-center text-sm text-muted">
                No entries this {range}. Trends appear once you log a few days.
              </p>
            </Card>
          ) : (
            <>
              <ChartCard title="Calories" subtitle={goals.data ? `Dashed line: ${kcal(goals.data.calories)} kcal target` : undefined}>
                <NutritionBarChart data={data} target={goals.data?.calories} series={[{ key: 'calories', name: 'Calories', color: 'primary', unit: 'kcal' }]} />
              </ChartCard>
              <ChartCard
                title="Macros"
                subtitle={`Avg P ${grams(h.averages.protein)} · C ${grams(h.averages.carbs)} · F ${grams(h.averages.fat)} g`}
                legend={macroSeries}
              >
                <NutritionBarChart data={data} stacked series={macroSeries} />
              </ChartCard>
              <ChartCard title="Fiber" subtitle={`Avg ${grams(h.averages.fiber)} g · goal met ${h.daysMeetingFiber} of ${h.daysLogged} days`}>
                <NutritionLineChart data={data} target={goals.data?.fiber} series={[{ key: 'fiber', name: 'Fiber', color: 'fiber', unit: 'g' }]} />
              </ChartCard>
              <ChartCard title="Micronutrient trend" subtitle="Gaps mean no food reported it that day">
                <NutritionLineChart
                  data={data}
                  target={goals.data?.micros[micro] ?? null}
                  series={[{ key: 'micro', name: microInfo.label, color: 'accent', unit: microInfo.unit }]}
                />
              </ChartCard>
              <div className="no-scrollbar -mx-4 -mt-2 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Micronutrient">
                {MICRO_OPTIONS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={micro === k}
                    onClick={() => setMicro(k)}
                    className={cn(
                      'h-10 shrink-0 rounded-full border px-4 text-[13px] font-medium',
                      micro === k ? 'border-accent bg-accent text-white dark:text-background' : 'border-border bg-surface',
                    )}
                  >
                    {NUTRIENTS[k].label}
                  </button>
                ))}
              </div>
            </>
          )}

          {range === 'month' && (
            <Card>
              <CalendarGrid value={date} onChange={openDay} month={startOfMonth(anchor)} onMonthChange={setAnchor} />
            </Card>
          )}

          <section>
            <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Daily summaries</h2>
            <Card className="p-0">
              <ul className="divide-y divide-border/70">
                {[...h.days].reverse().map((d) => (
                  <DayRow key={d.date} day={d} onClick={() => openDay(d.date)} />
                ))}
              </ul>
            </Card>
          </section>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[20px] border border-border/70 bg-surface px-4 py-3">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 tabular text-[22px] font-semibold tracking-tight">
        {value} <span className="text-[12px] font-medium text-muted">{unit}</span>
      </p>
    </div>
  )
}

const ADH: Record<DayStat['adherence'], { label: string; cls: string }> = {
  none: { label: 'Not logged', cls: 'bg-surface-2 text-muted' },
  within: { label: 'On target', cls: 'bg-soft text-accent' },
  under: { label: 'Under', cls: 'bg-carbs/15 text-[color-mix(in_oklab,var(--carbs)_70%,var(--foreground))]' },
  over: { label: 'Over', cls: 'bg-protein/15 text-[color-mix(in_oklab,var(--protein)_70%,var(--foreground))]' },
}

function DayRow({ day, onClick }: { day: DayStat; onClick: () => void }) {
  const a = ADH[day.adherence]
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left active:bg-surface-2">
        <div className="w-14 shrink-0">
          <p className="text-[12px] font-medium text-muted">{format(fromISO(day.date), 'EEE')}</p>
          <p className="tabular text-[17px] font-semibold">{format(fromISO(day.date), 'MMM d')}</p>
        </div>
        <div className="min-w-0 flex-1 text-[12.5px] text-muted tabular">
          {day.logged ? (
            <>
              <span className="text-[15px] font-semibold text-foreground">{kcal(day.totals.calories)}</span> / {kcal(day.targets.calories)} kcal
              <br />P {grams(day.totals.protein)} · C {grams(day.totals.carbs)} · F {grams(day.totals.fat)} · Fib {grams(day.totals.fiber)}
            </>
          ) : (
            'No entries'
          )}
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold', a.cls)}>{a.label}</span>
        <Chevron className="size-4 shrink-0 text-muted/60" />
      </button>
    </li>
  )
}
