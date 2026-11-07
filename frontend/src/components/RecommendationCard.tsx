import { Clock, Plus } from 'lucide-react'
import type { Recommendation } from '@/core/types'
import { grams, kcal } from '@/lib/format'
import { Button } from './ui/button'

export function RecommendationCard({
  rec,
  onAdd,
  onOpen,
}: {
  rec: Recommendation
  onAdd: () => void
  onOpen: () => void
}) {
  const n = rec.nutrition
  return (
    <article className="w-[min(78vw,300px)] shrink-0 snap-start rounded-[22px] border border-border/70 bg-surface p-4">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15.5px] font-semibold leading-snug tracking-tight">{rec.name}</h3>
          {rec.prepMinutes !== null && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11.5px] font-medium text-muted">
              <Clock className="size-3" /> ~{rec.prepMinutes} min
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{rec.ingredients.map((i) => i.name).join(' · ')}</p>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="tabular text-[22px] font-semibold tracking-tight">{kcal(n.calories)}</span>
          <span className="text-[12px] text-muted">kcal</span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted tabular">
          <b className="font-medium text-protein">P</b> {grams(n.protein)} g · <b className="font-medium text-carbs">C</b> {grams(n.carbs)} g ·{' '}
          <b className="font-medium text-fat">F</b> {grams(n.fat)} g · <b className="font-medium text-fiber">Fib</b> {grams(n.fiber)} g
        </p>
        <p className="mt-3 rounded-2xl bg-soft px-3 py-2 text-[12.5px] leading-snug text-accent">{rec.explanation}</p>
      </button>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onOpen}>
          Recipe
        </Button>
        <Button size="sm" className="flex-1" onClick={onAdd}>
          <Plus className="size-4" /> Add to diary
        </Button>
      </div>
    </article>
  )
}
