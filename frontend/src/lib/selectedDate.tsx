import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ISODate } from '@/core/types'
import { todayISO } from './dates'

interface Ctx {
  date: ISODate
  setDate: (d: ISODate) => void
}

const SelectedDateContext = createContext<Ctx | null>(null)

/** The diary day being viewed — shared by Today, Add Food, Nutrients and History. */
export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<ISODate>(todayISO)
  const value = useMemo(() => ({ date, setDate }), [date])
  return <SelectedDateContext.Provider value={value}>{children}</SelectedDateContext.Provider>
}

export function useSelectedDate() {
  const ctx = useContext(SelectedDateContext)
  if (!ctx) throw new Error('useSelectedDate must be used inside SelectedDateProvider')
  return ctx
}
