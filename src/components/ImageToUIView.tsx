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
import { apiUrl } from '../lib/apiBase'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { OPENROUTER_CHAT_MODEL_SLUG } from '../lib/openRouterConstants'
import { logOpenRouterRequest } from '../lib/openRouterDebug'
import { optionalOpenRouterBearerHeaders } from '../lib/openRouterAuthHeaders'
import { getEffectiveOpenRouterKey } from '../lib/storage'
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

3) A section starting with the heading ## Explanation (markdown h2) that describes:
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
  explanation: string
} {
  let html =
    extractFence(raw, 'html') ??
    extractFence(raw, 'htm') ??
    null
  let css = extractFence(raw, 'css') ?? null

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
    explanation,
  }
}

/** Full HTML document for iframe — mimics a real page. */
function buildSrcDoc(html: string, css: string): string {
  const safeCss = css.replace(/<\/style/gi, '<\\/style')
  const base = `*,*::before,*::after{box-sizing:border-box}html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}body{margin:0}`
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${base}\n${safeCss}</style></head><body>${html}</body></html>`
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

function humanizeImageToUiError(message: string): string {
  const m = message.trim()
  if (/did not match the expected pattern/i.test(m)) {
    return 'The image could not be processed. Try a smaller PNG or JPG, or re-export the screenshot.'
  }
  if (/missing authentication header|401/i.test(m)) {
    return 'Mungon çelësi OpenRouter. Aktivizo OpenRouter te Cilësimet dhe fut API key, ose vendos OPENROUTER_API_KEY në serverin e proxy-t.'
  }
  return m
}

async function postImageToUi(
  payload: {
    model: string
    prompt: string
    imageDataUrl: string
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
    let msg = res.statusText || 'Request failed'
    try {
      const j = (await res.json()) as { error?: { message?: string } }
      if (j.error?.message) msg = j.error.message
    } catch {
      /* ignore */
    }
    throw new Error(humanizeImageToUiError(msg))
  }
  let data: { output?: string; reply?: string }
  try {
    data = (await res.json()) as { output?: string; reply?: string }
  } catch {
    throw new Error('Invalid response from API. Try again.')
  }
  const out = data.output ?? data.reply
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('The model returned an empty response. Try again.')
  }
  return out
}

/**
 * Decode, optionally downscale, and re-encode as JPEG data URL for OpenRouter vision
 * (IANA image/jpeg + stable base64; avoids blob: URLs and bad MIME from the OS).
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

  let w = bitmap.width
  let h = bitmap.height
  if (w < 1 || h < 1) {
    bitmap.close()
    throw new Error('This image has invalid dimensions.')
  }
  const maxSide = Math.max(w, h)
  if (maxSide > MAX_VISION_SIDE) {
    const scale = MAX_VISION_SIDE / maxSide
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not process the image in this browser.')
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  const compact = dataUrl.replace(/\s/g, '')
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(compact)) {
    throw new Error('Could not encode the image for upload. Try another file.')
  }
  return dataUrl
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
    if (settings.useOpenRouter && !getEffectiveOpenRouterKey(settings)) {
      setApiError('Fut OpenRouter API Key te cilësimet dhe ruaj.')
      onNeedSettings?.()
      return
    }
    setLoading('analyze')
    setApiError(null)
    setRawReply(null)

    const phaseTimer = window.setTimeout(() => setLoading('generate'), 500)

    try {
      const auth = optionalOpenRouterBearerHeaders(settings)
      const visionModel = settings.useOpenRouter
        ? OPENROUTER_CHAT_MODEL_SLUG
        : 'openai/gpt-4o'
      const raw = await postImageToUi(
        {
          model: visionModel,
          prompt: VISION_PROMPT,
          imageDataUrl: dataUrl,
        },
        auth,
      )
      setRawReply(raw)
      const parsed = parseAiOutput(raw)
      setHtml(parsed.html)
      setCss(parsed.css)
      setExplanation(parsed.explanation)
      setRightTab('preview')
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : 'Request failed.'
      setApiError(humanizeImageToUiError(rawMsg))
    } finally {
      window.clearTimeout(phaseTimer)
      setLoading('idle')
    }
  }, [dataUrl, isBusy, onNeedSettings, settings])

  const copyCode = useCallback(() => {
    const block = `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}`
    void copyToClipboard(block, { emptyHint: 'Nothing to copy yet' })
  }, [copyToClipboard, css, html])

  const previewBundle = useMemo(() => {
    const hasDesign = html.trim() !== '' || css.trim() !== ''
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
        srcDoc: buildSrcDoc(html, css),
        buildError: null as string | null,
        hasDesign: true,
        contentKey: `${html.length}-${css.length}-${crypto.randomUUID()}`,
      }
    } catch {
      return {
        srcDoc: EMPTY_PREVIEW_DOC,
        buildError: 'Preview could not render' as const,
        hasDesign: true,
        contentKey: 'build-error',
      }
    }
  }, [html, css])

  const loadingLabel =
    loading === 'analyze'
      ? 'Analyzing image…'
      : loading === 'generate'
        ? 'Generating design…'
        : null

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
                        Copy HTML + CSS
                      </button>
                      {copyFeedback ? (
                        <p className="text-xs text-[#3B82F6]" role="status">
                          {copyFeedback}
                        </p>
                      ) : null}
                    </div>
                    <pre className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-[#0A0F2C] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/85">
                      {html || css
                        ? `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}`
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
