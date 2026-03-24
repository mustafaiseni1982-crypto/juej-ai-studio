import { Copy, ImageUp, Loader2, Monitor, Smartphone, Tablet } from 'lucide-react'
import type { DragEvent } from 'react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  apiUrl,
  productionNeedsApiBaseUrlBanner,
} from '../lib/apiBase'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { OPENROUTER_VISION_MODEL_SLUG } from '../lib/openRouterConstants'
import { logOpenRouterRequest } from '../lib/openRouterDebug'
import { openRouterBearerFromStoredKey } from '../lib/openRouterAuthHeaders'
import type { AppSettings } from '../types'

const ACCEPT = 'image/png,image/jpeg,image/jpg'
const MAX_BYTES = 5 * 1024 * 1024
/** Downscale before API so payloads stay well under provider limits. */
const MAX_VISION_SIDE = 2048

const VISION_PROMPT = `You are a UI/UX expert and frontend developer.

Analyze the attached UI screenshot and recreate it.

Tasks:
1. Identify layout (header, sections, buttons, typography)
2. Recreate the design using HTML + CSS (no external CSS frameworks)
3. Make it responsive (mobile-friendly)
4. Improve spacing or contrast slightly if it helps usability
5. Use a clean, modern style

You MUST return your answer in this exact structure:

1) A markdown fenced code block with language tag html containing markup for the BODY only (no <!DOCTYPE>, no <html>, no <head>, no <body> tags — only inner content that can be placed inside <body>).

2) A markdown fenced code block with language tag css containing all styles needed.

3) A markdown fenced code block with language tag javascript (or js). Use it for any client-side behavior; if none is needed, include an empty block or a comment only — the fence must still be present.

4) A section starting with the heading ## Explanation (markdown h2) that describes:
   - Layout structure
   - Main UI components
   - Colors and typography choices
   - What you improved compared to the screenshot

Do not paste the image as base64 in your reply.`

type RightTab = 'code' | 'preview' | 'explanation'

type LoadingPhase = 'idle' | 'analyze' | 'generate'

function extractFence(text: string, lang: string): string | null {
  const re = new RegExp(
    '```\\s*' + lang + '\\s*\\n([\\s\\S]*?)```',
    'i',
  )
  const m = text.match(re)
  return m ? m[1].trim() : null
}

