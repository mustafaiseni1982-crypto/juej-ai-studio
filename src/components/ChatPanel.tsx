import { Copy, Loader2, Send, Sparkles, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import {
  extractCodeBlocks,
  hasLivePreviewContent,
} from '../lib/extractLiveCodeBlocks'
import type { ChatMessage, NavId } from '../types'
import { extractFirstCodeBlock, plainTextForSpeech } from '../lib/text'
import { LiveCodePreviewPanel } from './LiveCodePreviewPanel'

interface ChatPanelProps {
  messages: ChatMessage[]
  navMode: NavId
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  onNewChat: () => void
  onOpenCompare?: () => void
  loading: boolean
  voiceEnabled: boolean
  onExplainFollowUp: (assistantContent: string) => void
  error: string | null
}

function MessageBubble({
  msg,
  voiceEnabled,
  onExplainFollowUp,
}: {
  msg: ChatMessage
  voiceEnabled: boolean
  onExplainFollowUp: (content: string) => void
}) {
  const isUser = msg.role === 'user'
  const { copy, feedback } = useCopyFeedback()
  const liveCodeParts = useMemo(
    () => extractCodeBlocks(msg.content),
    [msg.content],
  )
  const showLivePreview = hasLivePreviewContent(liveCodeParts)

  const copyCode = useCallback(() => {
    const code = extractFirstCodeBlock(msg.content)
    void copy(code ?? '', { emptyHint: 'Nothing to copy' })
  }, [copy, msg.content])

  const readAloud = useCallback(() => {
    if (!voiceEnabled) return
    const text = plainTextForSpeech(msg.content)
    if (!text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'sq-AL'
    u.rate = 1
    window.speechSynthesis.speak(u)
  }, [msg.content, voiceEnabled])

  if (msg.role === 'system') return null

  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[min(100%,640px)] rounded-[20px] px-4 py-3.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-[#3b82f6] to-[#6366f1] text-white shadow-[0_10px_40px_rgba(59,130,246,0.35)]'
            : 'glass-panel border-white/[0.1] text-slate-200'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="markdown-body text-slate-200 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-slate-100 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-white [&_a]:text-[#60a5fa] [&_a]:underline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = /language-[\w]+/.test(className || '')
                  if (isBlock) {
                    return (
                      <code
                        className="my-3 block overflow-x-auto rounded-xl border border-white/10 bg-[#0d1117]/90 p-4 font-mono text-[13px] leading-snug text-[#e2e8f0]"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code
                      className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-[#93c5fd]"
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                pre({ children }) {
                  return (
                    <pre className="m-0 overflow-x-auto bg-transparent p-0 font-inherit">
                      {children}
                    </pre>
                  )
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
            {showLivePreview ? (
              <LiveCodePreviewPanel
                sourceText={msg.content}
                parts={liveCodeParts}
              />
            ) : null}
          </div>
        )}
        {!isUser && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="btn-premium-ghost !min-h-[40px]"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Kopjo kodin
            </button>
            {feedback ? (
              <span
                className="text-xs font-medium text-[#60a5fa]"
                role="status"
              >
                {feedback}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onExplainFollowUp(msg.content)}
              className="btn-premium-ghost !min-h-[40px]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#60a5fa]" />
              Shpjego më tej
            </button>
            <button
              type="button"
              onClick={readAloud}
              disabled={!voiceEnabled}
              title={
                voiceEnabled
                  ? 'Lexo me zë shpjegimin'
                  : 'Zëri është i fikur në cilësime'
              }
              className="btn-premium-ghost !min-h-[40px] disabled:pointer-events-none disabled:opacity-35"
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#60a5fa]" aria-hidden />
              Lexo shpjegimin
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatPanel({
  messages,
  navMode,
  input,
  onInputChange,
  onSend,
  onNewChat,
  onOpenCompare,
  loading,
  voiceEnabled,
  onExplainFollowUp,
  error,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const visible = messages.filter((m) => m.role !== 'system')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const title =
    navMode === 'explain'
      ? 'Shpjegim kodit'
      : navMode === 'debug'
        ? 'Debug i kodit'
        : navMode === 'editor'
          ? 'Bisedë & redaktor'
          : 'Bisedë me mentorin'

  const placeholder =
    navMode === 'explain'
      ? 'Shkruaj kontekst ose pyetje, pastaj dërgo (kodi vjen nga redaktori)...'
      : navMode === 'debug'
        ? 'Përshkruaj simptomën ose dërgo për analizë (kodi nga redaktori)...'
        : 'Pyet për kod, arkitekturë ose praktika të mira...'

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Mentori yt: kod i pastër, shpjegim hap pas hapi, përmirësime.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {onOpenCompare && (
            <button
              type="button"
              onClick={onOpenCompare}
              className="btn-premium-ghost !border-[#3b82f6]/35 !text-[#93c5fd] hover:!shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            >
              Compare AI
            </button>
          )}
          <button type="button" onClick={onNewChat} className="btn-premium-ghost">
            Bisedë e re
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {visible.length === 0 && (
          <div className="glass-panel-subtle border border-dashed border-white/[0.12] p-8 text-center text-sm text-[#94a3b8]">
            Nuk ka mesazhe ende. Shkruaj një pyetje ose përdor menunë për të
            shpjeguar ose debuguar kodin nga redaktori.
          </div>
        )}
        {visible.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            voiceEnabled={voiceEnabled}
            onExplainFollowUp={onExplainFollowUp}
          />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="glass-panel-subtle flex items-center gap-3 px-4 py-3.5">
              <Loader2 className="h-4 w-4 animate-spin text-[#60a5fa]" />
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa] animate-typing-dot" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa] animate-typing-dot" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa] animate-typing-dot" />
              </div>
              <span className="text-xs text-[#94a3b8]">Duke menduar…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] bg-[#0b0f1a]/40 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!loading) onSend()
              }
            }}
            placeholder={placeholder}
            rows={2}
            autoComplete="off"
            spellCheck
            enterKeyHint="send"
            className="premium-input min-h-[52px] flex-1 resize-none shadow-inner"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={loading || !input.trim()}
            className="btn-premium-primary !min-h-[52px] !min-w-[52px] shrink-0 !p-0"
            aria-label="Dërgo"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-500">
          Enter për të dërguar · Shift+Enter për rresht të ri
        </p>
      </div>
    </div>
  )
}
