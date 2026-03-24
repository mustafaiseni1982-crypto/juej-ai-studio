import type { AppSettings, Conversation } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const SETTINGS_KEY = 'juej-ai-code-settings'
const HISTORY_KEY = 'juej-ai-code-history'

/** Burimi kryesor i çelësit OpenRouter (sipas specifikimit). */
export const OPENROUTER_LOCAL_STORAGE_KEY = 'openrouter_api_key'

export function readOpenRouterKeyFromLocalStorage(): string {
  try {
    return localStorage.getItem(OPENROUTER_LOCAL_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function writeOpenRouterKeyToLocalStorage(key: string): void {
  try {
    localStorage.setItem(OPENROUTER_LOCAL_STORAGE_KEY, key)
  } catch {
    /* ignore */
  }
}

/** Me OpenRouter ON: çelësi nga state (UI) ose nga localStorage `openrouter_api_key`. */
export function getEffectiveOpenRouterKey(settings: AppSettings): string {
  if (settings.useOpenRouter !== true) return ''
  const fromState = settings.openRouterApiKey?.trim() ?? ''
  const fromLs = readOpenRouterKeyFromLocalStorage()
  return fromState || fromLs
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const fromLs = readOpenRouterKeyFromLocalStorage()
    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        openRouterApiKey: fromLs || DEFAULT_SETTINGS.openRouterApiKey,
      }
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const fromJson =
      typeof parsed.openRouterApiKey === 'string'
        ? parsed.openRouterApiKey
        : DEFAULT_SETTINGS.openRouterApiKey
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      model: parsed.model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini',
      anthropicApiKey:
        typeof parsed.anthropicApiKey === 'string'
          ? parsed.anthropicApiKey
          : DEFAULT_SETTINGS.anthropicApiKey,
      deepseekApiKey:
        typeof parsed.deepseekApiKey === 'string'
          ? parsed.deepseekApiKey
          : DEFAULT_SETTINGS.deepseekApiKey,
      useOpenRouter:
        typeof parsed.useOpenRouter === 'boolean'
          ? parsed.useOpenRouter
          : DEFAULT_SETTINGS.useOpenRouter,
      openRouterApiKey: fromLs || fromJson,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  writeOpenRouterKeyToLocalStorage(s.openRouterApiKey ?? '')
}

export function loadHistory(): Conversation[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Conversation[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveHistory(list: Conversation[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
}
