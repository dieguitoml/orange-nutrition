import type { ThemePreference } from '@/core/types'

const KEY = 'nourish-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Applies the theme and remembers it locally so index.html can avoid a flash on load. */
export function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  const color = dark ? '#17120F' : '#FFF9F3'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* ignore */
  }
}

export function watchSystemTheme(pref: ThemePreference) {
  if (pref !== 'system') return () => {}
  const m = media()
  const fn = () => applyTheme('system')
  m.addEventListener('change', fn)
  return () => m.removeEventListener('change', fn)
}
