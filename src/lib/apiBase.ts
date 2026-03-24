/**
 * URL e plotë për kërkesa API. Lokal: bosh → rrugët relative `/api/...` (proxy Vite).
 * Në Firebase Hosting: vendos `VITE_API_BASE_URL` në build (URL e backend-it që ekspozon /api).
 */
export function apiUrl(path: string): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
  const base = raw.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
