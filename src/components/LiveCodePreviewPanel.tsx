import { Copy } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { LiveCodeParts } from '../lib/extractLiveCodeBlocks'
import {
  buildPreviewDocument,
  extractCodeBlocks,
  hasLivePreviewContent,
} from '../lib/extractLiveCodeBlocks'

type TabId = 'preview' | 'html' | 'css' | 'js'

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JavaScript' },
]

const preCodeClass =
  'm-0 max-h-[min(280px,40vh)] select-text overflow-x-auto overflow-y-auto rounded-xl border border-white/10 bg-[#0d1117] p-4 font-mono text-[12px] leading-relaxed text-[#e6edf3]'

function CodeTabBody({
  label,
  value,
  emptyHint,
  onCopy,
  copyFeedback,
}: {
  label: string
  value: string
  emptyHint: string
  onCopy: () => void
  copyFeedback: string | null
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex min-h-[36px] touch-manipulation items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-white/90 transition hover:-translate-y-px hover:border-[#60a5fa]/45 hover:shadow-[0_0_16px_rgba(59,130,246,0.2)]"
        >
          <Copy className="h-3 w-3" aria-hidden />
          Copy
        </button>
      </div>
      {copyFeedback ? (
        <p className="text-xs font-medium text-[#60a5fa]" role="status">
          {copyFeedback}
        </p>
      ) : null}
      <pre className={preCodeClass}>
        <code className="select-text whitespace-pre text-inherit">{value || emptyHint}</code>
      </pre>
    </div>
  )
}

export interface LiveCodePreviewPanelProps {
  /** Full assistant message (markdown + fences). Used when `parts` is omitted. */
  sourceText: string
  /** Pre-parsed blocks to avoid parsing twice when parent already computed them. */
  parts?: LiveCodeParts
}

export const LiveCodePreviewPanel = memo(function LiveCodePreviewPanel({
  sourceText,
  parts: partsProp,
}: LiveCodePreviewPanelProps) {
  const parts = useMemo(() => {
    if (partsProp) return partsProp
    return extractCodeBlocks(sourceText)
  }, [partsProp, sourceText])
  const mergedDoc = useMemo(
    () => buildPreviewDocument(parts.html, parts.css, parts.js),
    [parts.css, parts.html, parts.js],
  )

  const [tab, setTab] = useState<TabId>('preview')
  const { copy, feedback } = useCopyFeedback()

  const copyHtml = () => void copy(parts.html, { emptyHint: 'Empty' })
  const copyCss = () => void copy(parts.css, { emptyHint: 'Empty' })
  const copyJs = () => void copy(parts.js, { emptyHint: 'Empty' })

  if (!hasLivePreviewContent(parts)) return null

  return (
    <div className="glass-panel mt-4 w-full !rounded-[20px] !shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
      <div className="flex flex-wrap gap-1 border-b border-white/[0.08] px-2 py-2.5">
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-[40px] touch-manipulation rounded-xl px-3.5 text-xs font-semibold transition duration-200 ease-out ${
              tab === id
                ? 'premium-tab-active scale-[1.02] text-white'
                : 'text-white/50 hover:translate-y-[-1px] hover:bg-white/[0.06] hover:text-white/90'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        {tab === 'preview' && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1117]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2.5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Live preview
              </span>
            </div>
            <iframe
              title="Live HTML preview"
              className="h-[min(420px,50vh)] w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={mergedDoc}
            />
          </div>
        )}

        {tab === 'html' && (
          <CodeTabBody
            label="HTML"
            value={parts.html}
            emptyHint="(no HTML block)"
            onCopy={copyHtml}
            copyFeedback={feedback}
          />
        )}

        {tab === 'css' && (
          <CodeTabBody
            label="CSS"
            value={parts.css}
            emptyHint="(no CSS block)"
            onCopy={copyCss}
            copyFeedback={feedback}
          />
        )}

        {tab === 'js' && (
          <CodeTabBody
            label="JavaScript"
            value={parts.js}
            emptyHint="(no JS block)"
            onCopy={copyJs}
            copyFeedback={feedback}
          />
        )}
      </div>
    </div>
  )
})

LiveCodePreviewPanel.displayName = 'LiveCodePreviewPanel'
