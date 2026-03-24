import type { AppSettings } from '../types'
import {
  getEffectiveOpenRouterKey,
  readOpenRouterKeyFromLocalStorage,
} from './storage'

/**
 * Për `/api/ai` dhe `/api/chat`: serveri përdor OPENROUTER_API_KEY nga mjedisi nëse ekziston,
 * përndryshe `Authorization` nga klienti (`openrouter_api_key` / Cilësimet).
 */
export function optionalOpenRouterBearerHeaders(
  settings: AppSettings,
): Record<string, string> {
  if (settings.useOpenRouter !== true) return {}
  const t = getEffectiveOpenRouterKey(settings)
  if (!t) return {}
  return { Authorization: `Bearer ${t}` }
}

/**
 * Për kërkesa multimodale (Image → UI): dërgo Bearer nëse ka çelës të ruajtur,
 * edhe kur `useOpenRouter` është off — biseda mund të përdorë OpenAI direkt, por vision kalon nga OpenRouter.
 */
export function openRouterBearerFromStoredKey(
  settings: AppSettings,
): Record<string, string> {
  const t =
    settings.openRouterApiKey?.trim() || readOpenRouterKeyFromLocalStorage()
  if (!t) return {}
  return { Authorization: `Bearer ${t}` }
}
