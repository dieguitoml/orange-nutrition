/**
 * Frontend service entry point. Screens use `api` (via the hooks in ./queries); it is the
 * adapter over the real local-first backend in `nutrition_app/`.
 */
import type { NutritionBackend } from '@/core/services'
import { orangeBackend } from './orangeBackend'

export const api: NutritionBackend = orangeBackend
export { requestPersistentStorage } from './orangeBackend'

/** True for backend errors meaning local storage can't be used (e.g. Safari private browsing). */
export const isStorageUnavailable = (e: unknown) => (e as { code?: string } | null)?.code === 'UNAVAILABLE'
