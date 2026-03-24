import { Copy, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { OPENROUTER_CHAT_MODEL_SLUG } from '../lib/openRouterConstants'
import { logOpenRouterRequest } from '../lib/openRouterDebug'
import { optionalOpenRouterBearerHeaders } from '../lib/openRouterAuthHeaders'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import {
  extractCodeBlocks,
  hasLivePreviewContent,
} from '../lib/extractLiveCodeBlocks'
import { getEffectiveOpenRouterKey } from '../lib/storage'
import type { AppSettings, CompareModelId } from '../types'
import { LiveCodePreviewPanel } from './LiveCodePreviewPanel'

const MODEL_IDS: CompareModelId[] = [
  'openai/gpt-4o',
  'anthropic/claude-3.5-sonnet',
  'deepseek/deepseek-chat',
]

const MODEL_LABELS: Record<CompareModelId, string> = {
  'openai/gpt-4o': 'openai/gpt-4o',
  'openai/gpt-4o-mini': 'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'deepseek/deepseek-chat': 'deepseek/deepseek-chat',
}

const MERGE_MODEL: CompareModelId = 'openai/gpt-4o'

type TabId = 'a' | 'b' | 'merged'

type LoadingState = 'idle' | 'compare' | 'merge'

async function postApiAi(
  model: CompareModelId,
  prompt: string,
  authHeaders: Record<string, string>,
): Promise<string> {
  const bearer = authHeaders.Authorization?.replace(/^Bearer\s+/i, '')?.trim()
  if (bearer) {
    logOpenRouterRequest('compare/api/ai', {
      apiKey: bearer,
      endpoint: apiUrl('/api/ai'),
      model,
    })
  }

  const res = await fetch(apiUrl('/api/ai'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ model, prompt }),
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = (await res.json()) as { error?: { message?: string } }
      if (j.error?.message) msg = j.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const data = (await res.json()) as { output?: string; reply?: string }
  const out = data.output ?? data.reply
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('Empty response from API.')
  }
  return out
}

function buildMergePrompt(resA: string, resB: string): string {
  return `You are an expert developer.

Combine these two answers into ONE best answer.

Rules:
- Keep best parts, remove repetition, improve clarity.
- If either answer includes HTML/CSS/JS for browser UI, your merged answer MUST use three separate markdown fences in this exact order: \`\`\`html (body inner content only), \`\`\`css, \`\`\`javascript or \`\`\`js — then a short explanation outside fences. Include empty css/js fences if unused. Never mix HTML+CSS+JS in one fence unless the user explicitly asked for that.
- For non-UI code, use appropriate fenced language tag(s) and then explanation.

Answer A:
${resA}

Answer B:
${resB}
`
}

export interface CompareAIViewProps {
  settings: AppSettings
  onNeedSettings?: () => void
}

