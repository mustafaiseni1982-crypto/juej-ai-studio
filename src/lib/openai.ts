import { apiUrl, humanizeFetchNetworkError } from './apiBase'
import { openAiProxyEnabled } from './env'
import {
  errorMessageFromApiJson,
  parseJsonFromResponse,
} from './parseApiJson'

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function humanizeProxyChatError(message: string): string {
  const m = message.trim()
  if (/missing authentication header/i.test(m)) {
    return 'Mungon autentikimi në backend. Vendos OPENROUTER_API_KEY (ose OPENAI_API_KEY) në Railway.'
  }
  return m
}

async function parseCompletionResponse(res: Response): Promise<string> {
  const data = await parseJsonFromResponse<{
    choices?: { message?: { content?: string } }[]
    error?: { message?: string } | string
  }>(res)

  if (!res.ok) {
    const msg = humanizeProxyChatError(
      errorMessageFromApiJson(data, res.statusText),
    )
    throw new Error(msg)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Përgjigje e zbrazët nga API.')
  return text
}

export async function chatCompletion(
  messages: OpenAIMessage[],
  model: string,
): Promise<string> {
  if (openAiProxyEnabled) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    let res: Response
    try {
      res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, model }),
      })
    } catch (e) {
      throw humanizeFetchNetworkError(e)
    }
    return parseCompletionResponse(res)
  }
  throw new Error('Backend mode required: openAiProxyEnabled must be true.')
}
