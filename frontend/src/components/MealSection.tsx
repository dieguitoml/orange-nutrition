import { Coffee, Cookie, Plus, Soup, Sun } from 'lucide-react'
import type { LogEntry, MealSummary, MealType } from '@/core/types'
import { MEAL_LABELS, grams, kcal, quantityLabel } from '@/lib/format'
import { Card } from './ui/card'
import { FoodListItem } from './food/FoodListItem'

const MEAL_ICON: Record<MealType, React.ReactNode> = {
  breakfast: <Coffee className="size-[18px]" />,
  lunch: <Sun className="size-[18px]" />,
  dinner: <Soup className="size-[18px]" />,
  snacks: <Cookie className="size-[18px]" />,
}

export function MealSection({
  summary,
  onAdd,
  onSelectEntry,
}: {
  summary: MealSummary
  onAdd: (meal: MealType) => void
  onSelectEntry: (e: LogEntry) => void
}) {
  const { meal, entries, totals } = summary
  return (
    <Card className="p-0">
      <div className="flex items-center gap-3 px-5 pb-2 pt-4">
        <div className="grid size-9 place-items-center rounded-full bg-soft text-accent">{MEAL_ICON[meal]}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold tracking-tight">{MEAL_LABELS[meal]}</h3>
          <p className="text-[12.5px] text-muted tabular">
            {entries.length
              ? `${kcal(totals.calories)} kcal · P ${grams(totals.protein)} · C ${grams(totals.carbs)} · F ${grams(totals.fat)}`
              : 'Nothing logged'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(meal)}
          aria-label={`Add food to ${MEAL_LABELS[meal]}`}
          className="grid size-11 place-items-center rounded-full bg-accent text-white transition active:scale-95 dark:text-background"
        >
          <Plus className="size-5" />
        </button>
      </div>
      {entries.length > 0 && (
        <ul className="divide-y divide-border/70 px-5 pb-2">
          {entries.map((e) => (
            <li key={e.id}>
              <FoodListItem
                name={e.name}
                detail={quantityLabel(e.quantity)}
                calories={e.nutrition.calories}
                macros={e.nutrition}
                onClick={() => onSelectEntry(e)}
              />
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 && <div className="h-3" />}
    </Card>
  )
}
