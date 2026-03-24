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
import { chatCompletion } from '../lib/openai'
import { DESIGN_SYSTEM } from '../lib/prompts'

type DesignTab = 'preview' | 'code' | 'explanation'

interface DesignGeneratorViewProps {
  model: string
}

export function DesignGeneratorView({ model }: DesignGeneratorViewProps) {
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
        model,
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
      console.error(e)
      setPayload(null)
      setError(e instanceof Error ? e.message : 'Gabim i panjohur.')
    } finally {
      setBusy(false)
    }
  }, [busy, includeJs, model, prompt])

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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section className="flex w-full shrink-0 flex-col border-b border-white/[0.08] bg-white/[0.03] backdrop-blur-xl lg:w-[min(100%,420px)] lg:border-b-0 lg:border-r lg:border-white/[0.08]">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <h1 className="text-lg font-bold tracking-tight text-white">Design</h1>
          <p className="mt-1.5 text-sm text-[#94a3b8]">
            Përshkruaj UI-in; merr parapamje, kod dhe shpjegim.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
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
            className="premium-input relative z-[1] min-h-[160px] w-full resize-y shadow-inner disabled:opacity-50"
          />

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 transition hover:border-[#3b82f6]/25 hover:bg-white/[0.05]">
            <input
              type="checkbox"
              checked={includeJs}
              onChange={(e) => setIncludeJs(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#3b82f6] focus:ring-[#3b82f6]/40"
            />
            <span className="text-sm font-medium text-slate-200">
              Gjenero edhe JS (interaksione)
            </span>
          </label>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || !prompt.trim()}
            className="btn-premium-primary w-full"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden />
            )}
            Generate Design
          </button>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
              {error}
            </div>
          )}
        </div>
      </section>

      <section className="flex min-h-[min(50vh,480px)] min-w-0 flex-1 flex-col bg-[#0b0f1a]/50 lg:min-h-0">
        <div
          role="tablist"
          aria-label="Rezultati i dizajnit"
          className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3 pt-3 sm:px-4"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-t-xl px-4 py-2 text-sm font-semibold transition duration-200 ${
                tab === t.id
                  ? 'premium-tab-active text-white'
                  : 'text-[#94a3b8] hover:bg-white/[0.05] hover:text-slate-200'
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
                className="h-full w-full flex-1 border-0 bg-[#0d1117]"
                sandbox="allow-scripts allow-same-origin"
                srcDoc={
                  srcDoc ??
                  '<!DOCTYPE html><html><body style="margin:0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#64748b;font-size:14px">Shtyp <b>Generate Design</b> për parapamje.</body></html>'
                }
              />
            </div>
          )}

          {tab === 'code' && (
            <div className="h-full overflow-y-auto space-y-6 p-4">
              {copyFeedback ? (
                <p className="text-center text-sm font-medium text-[#60a5fa]">
                  {copyFeedback}
                </p>
              ) : null}
              {!payload ? (
                <p className="text-center text-sm text-[#94a3b8]">
                  Kodi shfaqet pasi të gjenerosh një dizajn.
                </p>
              ) : (
                <>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        HTML
                      </span>
                      <button
                        type="button"
                        onClick={() => void copySnippet(payload.html)}
                        className="btn-premium-ghost !min-h-[36px] !px-3 !py-2 !text-xs"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="max-h-[220px] overflow-auto rounded-2xl border border-white/10 bg-[#0d1117] p-4 font-mono text-[13px] leading-relaxed text-[#e2e8f0]">
                      {payload.html}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        CSS
                      </span>
                      <button
                        type="button"
                        onClick={() => void copySnippet(payload.css)}
                        className="btn-premium-ghost !min-h-[36px] !px-3 !py-2 !text-xs"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="max-h-[220px] overflow-auto rounded-2xl border border-white/10 bg-[#0d1117] p-4 font-mono text-[13px] leading-relaxed text-[#e2e8f0]">
                      {payload.css}
                    </pre>
                  </div>
                  {payload.javascript.trim() ? (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          JavaScript
                        </span>
                        <button
                          type="button"
                          onClick={() => void copySnippet(payload.javascript)}
                          className="btn-premium-ghost !min-h-[36px] !px-3 !py-2 !text-xs"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="max-h-[180px] overflow-auto rounded-2xl border border-white/10 bg-[#0d1117] p-4 font-mono text-[13px] leading-relaxed text-[#e2e8f0]">
                        {payload.javascript}
                      </pre>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={downloadHtml}
                    className="btn-premium-primary w-full"
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
                <p className="text-center text-sm text-[#94a3b8]">
                  Shpjegimi shfaqet pasi të gjenerosh një dizajn.
                </p>
              ) : (
                <div className="markdown-body text-sm text-slate-300 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-white [&_a]:text-[#60a5fa]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {payload.explanation}
                  </ReactMarkdown>
                </div>
              )}
              {rawReply && !payload?.explanation && error && (
                <p className="mt-4 text-xs text-slate-500">
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
