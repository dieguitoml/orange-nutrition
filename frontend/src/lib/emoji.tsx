import type { MealType } from '@/core/types'
import { cn } from './utils'

/** Decorative emoji: hidden from screen readers (the adjacent text carries the meaning). */
export function Emoji({ children, className }: { children: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('emoji inline-block', className)}>
      {children}
    </span>
  )
}

export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍲',
  snacks: '🍎',
}

export const MEAL_TINT: Record<MealType, string> = {
  breakfast: 'bg-meal-breakfast',
  lunch: 'bg-meal-lunch',
  dinner: 'bg-meal-dinner',
  snacks: 'bg-meal-snacks',
}

export const MACRO_EMOJI = { protein: '💪', carbs: '🍞', fat: '🥑', fiber: '🌾', calories: '🔥' } as const

// Name keywords first (most specific wins), then the backend's food category.
const BY_NAME: [RegExp, string][] = [
  [/\begg/, '🥚'], [/banana/, '🍌'], [/apple/, '🍎'], [/avocado/, '🥑'], [/orange|clementine|mandarin/, '🍊'],
  [/lemon|lime/, '🍋'], [/strawberr/, '🍓'], [/blueberr/, '🫐'], [/grape/, '🍇'], [/watermelon|melon/, '🍉'],
  [/pineapple/, '🍍'], [/mango/, '🥭'], [/peach|apricot|nectarine/, '🍑'], [/pear/, '🍐'], [/cherr/, '🍒'],
  [/kiwi/, '🥝'], [/coconut/, '🥥'], [/tomato/, '🍅'], [/carrot/, '🥕'], [/broccoli|cauliflower/, '🥦'],
  [/spinach|lettuce|kale|chard|cabbage/, '🥬'], [/potato/, '🥔'], [/sweet potato|yam/, '🍠'], [/corn/, '🌽'],
  [/pepper/, '🫑'], [/cucumber|zucchini/, '🥒'], [/onion/, '🧅'], [/garlic/, '🧄'], [/mushroom/, '🍄'],
  [/eggplant|aubergine/, '🍆'], [/lentil|bean|chickpea|pea\b|tofu|soy/, '🫘'], [/rice/, '🍚'],
  [/pasta|spaghetti|noodle|macaroni/, '🍝'], [/bread|toast|baguette/, '🍞'], [/oat|cereal|granola|muesli|porridge/, '🥣'],
  [/yogurt|yoghurt|kefir/, '🥛'], [/milk/, '🥛'], [/cheese|mozzarella|cheddar|feta/, '🧀'], [/butter/, '🧈'],
  [/chicken|turkey|duck/, '🍗'], [/bacon|ham|pork|sausage/, '🥓'], [/beef|steak|lamb|veal/, '🥩'],
  [/salmon|tuna|cod|sardine|tilapia|trout|fish|hake|mackerel/, '🐟'], [/shrimp|prawn|crab|lobster/, '🦐'],
  [/almond|walnut|cashew|hazelnut|pistachio|nut\b|nuts/, '🥜'], [/peanut/, '🥜'], [/olive/, '🫒'],
  [/honey/, '🍯'], [/chocolate|cocoa/, '🍫'], [/cookie|biscuit/, '🍪'], [/cake|muffin|pastry|croissant/, '🥐'],
  [/ice cream/, '🍨'], [/coffee|espresso/, '☕'], [/tea\b/, '🍵'], [/juice/, '🧃'], [/water/, '💧'],
  [/wine/, '🍷'], [/beer/, '🍺'], [/pizza/, '🍕'], [/burger/, '🍔'], [/sandwich|wrap/, '🥪'],
  [/soup|stew|broth/, '🍲'], [/salad/, '🥗'], [/quinoa|couscous|barley|buckwheat|wheat|grain/, '🌾'],
]

const BY_CATEGORY: Record<string, string> = {
  fruits: '🍎', vegetables: '🥦', meat: '🥩', poultry: '🍗', fish: '🐟', seafood: '🦐', eggs: '🥚',
  dairy: '🧀', grains: '🌾', legumes: '🫘', nuts_seeds: '🥜', oils_fats: '🫒', sweeteners: '🍯',
  condiments: '🧂', spices: '🌶️', beverages: '🥤', sweets: '🍫', prepared: '🍱', recipe: '👩‍🍳',
}

export function foodEmoji(name: string, category?: string): string {
  const n = name.toLowerCase()
  // "Sweet potato" must beat "potato".
  if (/sweet potato|yam/.test(n)) return '🍠'
  for (const [re, e] of BY_NAME) if (re.test(n)) return e
  return (category && BY_CATEGORY[category]) || '🍽️'
}

export function greetingEmoji(now = new Date()) {
  const h = now.getHours()
  if (h >= 5 && h < 12) return '☀️'
  if (h >= 12 && h < 19) return '🌤️'
  return '🌙'
}
