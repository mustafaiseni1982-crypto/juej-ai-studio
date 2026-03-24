import { Copy, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { apiUrl, humanizeFetchNetworkError } from '../lib/apiBase'
import { parseJsonFromResponse } from '../lib/parseApiJson'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import {
  extractCodeBlocks,
  hasLivePreviewContent,
} from '../lib/extractLiveCodeBlocks'
import type { CompareModelId } from '../types'
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
): Promise<string> {
  let res: Response
  try {
    res = await fetch(apiUrl('/api/ai'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }),
    })
  } catch (e) {
    throw humanizeFetchNetworkError(e)
  }
  const data = await parseJsonFromResponse<{
    output?: string
    reply?: string
    error?: { message?: string }
  }>(res)
  if (!res.ok) {
    const msg = data.error?.message ?? res.statusText
    throw new Error(msg)
  }
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
- Keep best parts
- Remove repetition
- Improve clarity
- Structure output:
  1. Final Code
  2. Explanation
  3. Improvements

Answer A:
${resA}

Answer B:
${resB}
`
}

export interface CompareAIViewProps {
  onNeedSettings?: () => void
}

export default function CompareAIView({ onNeedSettings }: CompareAIViewProps) {
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

  const runCompare = useCallback(async () => {
    const text = prompt.trim()
    if (!text || isBusy) return
    setLoading('compare')
    setCompareError(null)
    setMergeError(null)
    setMerged(null)
    setResA(null)
    setResB(null)
    try {
      const [a, b] = await Promise.all([
        postApiAi(modelA, text),
        postApiAi(modelB, text),
      ])
      setResA(a)
      setResB(b)
      setActiveTab('a')
    } catch (e) {
      console.error(e)
      setCompareError(e instanceof Error ? e.message : 'Compare failed.')
      setResA(null)
      setResB(null)
    } finally {
      setLoading('idle')
    }
  }, [isBusy, modelA, modelB, prompt])

  const runMerge = useCallback(async () => {
    if (!resA || !resB || isBusy) return
    setLoading('merge')
    setMergeError(null)
    try {
      const out = await postApiAi(MERGE_MODEL, buildMergePrompt(resA, resB))
      setMerged(out)
      setActiveTab('merged')
    } catch (e) {
      console.error(e)
      setMergeError(e instanceof Error ? e.message : 'Merge failed.')
    } finally {
      setLoading('idle')
    }
  }, [isBusy, resA, resB])

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
    <div className="flex h-full min-h-0 flex-col bg-transparent text-white">
      <header className="premium-top-bar shrink-0 px-5 py-5 sm:px-8">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Compare AI
        </h1>
        <p className="mt-1.5 text-sm text-[#94a3b8]">
          Same prompt → two models → merge via{' '}
          <span className="font-medium text-[#60a5fa]">POST /api/ai</span>
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
              className="premium-input relative z-[1] mt-2 min-h-[100px] w-full resize-none shadow-inner placeholder:text-slate-500 disabled:opacity-50"
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
                className="premium-input premium-select mt-2 min-h-[48px] w-full cursor-pointer text-sm disabled:opacity-50"
              >
                {MODEL_IDS.map((id) => (
                  <option key={id} value={id} className="bg-[#0b0f1a]">
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
                className="premium-input premium-select mt-2 min-h-[48px] w-full cursor-pointer text-sm disabled:opacity-50"
              >
                {MODEL_IDS.map((id) => (
                  <option key={id} value={id} className="bg-[#0b0f1a]">
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
              className="btn-premium-primary flex-1 !min-h-[48px] sm:flex-none"
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
              className="btn-premium-ghost flex-1 !min-h-[48px] !border-[#3b82f6]/40 !text-[#93c5fd] hover:!shadow-[0_0_24px_rgba(59,130,246,0.25)] sm:flex-none"
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

          <div className="glass-panel !rounded-[20px]">
            <div
              role="tablist"
              className="flex border-b border-white/[0.08]"
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
                  className={`min-h-[48px] flex-1 px-3 text-center text-sm font-semibold transition duration-200 ${
                    activeTab === id
                      ? 'border-b-2 border-[#60a5fa] text-[#60a5fa] shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                      : 'text-[#94a3b8] hover:bg-white/[0.04] hover:text-white'
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
                      className="btn-premium-ghost !min-h-[40px] !text-xs"
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
                  <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-slate-200 backdrop-blur-sm">
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