export default function CompareAIView({
  settings,
  onNeedSettings,
}: CompareAIViewProps) {
  const [prompt, setPrompt] = useState('')
  const [modelA, setModelA] = useState<CompareModelId>('openai/gpt-4o')
  const [modelB, setModelB] = useState<CompareModelId>(
    'anthropic/claude-3.5-sonnet',
  )
  const [resA, setResA] = useState<string | null>(null)
  const [resB, setResB] = useState<string | null>(null)
  const [merged, setMerged] = useState<string | null>(null)
  const [loading, setLoading] = useState<LoadingState>('idle')
  const [activeTab, setActiveTab] = useState<TabId>('a')
  const [compareError, setCompareError] = useState<string | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)

  const isBusy = loading !== 'idle'
  const canMerge = resA !== null && resB !== null && !isBusy

  const authHeaders = useMemo(
    () => optionalOpenRouterBearerHeaders(settings),
    [settings],
  )

  const runCompare = useCallback(async () => {
    const text = prompt.trim()
    if (!text || isBusy) return
    if (settings.useOpenRouter && !getEffectiveOpenRouterKey(settings)) {
      setCompareError('Fut OpenRouter API Key te cilësimet dhe ruaj.')
      onNeedSettings?.()
      return
    }
    setLoading('compare')
    setCompareError(null)
    setMergeError(null)
    setMerged(null)
    setResA(null)
    setResB(null)
    try {
      const mA = settings.useOpenRouter ? OPENROUTER_CHAT_MODEL_SLUG : modelA
      const mB = settings.useOpenRouter ? OPENROUTER_CHAT_MODEL_SLUG : modelB
      const [a, b] = await Promise.all([
        postApiAi(mA, text, authHeaders),
        postApiAi(mB, text, authHeaders),
      ])
      setResA(a)
      setResB(b)
      setActiveTab('a')
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Compare failed.')
      setResA(null)
      setResB(null)
    } finally {
      setLoading('idle')
    }
  }, [
    authHeaders,
    isBusy,
    modelA,
    modelB,
    onNeedSettings,
    prompt,
    settings,
  ])

  const runMerge = useCallback(async () => {
    if (!resA || !resB || isBusy) return
    if (settings.useOpenRouter && !getEffectiveOpenRouterKey(settings)) {
      setMergeError('Fut OpenRouter API Key te cilësimet dhe ruaj.')
      onNeedSettings?.()
      return
    }
    setLoading('merge')
    setMergeError(null)
    try {
      const mergeModel = settings.useOpenRouter
        ? OPENROUTER_CHAT_MODEL_SLUG
        : MERGE_MODEL
      const out = await postApiAi(
        mergeModel,
        buildMergePrompt(resA, resB),
        authHeaders,
      )
      setMerged(out)
      setActiveTab('merged')
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : 'Merge failed.')
    } finally {
      setLoading('idle')
    }
  }, [authHeaders, isBusy, onNeedSettings, resA, resB, settings])

  const displayText =
    activeTab === 'a'
      ? resA
      : activeTab === 'b'
        ? resB
        : merged

  const compareLiveParts = useMemo(() => {
    if (!displayText) return null
    return extractCodeBlocks(displayText)
  }, [displayText])

  const { copy: copyResult, feedback: copyFeedback } = useCopyFeedback()

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0A0F2C] text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-4">
        <h1 className="text-lg font-semibold tracking-tight text-white">
          Compare AI
        </h1>
        <p className="mt-1 text-xs text-white/55">
          Same prompt → two models → merge into one answer via{' '}
          <span className="text-[#3B82F6]">POST /api/ai</span>
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div>
            <label
              htmlFor="compare-prompt"
              className="text-xs font-medium uppercase tracking-wide text-white/45"
            >
              Prompt
            </label>
            <textarea
              id="compare-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={isBusy}
              placeholder="Enter your prompt…"
              autoComplete="off"
              spellCheck
              className="relative z-[1] mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#121836] px-4 py-3 text-sm text-white/90 shadow-inner placeholder:text-white/35 focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 disabled:opacity-50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="model-a"
                className="text-xs font-medium text-white/55"
              >
                Model A
              </label>
              <select
                id="model-a"
                value={modelA}
                disabled={isBusy}
                onChange={(e) => setModelA(e.target.value as CompareModelId)}
                className="mt-2 w-full min-h-[48px] rounded-xl border border-white/10 bg-[#121836] px-3 text-sm text-white focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 disabled:opacity-50"
              >
                {MODEL_IDS.map((id) => (
                  <option key={id} value={id} className="bg-[#0A0F2C]">
                    {MODEL_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="model-b"
                className="text-xs font-medium text-white/55"
              >
                Model B
              </label>
              <select
                id="model-b"
                value={modelB}
                disabled={isBusy}
                onChange={(e) => setModelB(e.target.value as CompareModelId)}
                className="mt-2 w-full min-h-[48px] rounded-xl border border-white/10 bg-[#121836] px-3 text-sm text-white focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 disabled:opacity-50"
              >
                {MODEL_IDS.map((id) => (
                  <option key={id} value={id} className="bg-[#0A0F2C]">
                    {MODEL_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => void runCompare()}
              disabled={isBusy || !prompt.trim()}
              className="inline-flex min-h-[48px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(59,130,246,0.35)] transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              {loading === 'compare' ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : null}
              Compare
            </button>
            <button
              type="button"
              onClick={() => void runMerge()}
              disabled={!canMerge}
              className="inline-flex min-h-[48px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl border border-[#3B82F6]/50 bg-[#3B82F6]/10 px-5 text-sm font-semibold text-[#93C5FD] transition hover:bg-[#3B82F6]/20 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              {loading === 'merge' ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-5 w-5" aria-hidden />
              )}
              Merge Result
            </button>
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

          {loading === 'compare' && (
            <p className="text-center text-sm text-[#3B82F6]">Comparing…</p>
          )}
          {loading === 'merge' && (
            <p className="text-center text-sm text-[#3B82F6]">Merging…</p>
          )}

          <div className="rounded-xl border border-white/10 bg-[#121836]/80">
            <div
              role="tablist"
              className="flex border-b border-white/10"
              aria-label="Compare results"
            >
              {(
                [
                  { id: 'a' as const, label: 'Model A' },
                  { id: 'b' as const, label: 'Model B' },
                  { id: 'merged' as const, label: 'Merged ⭐' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => setActiveTab(id)}
                  className={`min-h-[44px] flex-1 px-3 text-center text-sm font-medium transition ${
                    activeTab === id
                      ? 'border-b-2 border-[#3B82F6] text-[#3B82F6]'
                      : 'text-white/55 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              className="min-h-[240px] p-4"
              aria-live="polite"
            >
              {(activeTab === 'a' || activeTab === 'b') && compareError && (
                <p className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {compareError}
                </p>
              )}
              {activeTab === 'merged' && mergeError && (
                <p className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {mergeError}
                </p>
              )}
              {displayText ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyResult(displayText)}
                      className="inline-flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-lg border border-white/15 bg-[#121836] px-3 py-2 text-xs font-semibold text-white/90 hover:border-[#3B82F6]/50"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy result
                    </button>
                    {copyFeedback ? (
                      <span className="text-xs font-medium text-[#3B82F6]">
                        {copyFeedback}
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-lg bg-[#0A0F2C] p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-white/90">
                    {displayText}
                  </div>
                  {compareLiveParts &&
                  hasLivePreviewContent(compareLiveParts) ? (
                    <LiveCodePreviewPanel
                      sourceText={displayText}
                      parts={compareLiveParts}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-white/40">
                  {activeTab === 'merged'
                    ? 'Run Compare, then Merge Result to see the combined answer.'
                    : activeTab === 'a'
                      ? 'Compare to load Model A output.'
                      : 'Compare to load Model B output.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
