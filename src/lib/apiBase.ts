/**
 * Bazë e backend-it nga build (Firebase → Railway). `path` duhet të fillojë me `/`.
 * Vendos `VITE_API_BASE_URL=https://….up.railway.app` (pa slash në fund).
 */
export const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').trim()

export function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

/** Safari/iOS: "Load failed" / TypeError kur fetch nuk arrin serverin. */
export function humanizeFetchNetworkError(error: unknown): Error {
  const msg = error instanceof Error ? error.message : String(error)
  const looksNetwork =
    error instanceof TypeError ||
    /load failed|failed to fetch|networkerror|aborted/i.test(msg)
  if (looksNetwork) {
    const baseHint = API_BASE
      ? ''
      : ' `VITE_API_BASE_URL` mungon në build — kërkesat shkojnë te hosting (SPA), jo te Railway.'
    throw new Error(
      `Nuk u lidh me serverin.${baseHint} Kontrollo URL-në e Railway (HTTPS), internetin dhe ribuild-in e Firebase.`,
    )
  }
  return error instanceof Error ? error : new Error(String(error))
}
