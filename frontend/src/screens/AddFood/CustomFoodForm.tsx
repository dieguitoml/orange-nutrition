import { zodResolver } from '@hookform/resolvers/zod'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { NUTRIENTS, type MealType, type MicronutrientKey } from '@/core/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldError, Input, Label } from '@/components/ui/input'
import { MEAL_LABELS } from '@/lib/format'
import { useAddEntry, useCreateCustomFood } from '@/services/queries'

const isNum = (v: string) => v !== '' && Number.isFinite(Number(v))
const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(isNum, 'Enter a number')
    .refine((v) => Number(v) >= 0, 'Must be 0 or more')
    .refine((v) => Number(v) <= max, `Must be ${max} or less`)
    .transform(Number)
const optional = z
  .string()
  .trim()
  .refine((v) => v === '' || (isNum(v) && Number(v) >= 0), 'Enter a number ≥ 0')
  .transform((v) => (v === '' ? undefined : Number(v)))

const OPTIONAL_MICROS: MicronutrientKey[] = ['sugar', 'saturatedFat', 'sodium', 'potassium', 'calcium', 'iron', 'vitaminC', 'vitaminD', 'vitaminA', 'magnesium']

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Keep it under 80 characters'),
    brand: z.string().trim().max(60),
    servingLabel: z.string().trim().min(1, 'Describe the serving').max(30),
    servingGrams: required('Serving weight', 5000).refine((v) => v > 0, 'Must be more than 0'),
    calories: required('Calories', 5000),
    protein: required('Protein', 500),
    carbs: required('Carbohydrates', 500),
    fat: required('Fat', 500),
    fiber: required('Fiber', 200),
    micros: z.object(Object.fromEntries(OPTIONAL_MICROS.map((k) => [k, optional])) as Record<MicronutrientKey, typeof optional>),
  })
  .refine((v) => v.protein + v.carbs + v.fat <= v.servingGrams + 0.5, {
    path: ['servingGrams'],
    message: 'Protein + carbs + fat exceed the serving weight',
  })
  .refine((v) => v.fiber <= v.carbs + 0.5 || v.carbs === 0, { path: ['fiber'], message: 'Fiber is usually counted within carbohydrates' })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

const emptyMicros = Object.fromEntries(OPTIONAL_MICROS.map((k) => [k, ''])) as Record<MicronutrientKey, string>

export function CustomFoodForm({ meal, date, barcode }: { meal: MealType; date: string; barcode?: string }) {
  const create = useCreateCustomFood()
  const add = useAddEntry()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', brand: '', servingLabel: '1 serving', servingGrams: '100', calories: '', protein: '', carbs: '', fat: '', fiber: '0', micros: emptyMicros },
    mode: 'onTouched',
  })

  const submit = (andLog: boolean) =>
    handleSubmit(async (v) => {
      try {
        const micros = Object.fromEntries(Object.entries(v.micros).filter(([, x]) => x !== undefined)) as Record<MicronutrientKey, number>
        const serving = { label: v.servingLabel, grams: v.servingGrams }
        const food = await create.mutateAsync({
          name: v.name,
          brand: v.brand || undefined,
          barcode,
          serving,
          perServing: { calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat, fiber: v.fiber, micros },
        })
        if (andLog) {
          await add.mutateAsync({ date, meal, foodId: food.id, quantity: { amount: 1, serving } })
          toast.success(`${food.name} added to ${MEAL_LABELS[meal]}`)
        } else {
          toast.success(`${food.name} saved to your foods`)
        }
        reset()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save food')
      }
    })

  const field = (name: keyof Omit<FormIn, 'micros'>, label: string, opts: { unit?: string; numeric?: boolean; placeholder?: string } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cf-${name}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`cf-${name}`}
          inputMode={opts.numeric ? 'decimal' : undefined}
          autoComplete="off"
          placeholder={opts.placeholder}
          aria-invalid={!!errors[name]}
          className={opts.unit ? 'pr-12' : undefined}
          {...register(name)}
        />
        {opts.unit && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{opts.unit}</span>}
      </div>
      <FieldError>{errors[name]?.message}</FieldError>
    </div>
  )

  return (
    <form onSubmit={submit(true)} noValidate className="space-y-4">
      {barcode && (
        <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-accent">
          This food will be saved with barcode <b>{barcode}</b>, so scanning it next time finds it instantly.
        </p>
      )}
      <Card className="space-y-4">
        {field('name', 'Name', { placeholder: 'e.g. Homemade granola' })}
        {field('brand', 'Brand (optional)')}
        <div className="grid grid-cols-2 gap-3">
          {field('servingLabel', 'Serving', { placeholder: '1 bowl' })}
          {field('servingGrams', 'Weight', { unit: 'g', numeric: true })}
        </div>
      </Card>
      <Card className="space-y-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Per serving</p>
        {field('calories', 'Calories', { unit: 'kcal', numeric: true })}
        <div className="grid grid-cols-2 gap-3">
          {field('protein', 'Protein', { unit: 'g', numeric: true })}
          {field('carbs', 'Carbohydrates', { unit: 'g', numeric: true })}
          {field('fat', 'Fat', { unit: 'g', numeric: true })}
          {field('fiber', 'Fiber', { unit: 'g', numeric: true })}
        </div>
      </Card>
      <Collapsible.Root>
        <Card className="p-0">
          <Collapsible.Trigger className="group flex min-h-14 w-full items-center justify-between px-5 text-left">
            <span>
              <span className="block text-[15px] font-semibold">Micronutrients</span>
              <span className="block text-[12.5px] text-muted">Optional — leave blank if unknown, not 0</span>
            </span>
            <ChevronDown className="size-5 text-muted transition group-data-[state=open]:rotate-180" />
          </Collapsible.Trigger>
          <Collapsible.Content className="grid grid-cols-2 gap-3 px-5 pb-5">
            {OPTIONAL_MICROS.map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`cf-m-${k}`}>{NUTRIENTS[k].label}</Label>
                <div className="relative">
                  <Input id={`cf-m-${k}`} inputMode="decimal" className="pr-11" aria-invalid={!!errors.micros?.[k]} {...register(`micros.${k}`)} />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{NUTRIENTS[k].unit}</span>
                </div>
                <FieldError>{errors.micros?.[k]?.message}</FieldError>
              </div>
            ))}
          </Collapsible.Content>
        </Card>
      </Collapsible.Root>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button type="button" variant="outline" size="lg" disabled={isSubmitting} onClick={submit(false)}>
          Save food
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          Save & log
        </Button>
      </div>
    </form>
  )
}
