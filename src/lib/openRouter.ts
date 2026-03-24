import type { AppSettings, CompareModelId } from '../types'
import type { OpenAIMessage } from './openai'
import { getEffectiveOpenRouterKey } from './storage'
import { logOpenRouterRequest } from './openRouterDebug'

/** OpenRouter aktiv me çelës të vlefshëm (edhe me proxy + Authorization). */
export function clientUsesOpenRouter(settings: AppSettings): boolean {
  return (
    settings.useOpenRouter === true && !!getEffectiveOpenRouterKey(settings)
  )
}

export const OPENROUTER_CHAT_URL =
  'https://openrouter.ai/api/v1/chat/completions'

/** Slug në OpenRouter për modelet e krahasimit (ID-të tona përputhen zakonisht 1:1). */
export function openRouterSlugForCompare(modelId: CompareModelId): string {
  return modelId
}

export function openRouterSlugForChatModel(
  model: 'gpt-4o' | 'gpt-4o-mini',
): string {
  return model === 'gpt-4o' ? 'openai/gpt-4o' : 'openai/gpt-4o-mini'
}

async function parseOpenAiShapeResponse(res: Response): Promise<string> {
  if (!res.ok) {
    let msg = res.statusText
    try {
      const err = (await res.json()) as {
        error?: { message?: string }
        message?: string
      }
      if (err.error?.message) msg = err.error.message
      else if (typeof err.message === 'string') msg = err.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[]
  }
  const text = data.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Përgjigje e zbrazët nga OpenRouter.')
  }
  return text
}

export async function openRouterChatCompletion(
  messages: OpenAIMessage[],
  apiKey: string,
  openRouterModel: string,
): Promise<string> {
  const key = apiKey.trim()
  logOpenRouterRequest('direct', {
    apiKey: key,
    endpoint: OPENROUTER_CHAT_URL,
    model: openRouterModel,
  })

  const referer =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://localhost'

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': referer,
      'X-Title': 'JUEJ AI Code',
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages,
      temperature: 0.65,
    }),
  })

  return parseOpenAiShapeResponse(res)
}
