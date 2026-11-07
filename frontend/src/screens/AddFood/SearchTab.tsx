import { Clock, SearchX, Star } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Food, MealType } from '@/core/types'
import { FoodDetailSheet } from '@/components/food/FoodDetailSheet'
import { FoodListItem } from '@/components/food/FoodListItem'
import { FoodSearchInput } from '@/components/food/FoodSearchInput'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { useFavoriteFoods, useFoodSearch, useRecentFoods } from '@/services/queries'

export const foodDetail = (f: Food) => [f.brand, 'per 100 g'].filter(Boolean).join(' · ')

export function FoodList({ foods, onSelect }: { foods: Food[]; onSelect: (f: Food) => void }) {
  return (
    <ul className="divide-y divide-border/70">
      {foods.map((f) => (
        <li key={f.id}>
          <FoodListItem name={f.name} detail={foodDetail(f)} calories={f.per100g.calories} favorite={f.isFavorite} onClick={() => onSelect(f)} />
        </li>
      ))}
    </ul>
  )
}

export function SearchTab({ meal, date }: { meal: MealType; date: string }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const results = useFoodSearch(q)
  const recent = useRecentFoods()
  const favorites = useFavoriteFoods()

  return (
    <div>
      <FoodSearchInput onDebouncedChange={setQ} />
      <div className="mt-4">
        {q ? (
          results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : !results.data ? (
            <LoadingState />
          ) : results.data.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-5" />}
              title={`No results for “${q}”`}
              message="Try a simpler term, scan the barcode, or create a custom food."
            />
          ) : (
            <Section title={`${results.data.length} result${results.data.length > 1 ? 's' : ''}`}>
              <FoodList foods={results.data} onSelect={setSelected} />
            </Section>
          )
        ) : (
          <div className="space-y-6">
            <Section title="Favorites" icon={<Star className="size-3.5" />}>
              {favorites.isError ? (
                <ErrorState error={favorites.error} />
              ) : !favorites.data ? (
                <LoadingState rows={2} />
              ) : favorites.data.length ? (
                <FoodList foods={favorites.data} onSelect={setSelected} />
              ) : (
                <p className="py-3 text-sm text-muted">Tap the star on any food to keep it here.</p>
              )}
            </Section>
            <Section title="Recent" icon={<Clock className="size-3.5" />}>
              {recent.isError ? (
                <ErrorState error={recent.error} />
              ) : !recent.data ? (
                <LoadingState rows={2} />
              ) : recent.data.length ? (
                <FoodList foods={recent.data} onSelect={setSelected} />
              ) : (
                <p className="py-3 text-sm text-muted">Foods you log will appear here for quick access.</p>
              )}
            </Section>
          </div>
        )}
      </div>
      <FoodDetailSheet mode="add" food={selected} meal={meal} date={date} onClose={() => setSelected(null)} />
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-1.5 px-1 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </h2>
      <div className="rounded-[var(--radius-card)] border border-border/70 bg-surface px-4">{children}</div>
    </section>
  )
}