function parseAiOutput(raw: string): {
  html: string
  css: string
  js: string
  explanation: string
} {
  let html =
    extractFence(raw, 'html') ??
    extractFence(raw, 'htm') ??
    null
  let css = extractFence(raw, 'css') ?? null
  let js =
    extractFence(raw, 'javascript') ?? extractFence(raw, 'js') ?? null

  if (!html) {
    const generic = raw.match(/```(?:\w+)?\s*\n([\s\S]*?)```/)
    if (generic && generic[1].includes('<')) {
      html = generic[1].trim()
    }
  }

  const exMatch = raw.match(/##\s*Explanation\s*([\s\S]*?)(?=\n##\s|$)/i)
  let explanation = exMatch ? exMatch[1].trim() : ''

  if (!explanation) {
    explanation = raw
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^#+\s*Explanation\s*/im, '')
      .trim()
  }
  if (!explanation) explanation = '_No explanation block found; see raw response in Code tab._'

  return {
    html: html ?? '<!-- Could not parse HTML from response -->',
    css: css ?? '/* Could not parse CSS from response */',
    js: js ?? '',
    explanation,
  }
}

/** Full HTML document for iframe — mimics a real page. */
function buildSrcDoc(html: string, css: string, js: string): string {
  const safeCss = css.replace(/<\/style>/gi, '<\\/style>')
  const safeJs = (js || '').replace(/<\/script>/gi, '<\\/script>')
  const base = `*,*::before,*::after{box-sizing:border-box}html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}body{margin:0}`
  const scriptBlock = safeJs.trim()
    ? `<script>${safeJs}<\/script>`
    : ''
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${base}\n${safeCss}</style></head><body>${html}${scriptBlock}</body></html>`
}

const EMPTY_PREVIEW_DOC =
  '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:#f1f5f9"></body></html>'

type ViewportMode = 'desktop' | 'tablet' | 'mobile'
type ZoomPct = 100 | 75 | 50

const PREVIEW_URL = 'https://preview.juej.app'

type BrowserPreviewFrameProps = {
  srcDoc: string
  /** True when AI produced HTML or CSS to show */
  hasDesign: boolean
  buildError: string | null
  /** Changes when HTML/CSS changes — resets enter animation */
  contentKey: string
}

const BrowserPreviewFrame = memo(function BrowserPreviewFrame({
  srcDoc,
  hasDesign,
  buildError,
  contentKey,
}: BrowserPreviewFrameProps) {
  const [viewport, setViewport] = useState<ViewportMode>('desktop')
  const [zoom, setZoom] = useState<ZoomPct>(100)
  const [enterReady, setEnterReady] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setEnterReady(false)
    setLoadError(false)
  }, [contentKey])

  const viewportOuterWidth =
    viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '768px' : '375px'

  const showError = buildError ?? (loadError ? 'Preview could not render' : null)
  const blockIframe = Boolean(buildError || loadError)

  return (
    <div
      className="flex min-h-[min(520px,58vh)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1f35] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      style={{ borderRadius: 16 }}
    >
      {/* Browser chrome */}
      <div className="shrink-0 rounded-t-2xl bg-[#252b42] px-3 pb-2 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 pl-1" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28CA41]" />
          </div>
          <div className="flex min-h-[32px] min-w-0 flex-1 items-center rounded-lg bg-[#0A0F2C]/90 px-3 text-[11px] text-white/45 shadow-inner ring-1 ring-white/5">
            <span className="truncate font-mono text-white/55">{PREVIEW_URL}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex rounded-lg bg-[#0A0F2C]/60 p-0.5 ring-1 ring-white/10"
            role="group"
            aria-label="Viewport"
          >
            {(
              [
                { id: 'desktop' as const, label: 'Desktop', Icon: Monitor },
                { id: 'tablet' as const, label: 'Tablet', Icon: Tablet },
                { id: 'mobile' as const, label: 'Mobile', Icon: Smartphone },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewport(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  viewport === id
                    ? 'bg-[#3B82F6] text-white shadow-sm'
                    : 'text-white/55 hover:bg-white/5 hover:text-white/85'
                }`}
              >
                <Icon className="h-3.5 w-3.5 opacity-90" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <div
            className="flex rounded-lg bg-[#0A0F2C]/60 p-0.5 ring-1 ring-white/10"
            role="group"
            aria-label="Zoom"
          >
            {([100, 75, 50] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`min-w-[44px] rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                  zoom === z
                    ? 'bg-white/15 text-white'
                    : 'text-white/45 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                {z}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative min-h-0 flex-1 overflow-auto bg-[#0A0F2C] p-4">
        {!hasDesign && !showError && (
          <p className="py-12 text-center text-sm text-white/35">
            Generate design to see the live preview.
          </p>
        )}

        {showError && (
          <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-8 text-center text-sm text-amber-100/90">
            {showError}
          </div>
        )}

        {hasDesign && !blockIframe && (
          <div
            className="mx-auto"
            style={{
              width: viewportOuterWidth,
              maxWidth: '100%',
            }}
          >
            <div
              className="overflow-hidden rounded-b-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
              style={{
                opacity: enterReady ? 1 : 0,
                transform: `scale(${(zoom / 100) * (enterReady ? 1 : 0.98)})`,
                transformOrigin: 'top center',
                transition:
                  'opacity 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <iframe
                key={contentKey}
                title="UI preview"
                sandbox="allow-scripts allow-same-origin"
                srcDoc={srcDoc}
                onLoad={() => {
                  setLoadError(false)
                  requestAnimationFrame(() => setEnterReady(true))
                }}
                onError={() => setLoadError(true)}
                className="block min-h-[min(440px,50vh)] w-full border-0 bg-white"
                style={{ minHeight: 440 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

BrowserPreviewFrame.displayName = 'BrowserPreviewFrame'

/** Firebase / SPA: përgjigja ishte index.html, jo JSON. */
const ERR_HOSTING_SPA_FALLBACK = 'HOSTING_SPA_FALLBACK_NO_JSON_API'
const ERR_INVALID_API_JSON = 'INVALID_API_JSON_BODY'

function humanizeImageToUiError(message: string): string {
  const m = message.trim()
  if (m === ERR_HOSTING_SPA_FALLBACK) {
    return 'Në këtë sajt (Firebase) nuk ka server për /api/ai — kthehet faqja e aplikacionit në vend të JSON. Zgjidhje: vendos në .env.production VITE_API_BASE_URL=https://URL-e-serverit-tënd (Node me /api/ai + OPENROUTER_API_KEY), pastaj npm run build dhe ridploy. Lokal: npm run server dhe VITE_OPENAI_PROXY=true.'
  }
  if (m === ERR_INVALID_API_JSON) {
    return 'Përgjigja nga serveri nuk ishte JSON i pritshëm (shpesh për shkak të mungesës së backend-it në prodhim). Kontrollo VITE_API_BASE_URL dhe që /api/ai kthejë { output } ose { reply }.'
  }
  if (/did not match the expected pattern/i.test(m)) {
    return 'The image could not be processed. Try a smaller PNG or JPG, or re-export the screenshot.'
  }
  if (/missing authentication header|401/i.test(m)) {
    return 'Mungon çelësi OpenRouter. Fut OpenRouter API key te Cilësimet (ruhet edhe kur OpenRouter është off), ose vendos OPENROUTER_API_KEY në serverin e proxy-t.'
  }
  return m
}

/**
 * Lexon trupin e përgjigjes së suksessit: { output|reply }, ose formë OpenAI-style { choices[0].message.content }.
 */
function extractReplyFromApiSuccessBody(raw: string): string {
  const t = raw.trim()
  if (!t) {
    throw new Error(ERR_HOSTING_SPA_FALLBACK)
  }
  const head = t.slice(0, 800).toLowerCase()
  if (
    head.includes('<!doctype html') ||
    (head.includes('<html') && head.includes('</head>'))
  ) {
    throw new Error(ERR_HOSTING_SPA_FALLBACK)
  }

  let data: unknown
  try {
    data = JSON.parse(t)
  } catch {
    throw new Error(ERR_INVALID_API_JSON)
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error(ERR_INVALID_API_JSON)
  }

  const o = data as Record<string, unknown>
  const direct = o.output ?? o.reply
  if (typeof direct === 'string' && direct.trim()) {
    return direct
  }

  const choices = o.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const first = choices[0] as {
      message?: { content?: unknown }
    }
    const c = first.message?.content
    if (typeof c === 'string' && c.trim()) {
      return c
    }
    if (Array.isArray(c)) {
      const text = c
        .filter(
          (p): p is { type: string; text: string } =>
            typeof p === 'object' &&
            p !== null &&
            (p as { type?: string }).type === 'text' &&
            typeof (p as { text?: string }).text === 'string',
        )
        .map((p) => p.text)
        .join('')
      if (text.trim()) return text
    }
  }

  throw new Error(ERR_INVALID_API_JSON)
}

async function postImageToUi(
  payload: {
    model: string
    prompt: string
    /** Data URL e plotë: data:image/jpeg;base64,... (si `image` në /api/ai). */
    image: string
  },
  authHeaders: Record<string, string>,
): Promise<string> {
  const bearer = authHeaders.Authorization?.replace(/^Bearer\s+/i, '')?.trim()
  if (bearer) {
    logOpenRouterRequest('imageToUi/api/ai', {
      apiKey: bearer,
      endpoint: apiUrl('/api/ai'),
      model: payload.model,
    })
  }

  let res: Response
  try {
    res = await fetch(apiUrl('/api/ai'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error(
      'Could not reach the API server. Check your connection and that the dev server proxy is running.',
    )
  }
  if (!res.ok) {
    const rawText = await res.text()
    let msg = res.statusText || 'Request failed'
    try {
      const j = JSON.parse(rawText) as {
        error?: { message?: string } | string
        message?: string
      }
      console.error('[ImageToUI] /api/ai error', res.status, rawText)
      if (typeof j.error === 'object' && j.error !== null && 'message' in j.error) {
        const em = (j.error as { message?: string }).message
        if (typeof em === 'string') msg = em
        else msg = JSON.stringify(j.error).slice(0, 400)
      } else if (typeof j.error === 'string') msg = j.error
      else if (j.error != null && typeof j.error === 'object')
        msg = JSON.stringify(j.error).slice(0, 400)
      else if (typeof j.message === 'string') msg = j.message
    } catch {
      console.error('[ImageToUI] /api/ai error (non-JSON)', res.status, rawText)
      if (rawText.trim()) msg = rawText.slice(0, 500)
    }
    throw new Error(humanizeImageToUiError(msg))
  }

  const rawBody = await res.text()
  let out: string
  try {
    out = extractReplyFromApiSuccessBody(rawBody)
  } catch (e) {
    const code = e instanceof Error ? e.message : ''
    if (code === ERR_HOSTING_SPA_FALLBACK || code === ERR_INVALID_API_JSON) {
      console.error('[ImageToUI] Bad success body (first 400 chars):', rawBody.slice(0, 400))
      throw new Error(humanizeImageToUiError(code))
    }
    throw new Error('Invalid response from API. Try again.')
  }
  if (!out.trim()) {
    throw new Error('The model returned an empty response. Try again.')
  }
  return out
}

/** Target max length for data URL to stay under typical provider limits after JSON wrapping. */
const MAX_DATA_URL_CHARS = 4_200_000

/**
 * Produces a data URL for `POST /api/ai` body field `image` (same as `readAsDataURL`, plus resize/JPEG).
 * Shembull i thjeshtë me FileReader: `new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(file); })`.
 */
async function prepareImageForVision(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Image must be under ${MAX_BYTES / (1024 * 1024)} MB.`)
  }
  const name = file.name.toLowerCase()
  const extOk = /\.(png|jpe?g)$/i.test(name)
  const type = file.type.trim().toLowerCase()
  const typeOk =
    type === '' ||
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/jpg'
  if (!extOk && !typeOk) {
    throw new Error('Use PNG or JPG only.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Could not read this image. Try another PNG or JPG.')
  }

  try {
    const iw = bitmap.width
    const ih = bitmap.height
    if (iw < 1 || ih < 1) {
      throw new Error('This image has invalid dimensions.')
    }

    let tw = iw
    let th = ih
    const maxSide0 = Math.max(tw, th)
    if (maxSide0 > MAX_VISION_SIDE) {
      const scale = MAX_VISION_SIDE / maxSide0
      tw = Math.max(1, Math.round(tw * scale))
      th = Math.max(1, Math.round(th * scale))
    }

    let quality = 0.88

    const encode = (): string => {
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not process the image in this browser.')
      ctx.drawImage(bitmap, 0, 0, tw, th)
      return canvas.toDataURL('image/jpeg', quality)
    }

    let dataUrl = encode()
    while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.48) {
      quality -= 0.08
      dataUrl = encode()
    }
    while (
      dataUrl.length > MAX_DATA_URL_CHARS &&
      Math.max(tw, th) > 720
    ) {
      tw = Math.max(480, Math.round(tw * 0.82))
      th = Math.max(480, Math.round(th * 0.82))
      quality = Math.min(quality, 0.72)
      dataUrl = encode()
    }

    const compact = dataUrl.replace(/\s/g, '')
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(compact)) {
      throw new Error('Could not encode the image for upload. Try another file.')
    }
    return dataUrl
  } finally {
    bitmap.close()
  }
}

