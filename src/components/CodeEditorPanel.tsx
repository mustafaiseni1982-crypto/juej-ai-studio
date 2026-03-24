import Editor, { type OnMount } from '@monaco-editor/react'
import { Eraser, Play, Sparkles, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import type { EditorLanguage, NavId } from '../types'

const LANG_OPTIONS: { value: EditorLanguage; label: string }[] = [
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'php', label: 'PHP' },
  { value: 'sql', label: 'SQL' },
]

interface CodeEditorPanelProps {
  language: EditorLanguage
  onLanguageChange: (l: EditorLanguage) => void
  value: string
  onChange: (v: string) => void
  navMode: NavId
  onRun: () => void
  onClear: () => void
  autoFocus?: boolean
}

export function CodeEditorPanel({
  language,
  onLanguageChange,
  value,
  onChange,
  navMode,
  onRun,
  onClear,
  autoFocus,
}: CodeEditorPanelProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const codeNav =
    navMode === 'editor' || navMode === 'explain' || navMode === 'debug'

  useEffect(() => {
    if (!codeNav) return
    const ed = editorRef.current
    if (!ed) return
    const t = window.setTimeout(() => {
      ed.focus()
      ed.layout()
    }, autoFocus ? 80 : 120)
    return () => clearTimeout(t)
  }, [autoFocus, codeNav, navMode])

  const handleMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor
      editor.updateOptions({ readOnly: false, domReadOnly: false })
      if (autoFocus) {
        window.setTimeout(() => {
          editor.focus()
          editor.layout()
        }, 100)
      }
    },
    [autoFocus],
  )

  const runFormat = useCallback(() => {
    const ed = editorRef.current
    if (!ed) return
    void ed.getAction('editor.action.formatDocument')?.run()
  }, [])

  const hint =
    navMode === 'explain'
      ? 'Ngjit kodin këtu, pastaj dërgo nga paneli i bisedës.'
      : navMode === 'debug'
        ? 'Ngjit kodin me gabime këtu, pastaj dërgo nga paneli i bisedës.'
        : 'Shkruaj ose ngjit kodin. Për HTML/JS/CSS mund të përdorësh Ekzekuto.'

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-white/[0.06] bg-[#0b0f1a]/50">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#0b0f1a]/60 px-3 py-2.5 backdrop-blur-xl sm:px-4">
        <label className="sr-only" htmlFor="lang-select">
          Gjuha e kodit
        </label>
        <select
          id="lang-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as EditorLanguage)}
          className="premium-input premium-select min-h-[44px] max-w-[160px] cursor-pointer text-sm font-medium"
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            className="btn-premium-primary !min-h-[44px] !rounded-xl !px-4 !text-sm"
          >
            <Play className="h-4 w-4" aria-hidden />
            Ekzekuto
          </button>
          <button type="button" onClick={() => runFormat()} className="btn-premium-ghost">
            <Wand2 className="h-4 w-4 text-[#60a5fa]" aria-hidden />
            Formatizo
          </button>
          <button
            type="button"
            onClick={onClear}
            className="btn-premium-ghost hover:!border-red-400/30 hover:!text-red-300"
          >
            <Eraser className="h-4 w-4" aria-hidden />
            Pastro
          </button>
        </div>
      </div>
      <p className="flex items-start gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-[#94a3b8]">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#60a5fa]" />
        {hint}
      </p>
      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0d1117]">
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          theme="vs-dark"
          options={{
            readOnly: false,
            domReadOnly: false,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            wordWrap: 'on',
            automaticLayout: true,
            fixedOverflowWidgets: true,
            tabSize: 2,
            cursorBlinking: 'smooth',
          }}
        />
      </div>
    </div>
  )
}
