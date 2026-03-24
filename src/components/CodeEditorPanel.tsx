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
    navMode === 'editor' ||
    navMode === 'explain' ||
    navMode === 'debug'

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
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] px-3 py-2 sm:px-4">
        <label className="sr-only" htmlFor="lang-select">
          Gjuha e kodit
        </label>
        <select
          id="lang-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as EditorLanguage)}
          className="min-h-[44px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#1F2937] shadow-sm transition hover:border-[#3B82F6]/40 focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
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
            className="inline-flex min-h-[44px] touch-manipulation items-center gap-2 rounded-lg bg-[#3B82F6] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.2)] transition duration-200 hover:scale-[1.02] hover:bg-[#2563EB] active:scale-[0.98]"
          >
            <Play className="h-4 w-4" aria-hidden />
            Ekzekuto
          </button>
          <button
            type="button"
            onClick={() => runFormat()}
            className="inline-flex min-h-[44px] touch-manipulation items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#1F2937] transition duration-200 hover:scale-[1.02] hover:border-[#3B82F6]/30 hover:bg-[#F9FAFB]"
          >
            <Wand2 className="h-4 w-4 text-[#3B82F6]" aria-hidden />
            Formatizo
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-[44px] touch-manipulation items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#1F2937] transition duration-200 hover:scale-[1.02] hover:border-red-200 hover:bg-red-50"
          >
            <Eraser className="h-4 w-4" aria-hidden />
            Pastro
          </button>
        </div>
      </div>
      <p className="flex items-start gap-2 border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 text-xs text-[#1F2937]/70">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3B82F6]" />
        {hint}
      </p>
      <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          theme="light"
          options={{
            readOnly: false,
            domReadOnly: false,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            wordWrap: 'on',
            automaticLayout: true,
            fixedOverflowWidgets: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  )
}
