import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'

/** Registers the service worker and tells the user once the app is ready offline. */
export function PwaUpdater() {
  const { offlineReady: [offlineReady, setOfflineReady] } = useRegisterSW({ immediate: true })
  useEffect(() => {
    if (offlineReady) {
      toast.success('Ready to use offline')
      setOfflineReady(false)
    }
  }, [offlineReady, setOfflineReady])
  return null
}
