import { Copy, Loader2, Send, Sparkles, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { hasLivePreviewContent, extractCodeBlocks } from '../lib/extractLiveCodeBlocks'
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
        className={`max-w-[min(100%,640px)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-[#3B82F6] text-white'
            : 'border border-[#E5E7EB] bg-white text-[#1F2937]'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="markdown-body text-[#1F2937] [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-[#0A0F2C] [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-[#0A0F2C] [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-[#0A0F2C] [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-[#0A0F2C] [&_a]:text-[#3B82F6] [&_a]:underline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = /language-[\w]+/.test(className || '')
                  if (isBlock) {
                    return (
                      <code
                        className="my-3 block overflow-x-auto rounded-lg border border-[#2D2D2D] bg-[#1E1E1E] p-4 font-mono text-[13px] leading-snug text-[#D4D4D4]"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code
                      className="rounded bg-[#F3F4F6] px-1.5 py-0.5 font-mono text-[13px] text-[#0A0F2C]"
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
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E5E7EB] pt-3">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex min-h-[44px] touch-manipulation items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-xs font-semibold text-[#1F2937] transition hover:scale-[1.02] hover:border-[#3B82F6]/40"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Kopjo kodin
            </button>
            {feedback ? (
              <span className="text-xs font-medium text-[#3B82F6]" role="status">
                {feedback}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onExplainFollowUp(msg.content)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-xs font-semibold text-[#1F2937] transition hover:scale-[1.02] hover:border-[#3B82F6]/40"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#3B82F6]" />
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
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-xs font-semibold text-[#1F2937] transition hover:scale-[1.02] hover:border-[#3B82F6]/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#3B82F6]" aria-hidden />
              🔊 Lexo shpjegimin
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
    <div className="flex h-full min-h-0 flex-col bg-[#FAFAFA]">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5E7EB] bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-[#0A0F2C]">{title}</h1>
          <p className="text-xs text-[#1F2937]/60">
            Mentori yt: kod i pastër, shpjegim hap pas hapi, përmirësime.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {onOpenCompare && (
            <button
              type="button"
              onClick={onOpenCompare}
              className="min-h-[40px] rounded-lg border border-[#3B82F6]/35 bg-[#3B82F6]/10 px-3 text-xs font-semibold text-[#1D4ED8] transition hover:scale-[1.02] hover:border-[#3B82F6]/50"
            >
              Compare AI
            </button>
          )}
          <button
            type="button"
            onClick={onNewChat}
            className="min-h-[40px] rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 text-xs font-semibold text-[#0A0F2C] transition hover:scale-[1.02] hover:border-[#3B82F6]/40"
          >
            Bisedë e re
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-6 text-center text-sm text-[#1F2937]/65">
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
            <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-[#3B82F6]" />
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-typing-dot" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-typing-dot" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-typing-dot" />
              </div>
              <span className="text-xs text-[#1F2937]/60">Duke menduar…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#E5E7EB] bg-white p-3 sm:p-4">
        <div className="flex gap-2">
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
            className="relative z-[1] min-h-[52px] flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#1F2937] shadow-inner transition placeholder:text-[#1F2937]/40 focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={loading || !input.trim()}
            className="inline-flex min-h-[52px] min-w-[52px] shrink-0 touch-manipulation items-center justify-center self-end rounded-xl bg-[#0A0F2C] text-white shadow-[0_4px_14px_rgba(10,15,44,0.15)] transition duration-200 hover:scale-[1.02] hover:bg-[#121836] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Dërgo"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[#1F2937]/45">
          Enter për të dërguar · Shift+Enter për rresht të ri
        </p>
      </div>
    </div>
  )
}
