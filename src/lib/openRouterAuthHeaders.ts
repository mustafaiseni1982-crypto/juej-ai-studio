import type { AppSettings } from '../types'
import { getEffectiveOpenRouterKey } from './storage'

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
