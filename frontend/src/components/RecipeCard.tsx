import { ChefHat, Pencil, Trash } from 'lucide-react'
import type { Recipe } from '@/core/types'
import { grams, kcal } from '@/lib/format'
import { Card } from './ui/card'
import { Button } from './ui/button'

export function RecipeCard({
  recipe,
  onLog,
  onEdit,
  onDelete,
}: {
  recipe: Recipe
  onLog: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const n = recipe.nutrition.perServing
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-soft text-accent">
          <ChefHat className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-semibold tracking-tight">{recipe.name}</h3>
          <p className="text-[12.5px] text-muted">
            {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'} · {recipe.servings} serving
            {recipe.servings === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-[17px] font-semibold">{kcal(n.calories)}</p>
          <p className="text-[11.5px] text-muted">kcal / serving</p>
        </div>
      </div>
      <p className="text-[12.5px] text-muted tabular">
        Protein {grams(n.protein)} g · Carbs {grams(n.carbs)} g · Fat {grams(n.fat)} g · Fiber {grams(n.fiber)} g
      </p>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={onLog}>
          Log
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Edit ${recipe.name}`}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete} aria-label={`Delete ${recipe.name}`}>
          <Trash className="size-4" />
        </Button>
      </div>
    </Card>
  )
}
