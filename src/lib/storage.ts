import type { AppSettings, Conversation } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const SETTINGS_KEY = 'juej-ai-code-settings'
const HISTORY_KEY = 'juej-ai-code-history'

function pickModel(
  v: unknown,
): 'gpt-4o' | 'gpt-4o-mini' {
  return v === 'gpt-4o' || v === 'gpt-4o-mini' ? v : 'gpt-4o-mini'
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      model: pickModel(parsed.model),
      voiceEnabled:
        typeof parsed.voiceEnabled === 'boolean'
          ? parsed.voiceEnabled
          : DEFAULT_SETTINGS.voiceEnabled,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
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
