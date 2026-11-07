import { ChefHat, PenLine, ScanBarcode, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { MEAL_TYPES, type MealType } from '@/core/types'
import { PageHeader } from '@/components/PageHeader'
import { SegmentedControl } from '@/components/ui/segmented'
import { mealForNow, relativeDayLabel } from '@/lib/dates'
import { MEAL_LABELS } from '@/lib/format'
import { useSelectedDate } from '@/lib/selectedDate'
import { SearchTab } from './SearchTab'
import { ScanTab } from './ScanTab'
import { CustomFoodForm } from './CustomFoodForm'
import { RecipesTab } from './RecipesTab'

type Tab = 'search' | 'scan' | 'custom' | 'recipes'
const TABS: Tab[] = ['search', 'scan', 'custom', 'recipes']

export function AddFoodScreen() {
  const [params, setParams] = useSearchParams()
  const { date } = useSelectedDate()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'search') as Tab
  const mealParam = params.get('meal') as MealType | null
  const meal: MealType = mealParam && MEAL_TYPES.includes(mealParam) ? mealParam : mealForNow()

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v))
    setParams(next, { replace: true })
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Add food"
        subtitle={
          <span>
            Logging to <b className="font-semibold text-foreground">{MEAL_LABELS[meal]}</b> · {relativeDayLabel(date)}
          </span>
        }
      />
      <SegmentedControl
        label="Entry method"
        value={tab}
        onChange={(t) => update({ tab: t, barcode: null })}
        className="mb-5"
        options={[
          { value: 'search', label: 'Search', icon: <Search className="size-4" /> },
          { value: 'scan', label: 'Scan', icon: <ScanBarcode className="size-4" /> },
          { value: 'custom', label: 'Custom', icon: <PenLine className="size-4" /> },
          { value: 'recipes', label: 'Recipes', icon: <ChefHat className="size-4" /> },
        ]}
      />
      {tab === 'search' && <SearchTab meal={meal} date={date} />}
      {tab === 'scan' && <ScanTab meal={meal} date={date} onCreateCustom={(code) => update({ tab: 'custom', barcode: code })} />}
      {tab === 'custom' && <CustomFoodForm meal={meal} date={date} barcode={params.get('barcode') ?? undefined} />}
      {tab === 'recipes' && <RecipesTab meal={meal} date={date} />}
    </div>
  )
}