export interface ImageToUIViewProps {
  settings: AppSettings
  onNeedSettings?: () => void
}

export default function ImageToUIView({
  settings,
  onNeedSettings,
}: ImageToUIViewProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [js, setJs] = useState('')
  const [explanation, setExplanation] = useState('')
  const [rawReply, setRawReply] = useState<string | null>(null)

  const [rightTab, setRightTab] = useState<RightTab>('preview')
  const [loading, setLoading] = useState<LoadingPhase>('idle')
  const [apiError, setApiError] = useState<string | null>(null)
  const { copy: copyToClipboard, feedback: copyFeedback } = useCopyFeedback()

  const isBusy = loading !== 'idle'

  const applyFile = useCallback(async (file: File | null) => {
    if (!file) return
    setUploadError(null)
    try {
      const url = await prepareImageForVision(file)
      setDataUrl(url)
      setRawReply(null)
      setHtml('')
      setCss('')
      setJs('')
      setExplanation('')
      setApiError(null)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Invalid file.')
      setDataUrl(null)
    }
  }, [])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const f = e.dataTransfer.files?.[0]
      void applyFile(f ?? null)
    },
    [applyFile],
  )

  const generate = useCallback(async () => {
    if (!dataUrl || isBusy) return
    setLoading('analyze')
    setApiError(null)
    setRawReply(null)

    const phaseTimer = window.setTimeout(() => setLoading('generate'), 500)

    try {
      const auth = openRouterBearerFromStoredKey(settings)
      const raw = await postImageToUi(
        {
          model: OPENROUTER_VISION_MODEL_SLUG,
          prompt: VISION_PROMPT,
          image: dataUrl,
        },
        auth,
      )
      setRawReply(raw)
      const parsed = parseAiOutput(raw)
      setHtml(parsed.html)
      setCss(parsed.css)
      setJs(parsed.js)
      setExplanation(parsed.explanation)
      setRightTab('preview')
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : 'Request failed.'
      setApiError(humanizeImageToUiError(rawMsg))
    } finally {
      window.clearTimeout(phaseTimer)
      setLoading('idle')
    }
  }, [dataUrl, isBusy, settings])

  const copyCode = useCallback(() => {
    const block = `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}${js.trim() ? `\n\n// JS\n${js}` : ''}`
    void copyToClipboard(block, { emptyHint: 'Nothing to copy yet' })
  }, [copyToClipboard, css, html, js])

  const previewBundle = useMemo(() => {
    const hasDesign =
      html.trim() !== '' || css.trim() !== '' || js.trim() !== ''
    if (!hasDesign) {
      return {
        srcDoc: EMPTY_PREVIEW_DOC,
        buildError: null as string | null,
        hasDesign: false,
        contentKey: 'empty',
      }
    }
    try {
      return {
        srcDoc: buildSrcDoc(html, css, js),
        buildError: null as string | null,
        hasDesign: true,
        contentKey: `${html.length}-${css.length}-${js.length}-${crypto.randomUUID()}`,
      }
    } catch {
      return {
        srcDoc: EMPTY_PREVIEW_DOC,
        buildError: 'Preview could not render' as const,
        hasDesign: true,
        contentKey: 'build-error',
      }
    }
  }, [html, css, js])

  const loadingLabel =
    loading === 'analyze'
      ? 'Analyzing image…'
      : loading === 'generate'
        ? 'Generating design…'
        : null

  const showProdApiBanner = productionNeedsApiBaseUrlBanner()

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0F2C] text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Image to UI</h1>
        <p className="mt-1 text-xs text-white/55">
          Upload a screenshot → GPT-4o vision → HTML, CSS, preview, and explanation.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {showProdApiBanner ? (
            <div
              role="status"
              className="rounded-xl border border-amber-500/50 bg-amber-950/35 px-3 py-3 text-sm leading-relaxed text-amber-100/95"
            >
              <p className="font-semibold text-amber-100">Backend për Image to UI</p>
              <p className="mt-1 text-xs text-amber-100/85">
                Në këtë build nuk është vendosur{' '}
                <code className="rounded bg-black/30 px-1 font-mono text-[11px]">
                  VITE_API_BASE_URL
                </code>
                . Hosting statik nuk ekzekuton{' '}
                <code className="rounded bg-black/30 px-1 font-mono text-[11px]">
                  /api/ai
                </code>{' '}
                — duhet një server (p.sh. Node me proxy OpenRouter) dhe URL e tij në{' '}
                <code className="rounded bg-black/30 px-1 font-mono text-[11px]">
                  .env.production
                </code>{' '}
                para build.
              </p>
            </div>
          ) : null}
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-[#121836]/90 px-4 py-8 transition hover:border-[#3B82F6]/50 hover:bg-[#121836]"
          >
            <ImageUp className="mb-2 h-10 w-10 text-[#3B82F6]" aria-hidden />
            <p className="text-center text-sm text-white/80">
              Drag &amp; drop image or click to upload
            </p>
            <p className="mt-1 text-center text-xs text-white/45">
              PNG or JPG · max {MAX_BYTES / (1024 * 1024)} MB
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                void applyFile(f ?? null)
                e.target.value = ''
              }}
            />
          </div>

          {uploadError && (
            <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {uploadError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={!dataUrl || isBusy}
              className="inline-flex min-h-[48px] touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-6 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(59,130,246,0.35)] transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : null}
              Generate Design
            </button>
            {loadingLabel && (
              <span className="text-sm text-[#3B82F6]">{loadingLabel}</span>
            )}
            {onNeedSettings && (
              <button
                type="button"
                onClick={onNeedSettings}
                className="text-xs font-medium text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
              >
                Settings
              </button>
            )}
          </div>

          {apiError && (
            <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {apiError}
            </p>
          )}

          <div className="grid min-h-[min(60vh,560px)] gap-4 lg:grid-cols-2 lg:items-stretch">
            <div className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#121836]/80 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/45">
                Uploaded image
              </p>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#0A0F2C]">
                {dataUrl ? (
                  <img
                    src={dataUrl}
                    alt="Upload preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <p className="text-sm text-white/35">No image yet</p>
                )}
              </div>
            </div>

            <div className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#121836]/80">
              <div
                role="tablist"
                className="flex border-b border-white/10"
                aria-label="Output"
              >
                {(
                  [
                    { id: 'code' as const, label: 'Code' },
                    { id: 'preview' as const, label: 'Preview' },
                    { id: 'explanation' as const, label: 'Explanation' },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={rightTab === id}
                    onClick={() => setRightTab(id)}
                    className={`min-h-[44px] flex-1 rounded-none px-2 text-center text-sm font-medium transition first:rounded-tl-2xl last:rounded-tr-2xl ${
                      rightTab === id
                        ? 'border-b-2 border-[#3B82F6] text-[#3B82F6]'
                        : 'text-white/55 hover:text-white/80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-hidden p-3">
                {rightTab === 'code' && (
                  <div className="flex h-full min-h-[280px] flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => void copyCode()}
                        className="inline-flex w-fit min-h-[44px] touch-manipulation items-center gap-1.5 rounded-lg border border-white/15 bg-[#0A0F2C] px-3 py-2 text-xs font-semibold text-white/90 hover:border-[#3B82F6]/40"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy HTML + CSS + JS
                      </button>
                      {copyFeedback ? (
                        <p className="text-xs text-[#3B82F6]" role="status">
                          {copyFeedback}
                        </p>
                      ) : null}
                    </div>
                    <pre className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-[#0A0F2C] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/85 select-text">
                      {html || css || js
                        ? `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}${js.trim() ? `\n\n// JS\n${js}` : ''}`
                        : rawReply ?? 'Generate design to see code here.'}
                    </pre>
                  </div>
                )}

                {rightTab === 'preview' && (
                  <BrowserPreviewFrame
                    srcDoc={previewBundle.srcDoc}
                    hasDesign={previewBundle.hasDesign}
                    buildError={previewBundle.buildError}
                    contentKey={previewBundle.contentKey}
                  />
                )}

                {rightTab === 'explanation' && (
                  <div className="h-[min(480px,55vh)] overflow-y-auto rounded-xl border border-white/10 bg-[#0A0F2C] p-4 text-sm text-white/85 [&_a]:text-[#3B82F6] [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:text-white [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
                    {explanation ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {explanation}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-white/40">
                        Generate design to see the explanation.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
