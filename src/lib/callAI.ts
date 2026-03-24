import type { CompareModelId } from '../types'
import { apiUrl } from './apiBase'
import { openAiProxyEnabled } from './env'
import type { OpenAIMessage } from './openai'
import { OPENROUTER_CHAT_MODEL_SLUG } from './openRouterConstants'
import { logOpenRouterRequest } from './openRouterDebug'
import { openRouterChatCompletion } from './openRouter'

async function parseOpenAiCompatibleResponse(res: Response): Promise<string> {
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
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Përgjigje e zbrazët nga API.')
  return text
}

function openAiMessagesUrl(modelId: CompareModelId): {
  url: string
  model: string
} {
  if (modelId === 'openai/gpt-4o') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o',
    }
  }
  if (modelId === 'deepseek/deepseek-chat') {
    return {
      url: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
    }
  }
  throw new Error('Model i pambuluar për OpenAI-format.')
}

async function anthropicCompletion(
  messages: OpenAIMessage[],
  apiKey: string,
): Promise<string> {
  const systemParts: string[] = []
  const rest: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content)
      continue
    }
    if (m.role === 'user' || m.role === 'assistant') {
      const last = rest[rest.length - 1]
      if (last && last.role === m.role) {
        last.content = `${last.content}\n\n${m.content}`
      } else {
        rest.push({ role: m.role, content: m.content })
      }
    }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      temperature: 0.65,
      system: systemParts.join('\n\n').trim() || undefined,
      messages: rest,
    }),
  })

  if (!res.ok) {
    let msg = res.statusText
    try {
      const err = (await res.json()) as {
        error?: { message?: string; type?: string }
      }
      if (err.error?.message) msg = err.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }

  const data = (await res.json()) as {
    content?: { type?: string; text?: string }[]
  }
  const parts =
    data.content
      ?.filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string) ?? []
  const text = parts.join('')
  if (!text) throw new Error('Përgjigje e zbrazët nga Anthropic.')
  return text
}

export interface CallAiKeys {
  openai: string
  anthropic: string
  deepseek: string
  useOpenRouter: boolean
  openRouterKey: string
}

/**
 * Dërgon mesazhet te modeli i zgjedhur (OpenAI, Anthropic ose DeepSeek).
 * Me proxy: përdor /api/ai në server.
 */
export async function callAI(
  modelId: CompareModelId,
  messages: OpenAIMessage[],
  keys: CallAiKeys,
): Promise<string> {
  const resolvedModelId: CompareModelId = keys.useOpenRouter
    ? (OPENROUTER_CHAT_MODEL_SLUG as CompareModelId)
    : modelId

  if (openAiProxyEnabled) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const k = keys.openRouterKey?.trim()
    if (keys.useOpenRouter && k) {
      headers.Authorization = `Bearer ${k}`
      logOpenRouterRequest('proxy/api/ai', {
        apiKey: k,
        endpoint: apiUrl('/api/ai'),
        model: OPENROUTER_CHAT_MODEL_SLUG,
      })
    }

    const res = await fetch(apiUrl('/api/ai'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ modelId: resolvedModelId, messages }),
    })
    if (!res.ok) {
      let msg = res.statusText
      try {
        const err = (await res.json()) as { error?: { message?: string } }
        if (err.error?.message) msg = err.error.message
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
    const data = (await res.json()) as { reply?: string; output?: string }
    const text = data.reply ?? data.output
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Përgjigje e zbrazët nga proxy.')
    }
    return text
  }

  const orKey = keys.openRouterKey?.trim()
  if (keys.useOpenRouter && !!orKey) {
    return openRouterChatCompletion(
      messages,
      orKey,
      OPENROUTER_CHAT_MODEL_SLUG,
    )
  }

  if (modelId === 'anthropic/claude-3.5-sonnet') {
    if (!keys.anthropic.trim()) {
      throw new Error(
        'Shto Anthropic API Key te cilësimet ose aktivizo proxy me ANTHROPIC_API_KEY në server.',
      )
    }
    return anthropicCompletion(messages, keys.anthropic.trim())
  }

  const { url, model } = openAiMessagesUrl(modelId)
  const key =
    modelId === 'deepseek/deepseek-chat'
      ? keys.deepseek.trim()
      : keys.openai.trim()
  if (!key) {
    throw new Error(
      modelId === 'deepseek/deepseek-chat'
        ? 'Shto DeepSeek API Key te cilësimet ose aktivizo proxy me DEEPSEEK_API_KEY në server.'
        : 'Shto OpenAI API Key te cilësimet ose aktivizo proxy të serverit.',
    )
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.65,
    }),
  })

  return parseOpenAiCompatibleResponse(res)
}
