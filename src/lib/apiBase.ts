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

/** `true` kur kërkesat shkojnë te `/api/...` relative (Vite proxy lokal), jo te një host i jashtëm. */
export function isUsingRelativeApiBase(): boolean {
  return !import.meta.env.VITE_API_BASE_URL?.trim()
}

/**
 * Në prodhim, Firebase `rewrites ** → index.html` bën që POST /api/ai të kthejë HTML — pa backend të veçantë duhet VITE_API_BASE_URL.
 */
export function productionNeedsApiBaseUrlBanner(): boolean {
  return import.meta.env.PROD === true && isUsingRelativeApiBase()
}
