import type { CompareModelId } from '../types'
import { apiUrl, humanizeFetchNetworkError } from './apiBase'
import {
  errorMessageFromApiJson,
  parseJsonFromResponse,
} from './parseApiJson'
import type { OpenAIMessage } from './openai'

/**
 * Dërgon mesazhet te modeli i zgjedhur përmes `/api/ai` në Railway.
 * Çelësat janë vetëm në server.
 */
export async function callAI(
  modelId: CompareModelId,
  messages: OpenAIMessage[],
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  let res: Response
  try {
    res = await fetch(apiUrl('/api/ai'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ modelId, messages }),
    })
  } catch (e) {
    throw humanizeFetchNetworkError(e)
  }

  const data = await parseJsonFromResponse<{
    reply?: string
    output?: string
    error?: { message?: string } | string
  }>(res)

  if (!res.ok) {
    throw new Error(errorMessageFromApiJson(data, res.statusText))
  }

  const text = data.reply ?? data.output
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Përgjigje e zbrazët nga API.')
  }
  return text
}
