import { format, isToday, isYesterday, isTomorrow, parseISO } from 'date-fns'
import type { ISODate } from '@/core/types'

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd')
export const todayISO = () => toISO(new Date())
export const fromISO = (d: ISODate) => parseISO(d)

export function relativeDayLabel(d: ISODate) {
  const date = parseISO(d)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE')
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'Good evening'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Suggest a meal for "now" when opening Add Food without context. */
export function mealForNow(now = new Date()) {
  const h = now.getHours()
  if (h < 11) return 'breakfast' as const
  if (h < 15) return 'lunch' as const
  if (h < 21) return 'dinner' as const
  return 'snacks' as const
}
