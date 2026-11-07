import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, Info, Leaf } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NUTRIENTS, type Food, type MicronutrientKey, type NutrientCoverage, type NutrientGroup } from '@/core/types'
import { NutrientProgress, NutrientStatusBadge } from '@/components/nutrients/NutrientProgress'
import { classifyNutrientStatus } from '@/components/nutrients/nutrientStatus'
import { MacroProgressBar } from '@/components/MacroProgressBar'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { FoodListItem } from '@/components/food/FoodListItem'
import { FoodDetailSheet } from '@/components/food/FoodDetailSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sheet } from '@/components/ui/sheet'
import { mealForNow, relativeDayLabel } from '@/lib/dates'
import { nutrientAmount, percent } from '@/lib/format'
import { useSelectedDate } from '@/lib/selectedDate'
import { useDaySummary, useNutrientDetail, useNutrientReport } from '@/services/queries'

const GROUPS: { key: NutrientGroup; label: string }[] = [
  { key: 'vitamins', label: 'Vitamins' },
  { key: 'minerals', label: 'Minerals' },
  { key: 'other', label: 'Sugars, fats & cholesterol' },
]

export function NutrientsScreen() {
  const { date } = useSelectedDate()
  const report = useNutrientReport(date)
  const day = useDaySummary(date)
  const [selected, setSelected] = useState<MicronutrientKey | null>(null)
  const [logFood, setLogFood] = useState<Food | null>(null)
  const navigate = useNavigate()

  const byGroup = (g: NutrientGroup) => report.data?.nutrients.filter((n) => NUTRIENTS[n.key].group === g) ?? []
  const statuses = report.data?.nutrients.map((n) => classifyNutrientStatus(n, NUTRIENTS[n.key])) ?? []
  const count = (s: string) => statuses.filter((x) => x === s).length

  return (
    <div className="animate-fade-up">
      <PageHeader title="Nutrients" eyebrow={relativeDayLabel(date)} />
      {report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : !report.data ? (
        <LoadingState rows={5} />
      ) : report.data.entryCount === 0 ? (
        <Card>
          <EmptyState
            icon={<Leaf className="size-5" />}
            title="No foods logged for this day"
            message="Vitamins and minerals appear here as you log meals."
            action={<Button onClick={() => navigate('/add')}>Log food</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Coverage</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Summary value={count('on-track') + count('high')} label="Met" tone="text-accent" />
              <Summary value={count('low')} label="Below target" tone="text-warning" />
              <Summary value={count('incomplete') + count('no-data')} label="Not enough data" tone="text-muted" />
            </div>
            <p className="mt-4 flex gap-2 rounded-2xl bg-surface-2/70 p-3 text-[12.5px] leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Many foods don't report every nutrient. Striped or dashed bars mean missing data — not a deficiency.
            </p>
            {day.data && (
              <div className="mt-4 border-t border-border/70 pt-4">
                <MacroProgressBar label="Fiber" tone="fiber" consumed={day.data.totals.fiber} target={day.data.goals.fiber} />
              </div>
            )}
          </Card>

          {GROUPS.map((g) => (
            <NutrientGroupCard key={g.key} label={g.label} items={byGroup(g.key)} onSelect={setSelected} defaultOpen={g.key !== 'other'} />
          ))}
          <Legend />
        </div>
      )}
      <NutrientDetailSheet
        date={date}
        nutrient={selected}
        onClose={() => setSelected(null)}
        onLog={(f) => {
          setSelected(null)
          setTimeout(() => setLogFood(f), 250)
        }}
      />
      <FoodDetailSheet mode="add" food={logFood} meal={mealForNow()} date={date} onClose={() => setLogFood(null)} />
    </div>
  )
}

function Summary({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/70 px-2 py-3">
      <p className={`tabular text-[24px] font-semibold leading-none ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[11.5px] font-medium text-muted">{label}</p>
    </div>
  )
}

function NutrientGroupCard({
  label,
  items,
  onSelect,
  defaultOpen,
}: {
  label: string
  items: NutrientCoverage[]
  onSelect: (k: MicronutrientKey) => void
  defaultOpen?: boolean
}) {
  const reported = items.filter((i) => i.reportingEntries > 0).length
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Card className="p-0">
        <Collapsible.Trigger className="group flex min-h-14 w-full items-center justify-between px-5 py-3 text-left">
          <span>
            <span className="block text-[16px] font-semibold tracking-tight">{label}</span>
            <span className="block text-[12.5px] text-muted">
              {reported} of {items.length} with data
            </span>
          </span>
          <ChevronDown className="size-5 text-muted transition group-data-[state=open]:rotate-180" />
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="divide-y divide-border/60 px-4 pb-2">
            {items.map((c) => (
              <NutrientProgress key={c.key} coverage={c} info={NUTRIENTS[c.key]} onSelect={() => onSelect(c.key)} />
            ))}
          </div>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-2 pb-2 text-[12px] text-muted">
      <span className="flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-primary" />Confirmed</span>
      <span className="flex items-center gap-2"><span className="hatched h-2 w-6 rounded-full" />Partial data</span>
      <span className="flex items-center gap-2"><span className="h-2 w-6 rounded-full border border-dashed border-muted/50" />No data</span>
    </div>
  )
}

function NutrientDetailSheet({
  date,
  nutrient,
  onClose,
  onLog,
}: {
  date: string
  nutrient: MicronutrientKey | null
  onClose: () => void
  onLog: (f: Food) => void
}) {
  const detail = useNutrientDetail(date, nutrient)
  const info = nutrient ? NUTRIENTS[nutrient] : null
  const d = detail.data
  const status = d ? classifyNutrientStatus(d.coverage, d.info) : null
  const confirmed = status === 'low' || status === 'on-track' || status === 'high'

  return (
    <Sheet open={!!nutrient} onOpenChange={(o) => !o && onClose()} title={info?.label ?? ''} description={info?.isLimit ? 'Upper limit (EFSA / EU reference intakes)' : 'Reference intake (AESAN 2019)'}>
      {detail.isError ? (
        <ErrorState error={detail.error} />
      ) : !d ? (
        <LoadingState rows={3} />
      ) : (
        <div className="space-y-5 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Recorded intake" value={d.coverage.reportingEntries ? nutrientAmount(d.coverage.intake, d.info.unit) : '—'} />
            <Tile label={d.info.isLimit ? 'Limit' : 'Reference target'} value={d.coverage.target ? nutrientAmount(d.coverage.target, d.info.unit) : 'Not set'} />
            <Tile
              label="Of target"
              value={confirmed && d.coverage.percentOfTarget !== null ? percent(d.coverage.percentOfTarget) : '—'}
              hint={!confirmed ? 'Shown once enough foods report it' : undefined}
            />
            <Tile label="Data completeness" value={percent(d.coverage.completeness * 100)} hint={`${d.coverage.reportingEntries} of ${d.coverage.totalEntries} foods report it`} />
          </div>
          {status && (
            <div className="flex items-center gap-2 rounded-2xl bg-surface-2/70 px-4 py-3 text-sm">
              <NutrientStatusBadge status={status} isLimit={d.info.isLimit} noTarget={d.coverage.target === null} />
              <span className="text-muted">
                {status === 'no-data' && "None of this day's foods report this nutrient, so intake is unknown."}
                {status === 'incomplete' && (d.coverage.target === null ? 'EFSA and AESAN set no reference value for this nutrient, so intake is shown without a verdict.' : 'Some foods are missing this value — actual intake is likely higher than recorded.')}
                {status === 'low' && 'Recorded intake is well below the reference today. One day is only a snapshot — references describe your average intake over time.'}
                {status === 'on-track' && (d.info.isLimit ? 'Recorded intake is within the limit.' : 'Recorded intake is at or close to the reference.')}
                {status === 'high' && (d.info.isLimit ? 'Recorded intake is above the recommended limit.' : 'Recorded intake is well above the reference.')}
              </span>
            </div>
          )}
          <section>
            <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Main sources today</h3>
            {d.coverage.contributors.length ? (
              <ul className="divide-y divide-border/70">
                {d.coverage.contributors.map((c) => (
                  <li key={c.name} className="flex min-h-12 items-center justify-between gap-3 py-2 text-[15px]">
                    <span className="truncate">{c.name}</span>
                    <span className="tabular text-muted">{nutrientAmount(c.amount, d.info.unit)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-muted">No logged foods report this nutrient.</p>
            )}
          </section>
          {d.suggestions.length > 0 && (
            <section>
              <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Good sources</h3>
              <ul className="divide-y divide-border/70">
                {d.suggestions.map((f) => (
                  <li key={f.id}>
                    <FoodListItem
                      name={f.name}
                      detail={`${nutrientAmount(f.per100g.micros[d.info.key] ?? 0, d.info.unit)} per 100 g`}
                      calories={f.per100g.calories}
                      onClick={() => onLog(f)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/70 px-4 py-3">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 tabular text-[18px] font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}
