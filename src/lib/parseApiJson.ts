/**
 * Lexon trupin si tekst, pastaj JSON — shmang gabimin kur serveri / hosting kthen HTML (SPA).
 */
function responseLooksLikeHtml(text: string): boolean {
  const t = text.trimStart().slice(0, 96).toLowerCase()
  return (
    t.startsWith('<!doctype') ||
    t.startsWith('<html') ||
    t.startsWith('<head') ||
    (t.startsWith('<') && /<html[\s>]/i.test(text.slice(0, 512)))
  )
}

export async function parseJsonFromResponse<T = unknown>(
  res: Response,
): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(`Përgjigje e zbrazët nga serveri (HTTP ${res.status}).`)
  }
  if (responseLooksLikeHtml(text)) {
    throw new Error(
      'Serveri ktheu HTML në vend të JSON. Zakonisht `VITE_API_BASE_URL` nuk është në build ose URL është i gabuar — vendos URL-në e Railway dhe ribuild për Firebase.',
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    const hint = text.slice(0, 120).replace(/\s+/g, ' ')
    throw new Error(
      `Përgjigje jo-JSON nga API (HTTP ${res.status}). ${hint}`,
    )
  }
}

/** Mesazh nga trupi `{ error: { message } }` ose `{ error: string }`. */
export function errorMessageFromApiJson(
  data: unknown,
  fallback: string,
): string {
  if (!data || typeof data !== 'object') return fallback
  const err = (data as { error?: { message?: string } | string }).error
  if (typeof err === 'object' && err && typeof err.message === 'string') {
    const m = err.message.trim()
    return m || fallback
  }
  if (typeof err === 'string') {
    const m = err.trim()
    return m || fallback
  }
  return fallback
}
