import { Images, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { Food, MealType, PhotoAnalysis } from '@/core/types'
import { FoodListItem } from '@/components/food/FoodListItem'
import { FoodSearchInput } from '@/components/food/FoodSearchInput'
import { MealPicker } from '@/components/food/MealPicker'
import { NutritionCard } from '@/components/NutritionCard'
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Emoji, foodEmoji } from '@/lib/emoji'
import { MEAL_LABELS, kcal } from '@/lib/format'
import { cn } from '@/lib/utils'
import { api } from '@/services'
import { useAiStatus, useAnalyzePhoto, useFoodPreview, useFoodSearch, useLogPhotoMeal, usePhotoTotals, useSetPhotoEnabled } from '@/services/queries'

interface ItemState {
  id: string
  name: string
  confidence: number
  matches: Food[]
  foodId: string | null
  grams: number
}

const GRAM = { label: 'g', grams: 1 }

/** Take/choose a meal photo → Gemini names the foods → user confirms matches & grams → log. */
export function PhotoTab({ meal: initialMeal, date }: { meal: MealType; date: string }) {
  const status = useAiStatus()
  const setPhoto = useSetPhotoEnabled()
  const analyze = useAnalyzePhoto()
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const [hint, setHint] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<PhotoAnalysis | null>(null)
  const [items, setItems] = useState<ItemState[]>([])
  const [meal, setMeal] = useState<MealType>(initialMeal)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a photo')
      return
    }
    setError(null)
    setResult(null)
    setPreview(URL.createObjectURL(file))
    try {
      const r = await analyze.mutateAsync({ image: file, meal, hint })
      setResult(r)
      setItems(
        r.items.map((i) => ({
          id: i.id,
          name: i.name,
          confidence: i.confidence,
          matches: i.matches,
          foodId: i.selectedFoodId,
          grams: Math.max(1, Math.round(i.estimatedGrams)),
        })),
      )
    } catch (err) {
      setError(err)
    }
  }

  function reset() {
    if (result?.photoId) void api.photo.discard(result.photoId).catch(() => {})
    setResult(null)
    setItems([])
    setError(null)
    setPreview(null)
  }

  const pickers = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </>
  )

  // ── AI not set up ──
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />
  if (!status.data) return <LoadingState rows={2} />
  const s = status.data
  if (!s.photoAvailable) {
    const ready = s.hasApiKey && s.consentAccepted
    return (
      <Card>
        <EmptyState
          emoji="📸"
          title="Log a meal from a photo"
          message={
            ready
              ? 'Turn on photo recognition to let Gemini spot the foods on your plate. You confirm everything before it’s logged.'
              : 'Snap your plate and Gemini names the foods and estimates portions; nutrition comes from the food database. Needs your own free Gemini API key.'
          }
          action={
            ready ? (
              <Button disabled={setPhoto.isPending} onClick={() => setPhoto.mutate(true, { onSuccess: () => toast.success('Photo recognition on 📸') })}>
                Turn on photo recognition
              </Button>
            ) : (
              <Button onClick={() => navigate('/settings#ai')}>Set up in Settings</Button>
            )
          }
        />
      </Card>
    )
  }

  // ── Analysing ──
  if (analyze.isPending) {
    return (
      <Card className="space-y-4">
        {preview && <img src={preview} alt="Your meal" className="aspect-[4/3] w-full animate-shimmer rounded-2xl object-cover" />}
        <div className="flex items-center justify-center gap-3 py-2" role="status">
          <Spinner /> <span className="text-[15px] text-muted">Recognising your meal… 🤖</span>
        </div>
      </Card>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="space-y-3">
        <ErrorState error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={reset}>
            Try another photo
          </Button>
          <Button variant="soft" onClick={() => navigate('/add?tab=search')}>
            Search instead
          </Button>
        </div>
        {pickers}
      </div>
    )
  }

  // ── Review ──
  if (result) {
    if (!result.isFood || items.length === 0) {
      return (
        <Card className="space-y-4">
          {preview && <img src={preview} alt="Your photo" className="aspect-[4/3] w-full rounded-2xl object-cover" />}
          <EmptyState emoji="🤔" title="I couldn’t spot any food" message={result.description || 'Try a closer, well-lit photo of the plate.'} />
          <Button className="w-full" onClick={reset}>
            <RotateCcw className="size-4" /> Try another photo
          </Button>
        </Card>
      )
    }
    return (
      <PhotoReview
        preview={preview}
        result={result}
        items={items}
        setItems={setItems}
        meal={meal}
        setMeal={setMeal}
        date={date}
        onRetake={reset}
        onLogged={() => navigate('/')}
      />
    )
  }

  // ── Start ──
  return (
    <div className="space-y-4">
      <Card className="flex flex-col items-center py-8 text-center">
        <div className="grid size-18 place-items-center rounded-3xl bg-linear-to-br from-soft to-meal-lunch">
          <Emoji className="text-[36px]">📸</Emoji>
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">Snap your meal</h2>
        <p className="mt-1 max-w-[32ch] text-sm text-muted">
          Gemini names the foods and guesses portions. Nutrition always comes from the food database, and you confirm before anything is logged.
        </p>
        <div className="mt-5 grid w-full max-w-xs gap-2">
          <Button size="lg" onClick={() => cameraRef.current?.click()}>
            📷 Take photo
          </Button>
          <Button size="lg" variant="outline" onClick={() => libraryRef.current?.click()}>
            <Images className="size-4" /> Choose from library
          </Button>
        </div>
      </Card>
      <Card className="space-y-1.5">
        <Label htmlFor="photo-hint">Anything the photo won’t show? (optional)</Label>
        <Input id="photo-hint" placeholder="e.g. no dressing, cooked in olive oil" maxLength={120} value={hint} onChange={(e) => setHint(e.target.value)} />
      </Card>
      <p className="px-2 text-center text-[12px] leading-relaxed text-muted">
        The photo is downscaled on your phone and sent to Google Gemini ({s.model}). Google’s free tier may use it to improve its products.
      </p>
      {pickers}
    </div>
  )
}

