import { CalendarDays, House, Leaf, Plus, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/nutrients', label: 'Nutrients', icon: Leaf },
  { to: '/add', label: 'Add Food', icon: Plus, primary: true },
  { to: '/assistant', label: 'Ideas', icon: Sparkles, aria: 'Recommendations' },
  { to: '/history', label: 'History', icon: CalendarDays },
]

export function BottomNavigation() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/85 pb-[var(--safe-bottom)] backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-lg items-stretch justify-around px-2">
        {TABS.map(({ to, label, icon: Icon, end, primary, aria }) => (
          <li key={to} className="flex flex-1">
            <NavLink
              to={to}
              end={end}
              aria-label={aria ?? label}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              {({ isActive }) =>
                primary ? (
                  <span
                    className={cn(
                      'grid size-12 place-items-center rounded-full bg-accent text-white shadow-[0_6px_16px_-4px_rgba(49,92,66,0.55)] transition active:scale-95 dark:text-background',
                      isActive && 'ring-4 ring-soft',
                    )}
                  >
                    <Icon className="size-6" strokeWidth={2.4} />
                  </span>
                ) : (
                  <>
                    <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 1.9} />
                    <span>{label}</span>
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
