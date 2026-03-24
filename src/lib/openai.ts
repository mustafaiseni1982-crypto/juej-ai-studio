import { openAiProxyEnabled } from './env'
import { apiUrl } from './apiBase'
import { OPENROUTER_CHAT_MODEL_SLUG } from './openRouterConstants'
import { logOpenRouterRequest } from './openRouterDebug'
import { openRouterChatCompletion } from './openRouter'

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function humanizeProxyChatError(message: string): string {
  const m = message.trim()
  if (/missing authentication header/i.test(m)) {
    return 'Çelësi OpenRouter nuk është i konfiguruar në server. Vendos OPENROUTER_API_KEY në mjedisin e proxy-t (pa hapësira të panevojshme) dhe rinise serverin. Ose çaktivizo proxy-n (VITE_OPENAI_PROXY) dhe shto çelësin te Cilësimet.'
  }
  return m
}

async function parseCompletionResponse(res: Response): Promise<string> {
  if (!res.ok) {
    let msg = res.statusText
    try {
      const err = (await res.json()) as { error?: { message?: string } }
      if (err.error?.message) msg = err.error.message
    } catch {
      /* ignore */
    }
    throw new Error(humanizeProxyChatError(msg))
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Përgjigje e zbrazët nga API.')
  return text
}

export async function chatCompletion(
  messages: OpenAIMessage[],
  apiKey: string,
  model: string,
  options?: { openRouterKey?: string },
): Promise<string> {
  const orKey = options?.openRouterKey?.trim()
  if (orKey && !openAiProxyEnabled) {
    return openRouterChatCompletion(
      messages,
      orKey,
      OPENROUTER_CHAT_MODEL_SLUG,
    )
  }

  if (openAiProxyEnabled) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const k = options?.openRouterKey?.trim()
    const proxyModel = k ? 'gpt-4o-mini' : model
    const endpoint = apiUrl('/api/chat')
    if (k) {
      headers.Authorization = `Bearer ${k}`
      logOpenRouterRequest('proxy/api/chat', {
        apiKey: k,
        endpoint,
        model: OPENROUTER_CHAT_MODEL_SLUG,
      })
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages, model: proxyModel }),
    })
    return parseCompletionResponse(res)
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.65,
    }),
  })

  return parseCompletionResponse(res)
}