function PhotoReview({
  preview,
  result,
  items,
  setItems,
  meal,
  setMeal,
  date,
  onRetake,
  onLogged,
}: {
  preview: string | null
  result: PhotoAnalysis
  items: ItemState[]
  setItems: React.Dispatch<React.SetStateAction<ItemState[]>>
  meal: MealType
  setMeal: (m: MealType) => void
  date: string
  onRetake: () => void
  onLogged: () => void
}) {
  const [searchFor, setSearchFor] = useState<string | null>(null)
  const log = useLogPhotoMeal()
  const confirmed = useMemo(() => items.flatMap((i) => (i.foodId && i.grams > 0 ? [{ foodId: i.foodId, grams: i.grams }] : [])), [items])
  const totals = usePhotoTotals(confirmed)
  const unmatched = items.filter((i) => !i.foodId).length
  const update = (id: string, patch: Partial<ItemState>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  async function submit() {
    try {
      await log.mutateAsync({ date, meal, photoId: result.photoId, items: confirmed })
      toast.success(`${confirmed.length} item${confirmed.length > 1 ? 's' : ''} added to ${MEAL_LABELS[meal]} 📸`)
      onLogged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log the meal')
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex gap-4 p-4">
        {preview && <img src={preview} alt="Your meal" className="size-20 shrink-0 rounded-2xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-muted">✨ Gemini saw</p>
          <p className="text-[15px] leading-snug">{result.description || `${items.length} item${items.length > 1 ? 's' : ''}`}</p>
          <button type="button" onClick={onRetake} className="mt-1 inline-flex min-h-9 items-center gap-1 text-[13px] font-medium text-accent">
            <RotateCcw className="size-3.5" /> Retake
          </button>
        </div>
      </Card>

      <p className="rounded-2xl bg-meal-lunch px-4 py-3 text-[13px] leading-relaxed text-foreground/80">
        ⚖️ Portions are visual estimates. Check each weight and match before logging.
      </p>

      <ul className="space-y-3">
        {items.map((item) => (
          <PhotoItemCard
            key={item.id}
            item={item}
            onChange={(patch) => update(item.id, patch)}
            onRemove={() => setItems((list) => list.filter((i) => i.id !== item.id))}
            onSearch={() => setSearchFor(item.id)}
          />
        ))}
      </ul>

      {confirmed.length > 0 &&
        (totals.data ? (
          <NutritionCard nutrition={totals.data} label={`Total · ${confirmed.length} item${confirmed.length > 1 ? 's' : ''}`} className="bg-soft" />
        ) : (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ))}

      <MealPicker value={meal} onChange={setMeal} />
      {unmatched > 0 && (
        <p className="text-center text-[12.5px] text-muted">
          {unmatched} item{unmatched > 1 ? 's' : ''} without a match won’t be logged — search for it or remove it.
        </p>
      )}
      <Button size="lg" className="w-full" disabled={confirmed.length === 0 || log.isPending} onClick={submit}>
        Add {confirmed.length || ''} item{confirmed.length === 1 ? '' : 's'} to {MEAL_LABELS[meal]}
      </Button>

      <FoodPickerSheet
        open={!!searchFor}
        initialQuery={items.find((i) => i.id === searchFor)?.name ?? ''}
        onClose={() => setSearchFor(null)}
        onPick={(food) => {
          setItems((list) =>
            list.map((i) =>
              i.id === searchFor ? { ...i, foodId: food.id, matches: [food, ...i.matches.filter((m) => m.id !== food.id)] } : i,
            ),
          )
          setSearchFor(null)
        }}
      />
    </div>
  )
}

function PhotoItemCard({
  item,
  onChange,
  onRemove,
  onSearch,
}: {
  item: ItemState
  onChange: (p: Partial<ItemState>) => void
  onRemove: () => void
  onSearch: () => void
}) {
  const food = item.matches.find((m) => m.id === item.foodId) ?? null
  const preview = useFoodPreview(item.foodId, { amount: item.grams, serving: GRAM })
  const setGrams = (g: number) => onChange({ grams: Math.max(0, Math.round(g)) })
  const pct = Math.round(item.confidence * 100)

  return (
    <li>
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2">
            <Emoji className="text-[22px]">{foodEmoji(food?.name ?? item.name, food?.category)}</Emoji>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-semibold capitalize leading-snug">{item.name}</p>
            <p className={cn('text-[12px] font-medium', pct >= 70 ? 'text-sage' : pct >= 40 ? 'text-warning' : 'text-danger')}>
              {pct >= 70 ? 'Confident' : pct >= 40 ? 'Not sure' : 'Low confidence'} · {pct}%
            </p>
          </div>
          <button type="button" aria-label={`Remove ${item.name}`} onClick={onRemove} className="grid size-11 place-items-center rounded-full text-muted active:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`match-${item.id}`}>Food in the database</Label>
          {item.matches.length > 0 ? (
            <select
              id={`match-${item.id}`}
              value={item.foodId ?? ''}
              onChange={(e) => (e.target.value === '__search' ? onSearch() : onChange({ foodId: e.target.value || null }))}
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              {!item.foodId && <option value="">Choose a match…</option>}
              {item.matches.slice(0, 6).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.brand ? ` (${m.brand})` : ''}
                </option>
              ))}
              <option value="__search">🔍 Search for another…</option>
            </select>
          ) : (
            <Button variant="soft" className="w-full" onClick={onSearch}>
              🔍 No match — search the database
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-1 rounded-2xl bg-surface-2 p-1">
            <button type="button" aria-label="Less" onClick={() => setGrams(item.grams - 10)} className="grid size-11 place-items-center rounded-xl bg-surface shadow-sm">
              <Minus className="size-4" />
            </button>
            <label className="flex flex-1 items-baseline justify-center gap-1">
              <span className="sr-only">Grams of {item.name}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={item.grams}
                onChange={(e) => setGrams(Number(e.target.value))}
                className="w-16 bg-transparent text-center text-[20px] font-semibold outline-none tabular"
              />
              <span className="text-sm text-muted">g</span>
            </label>
            <button type="button" aria-label="More" onClick={() => setGrams(item.grams + 10)} className="grid size-11 place-items-center rounded-xl bg-surface shadow-sm">
              <Plus className="size-4" />
            </button>
          </div>
          <div className="w-20 text-right">
            {item.foodId ? (
              preview.data ? (
                <>
                  <p className="tabular text-[17px] font-semibold">{kcal(preview.data.calories)}</p>
                  <p className="text-[11.5px] text-muted">kcal</p>
                </>
              ) : (
                <Skeleton className="ml-auto h-8 w-14" />
              )
            ) : (
              <p className="text-[12px] text-muted">—</p>
            )}
          </div>
        </div>
      </Card>
    </li>
  )
}

function FoodPickerSheet({
  open,
  initialQuery,
  onClose,
  onPick,
}: {
  open: boolean
  initialQuery: string
  onClose: () => void
  onPick: (f: Food) => void
}) {
  const [q, setQ] = useState('')
  const results = useFoodSearch(q)
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Find the right food" description={initialQuery ? `Gemini called it “${initialQuery}”` : undefined} className="h-[85dvh]">
      <div className="sticky top-0 z-10 bg-background pb-3">
        <FoodSearchInput key={initialQuery} onDebouncedChange={setQ} placeholder="Search foods" />
      </div>
      {!q ? (
        <p className="py-6 text-center text-sm text-muted">Type a food name 🔍</p>
      ) : !results.data ? (
        <LoadingState />
      ) : results.data.length === 0 ? (
        <EmptyState emoji="🔎" title="No matches" message="Try a simpler word, or create it as a custom food." />
      ) : (
        <ul className="divide-y divide-border/70">
          {results.data.map((f) => (
            <li key={f.id}>
              <FoodListItem emoji={foodEmoji(f.name, f.category)} name={f.name} detail={[f.brand, 'per 100 g'].filter(Boolean).join(' · ')} calories={f.per100g.calories} onClick={() => onPick(f)} />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
