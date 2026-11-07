import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from './components/AppShell'
import { LoadingState } from './components/States'
import { applyTheme, watchSystemTheme } from './lib/theme'
import { SelectedDateProvider } from './lib/selectedDate'
import { usePreferences } from './services/queries'
import { requestPersistentStorage } from './services'
import { TodayScreen } from './screens/Today'
import { PwaUpdater } from './components/PwaUpdater'

const AddFoodScreen = lazy(() => import('./screens/AddFood').then((m) => ({ default: m.AddFoodScreen })))
const NutrientsScreen = lazy(() => import('./screens/Nutrients').then((m) => ({ default: m.NutrientsScreen })))
const AssistantScreen = lazy(() => import('./screens/Assistant').then((m) => ({ default: m.AssistantScreen })))
const HistoryScreen = lazy(() => import('./screens/History').then((m) => ({ default: m.HistoryScreen })))
const SettingsScreen = lazy(() => import('./screens/Settings').then((m) => ({ default: m.SettingsScreen })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
})

function ThemeSync() {
  const prefs = usePreferences()
  const theme = prefs.data?.theme
  useEffect(() => {
    if (!theme) return
    applyTheme(theme)
    return watchSystemTheme(theme)
  }, [theme])
  return null
}

/** Ask once, after the first tap, for storage that the browser won't evict. */
function PersistStorage() {
  useEffect(() => {
    const onFirst = () => void requestPersistentStorage()
    window.addEventListener('pointerdown', onFirst, { once: true })
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [])
  return null
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SelectedDateProvider>
        <ThemeSync />
        <PersistStorage />
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<TodayScreen />} />
              <Route path="add" element={<Lazy><AddFoodScreen /></Lazy>} />
              <Route path="nutrients" element={<Lazy><NutrientsScreen /></Lazy>} />
              <Route path="assistant" element={<Lazy><AssistantScreen /></Lazy>} />
              <Route path="history" element={<Lazy><HistoryScreen /></Lazy>} />
              <Route path="settings" element={<Lazy><SettingsScreen /></Lazy>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
        <Toaster
          position="top-center"
          offset="calc(env(safe-area-inset-top) + 12px)"
          toastOptions={{
            className: '!rounded-2xl !border-border !bg-surface !text-foreground !shadow-lg',
          }}
        />
        <PwaUpdater />
      </SelectedDateProvider>
    </QueryClientProvider>
  )
}

const Lazy = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingState rows={4} className="pt-16" />}>{children}</Suspense>
)
