import { Download, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  buildDesignSrcDoc,
  parseDesignResponse,
  type DesignPayload,
} from '../lib/designPayload'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { openAiProxyEnabled } from '../lib/env'
import { chatCompletion } from '../lib/openai'
import { DESIGN_SYSTEM } from '../lib/prompts'

type DesignTab = 'preview' | 'code' | 'explanation'

interface DesignGeneratorViewProps {
  apiKey: string
  model: string
  /** Kur është true, përdoret vetëm OpenRouter (jo OpenAI key). */
  useOpenRouter?: boolean
  /** Nëse është vendosur, kërkesat kalojnë në OpenRouter në vend të OpenAI të drejtpërdrejtë. */
  openRouterKey?: string
  onNeedSettings: () => void
}

export function DesignGeneratorView({
  apiKey,
  model,
  useOpenRouter = false,
  openRouterKey,
  onNeedSettings,
}: DesignGeneratorViewProps) {
  const [prompt, setPrompt] = useState('')
  const [includeJs, setIncludeJs] = useState(false)
  const [tab, setTab] = useState<DesignTab>('preview')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawReply, setRawReply] = useState<string | null>(null)
  const [payload, setPayload] = useState<DesignPayload | null>(null)
  const { copy: copySnippet, feedback: copyFeedback } = useCopyFeedback()

  const srcDoc = useMemo(
    () => (payload ? buildDesignSrcDoc(payload) : null),
    [payload],
  )

  const generate = useCallback(async () => {
    const text = prompt.trim()
    if (!text || busy) return
    if (!openAiProxyEnabled) {
      const or = openRouterKey?.trim()
      if (useOpenRouter) {
        if (!or) {
          onNeedSettings()
          setError('Fut OpenRouter API Key te cilësimet dhe ruaj.')
          return
        }
      } else if (!or && !apiKey.trim()) {
        onNeedSettings()
        setError(
          'Shto OpenRouter ose OpenAI API Key te cilësimet, ose aktivizo proxy të serverit.',
        )
        return
      }
    }
    setBusy(true)
    setError(null)
    setRawReply(null)
    try {
      const userMsg = `Kërkesa e përdoruesit për dizajn:\n${text}\n\n${
        includeJs
          ? 'Përfshi interaksione të lehta me JavaScript vanilla në fushën "javascript".'
          : 'Mos përfsh JavaScript; vendos "javascript" si string bosh "".'
      }`
      const reply = await chatCompletion(
        [
          { role: 'system', content: DESIGN_SYSTEM },
          { role: 'user', content: userMsg },
        ],
        apiKey,
        model,
        openRouterKey?.trim()
          ? { openRouterKey: openRouterKey.trim() }
          : undefined,
      )
      setRawReply(reply)
      const parsed = parseDesignResponse(reply)
      if (!parsed) {
        setPayload(null)
        setError(
          'Nuk u lexua përgjigja si JSON/HTML i pritur. Provo përsëri ose thjeshtozo kërkesën.',
        )
        return
      }
      setPayload(parsed)
      setTab('preview')
    } catch (e) {
      setPayload(null)
      setError(e instanceof Error ? e.message : 'Gabim i panjohur.')
    } finally {
      setBusy(false)
    }
  }, [
    apiKey,
    busy,
    includeJs,
    model,
    onNeedSettings,
    openRouterKey,
    prompt,
    useOpenRouter,
  ])

  const downloadHtml = useCallback(() => {
    if (!payload) return
    const full = buildDesignSrcDoc(payload)
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'juej-design.html'
    a.click()
    URL.revokeObjectURL(url)
  }, [payload])

  const tabs: { id: DesignTab; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'code', label: 'Code' },
    { id: 'explanation', label: 'Explanation' },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FAFAFA] lg:flex-row">
      <section className="flex w-full shrink-0 flex-col border-b border-[#E5E7EB] bg-white lg:w-[min(100%,400px)] lg:border-b-0 lg:border-r">
        <div className="border-b border-[#E5E7EB] px-4 py-4">
          <h1 className="text-base font-semibold text-[#0A0F2C]">Design</h1>
          <p className="mt-1 text-xs text-[#1F2937]/60">
            Përshkruaj UI-in; merr parapamje, kod dhe shpjegim.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <label className="sr-only" htmlFor="design-prompt">
            Përshkrimi i dizajnit
          </label>
          <textarea
            id="design-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
            placeholder="Describe the design you want (e.g. landing page, login form...)"
            rows={8}
            autoComplete="off"
            spellCheck
            className="relative z-[1] min-h-[160px] w-full resize-y rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#1F2937] shadow-inner transition placeholder:text-[#1F2937]/40 focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 disabled:opacity-60"
          />

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 transition hover:border-[#3B82F6]/25">
            <input
              type="checkbox"
              checked={includeJs}
              onChange={(e) => setIncludeJs(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 rounded border-[#E5E7EB] text-[#3B82F6] focus:ring-[#3B82F6]/30"
            />
            <span className="text-sm font-medium text-[#1F2937]">
              Gjenero edhe JS (interaksione)
            </span>
          </label>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || !prompt.trim()}
            className="inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#3B82F6] text-sm font-semibold text-white shadow-[0_4px_14px_rgba(59,130,246,0.22)] transition duration-200 hover:scale-[1.02] hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden />
            )}
            Generate Design
          </button>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </section>

      <section className="flex min-h-[min(50vh,480px)] min-w-0 flex-1 flex-col bg-white lg:min-h-0">
        <div
          role="tablist"
          aria-label="Rezultati i dizajnit"
          className="flex shrink-0 gap-1 border-b border-[#E5E7EB] px-2 pt-2 sm:px-4"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-t-lg px-4 py-2 text-sm font-semibold transition duration-200 hover:scale-[1.02] ${
                tab === t.id
                  ? 'bg-[#3B82F6] text-white shadow-[0_2px_8px_rgba(59,130,246,0.2)]'
                  : 'text-[#1F2937]/70 hover:bg-[#F3F4F6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === 'preview' && (
            <div className="flex h-full min-h-[280px] flex-col">
              <iframe
                title="Parapamje dizajni"
                className="h-full w-full flex-1 border-0 bg-[#F3F4F6]"
                sandbox="allow-scripts allow-same-origin"
                srcDoc={
                  srcDoc ??
                  '<!DOCTYPE html><html><body style="margin:0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#64748b;font-size:14px">Shtyp <b>Generate Design</b> për parapamje.</body></html>'
                }
              />
            </div>
          )}

          {tab === 'code' && (
            <div className="h-full overflow-y-auto p-4 space-y-6">
              {copyFeedback ? (
                <p className="text-center text-sm font-medium text-[#3B82F6]">
                  {copyFeedback}
                </p>
              ) : null}
              {!payload ? (
                <p className="text-center text-sm text-[#1F2937]/55">
                  Kodi shfaqet pasi të gjenerosh një dizajn.
                </p>
              ) : (
                <>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0A0F2C]">
                        HTML
                      </span>
                      <button
                        type="button"
                        onClick={() => void copySnippet(payload.html)}
                        className="touch-manipulation rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-xs font-semibold text-[#1F2937] transition hover:scale-[1.02] hover:border-[#3B82F6]/40"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="max-h-[220px] overflow-auto rounded-xl border border-[#E5E7EB] bg-[#1E1E1E] p-4 font-mono text-[13px] leading-relaxed text-[#D4D4D4]">
                      {payload.html}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0A0F2C]">
                        CSS
                      </span>
                      <button
                        type="button"
                        onClick={() => void copySnippet(payload.css)}
                        className="touch-manipulation rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-xs font-semibold text-[#1F2937] transition hover:scale-[1.02] hover:border-[#3B82F6]/40"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="max-h-[220px] overflow-auto rounded-xl border border-[#E5E7EB] bg-[#1E1E1E] p-4 font-mono text-[13px] leading-relaxed text-[#D4D4D4]">
                      {payload.css}
                    </pre>
                  </div>
                  {payload.javascript.trim() ? (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0A0F2C]">
                          JavaScript
                        </span>
                        <button
                          type="button"
                          onClick={() => void copySnippet(payload.javascript)}
                          className="touch-manipulation rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-xs font-semibold text-[#1F2937] transition hover:scale-[1.02] hover:border-[#3B82F6]/40"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="max-h-[180px] overflow-auto rounded-xl border border-[#E5E7EB] bg-[#1E1E1E] p-4 font-mono text-[13px] leading-relaxed text-[#D4D4D4]">
                        {payload.javascript}
                      </pre>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={downloadHtml}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0A0F2C] text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-[#121836]"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'explanation' && (
            <div className="h-full overflow-y-auto p-4 sm:p-6">
              {!payload?.explanation ? (
                <p className="text-center text-sm text-[#1F2937]/55">
                  Shpjegimi shfaqet pasi të gjenerosh një dizajn.
                </p>
              ) : (
                <div className="markdown-body text-sm text-[#1F2937] [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-[#0A0F2C] [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-[#0A0F2C] [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-[#0A0F2C]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {payload.explanation}
                  </ReactMarkdown>
                </div>
              )}
              {rawReply && !payload?.explanation && error && (
                <p className="mt-4 text-xs text-[#1F2937]/45">
                  Shiko skedën Code ose provo përsëri — përgjigja e plotë mund të
                  jetë e papërpunuar.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
