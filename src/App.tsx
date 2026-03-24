import { Menu } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChatPanel } from './components/ChatPanel'
import CompareAIView from './components/CompareAIView'
import ImageToUIView from './components/ImageToUIView'
import { CodeEditorPanel } from './components/CodeEditorPanel'
import { DesignGeneratorView } from './components/DesignGeneratorView'
import { HistoryView } from './components/HistoryView'
import { OutputPreview } from './components/OutputPreview'
import { SettingsView } from './components/SettingsView'
import { Sidebar } from './components/Sidebar'
import { openAiProxyEnabled } from './lib/env'
import { chatCompletion } from './lib/openai'
import {
  debugUserPayload,
  explainUserPayload,
  MENTOR_SYSTEM,
} from './lib/prompts'
import {
  getEffectiveOpenRouterKey,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
} from './lib/storage'
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  EditorLanguage,
  NavId,
} from './types'

function uid() {
  return crypto.randomUUID()
}

function firstUserSnippet(messages: ChatMessage[]): string {
  const u = messages.find((m) => m.role === 'user')
  if (!u) return 'Bisedë e re'
  const head = u.content.split(/\n\n---\n/)[0] ?? u.content
  const t = head.replace(/\s+/g, ' ').trim()
  return t.length > 56 ? `${t.slice(0, 56)}…` : t || 'Bisedë e re'
}

function buildPreview(code: string, lang: EditorLanguage): string {
  if (lang === 'html') return code
  if (lang === 'css') {
    return `<!DOCTYPE html><html lang="sq"><head><meta charset="utf-8"/><style>${code}</style></head><body><p>Parapamje CSS</p><div class="demo">Shembull</div></body></html>`
  }
  if (lang === 'javascript') {
    return `<!DOCTYPE html><html lang="sq"><head><meta charset="utf-8"/></head><body><script>\n${code}\n</script></body></html>`
  }
  return `<!DOCTYPE html><html lang="sq"><body style="font-family:system-ui;padding:1rem;background:#fafafa;color:#64748b">Parapamja e ekzekutimit funksionon për HTML, CSS dhe JavaScript.</body></html>`
}

export default function App() {
  const [nav, setNav] = useState<NavId>('chat')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [history, setHistory] = useState<Conversation[]>(() => loadHistory())
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [language, setLanguage] = useState<EditorLanguage>('javascript')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputDoc, setOutputDoc] = useState<string | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    saveHistory(history)
  }, [history])

  const apiMessages = useMemo(() => {
    const base = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    return [
      { role: 'system' as const, content: MENTOR_SYSTEM },
      ...base.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]
  }, [messages])

  const persistConversation = useCallback(
    (msgs: ChatMessage[], cid: string | null) => {
      const id = cid ?? uid()
      const conv: Conversation = {
        id,
        title: firstUserSnippet(msgs),
        messages: msgs,
        updatedAt: Date.now(),
      }
      setHistory((prev) => {
        const rest = prev.filter((c) => c.id !== id)
        return [conv, ...rest].slice(0, 40)
      })
      return id
    },
    [],
  )

  const sendChat = useCallback(async () => {
    let trimmed = chatInput.trim()
    if (!trimmed && nav === 'explain' && code.trim()) {
      trimmed = 'Të lutem shpjego këtë kod sipas udhëzimeve të mentorit.'
    }
    if (!trimmed && nav === 'debug' && code.trim()) {
      trimmed =
        'Të lutem analizo gabimet, korrigjo kodin dhe shpjego ndryshimet.'
    }
    if (!trimmed || loading) return
    if (!openAiProxyEnabled) {
      if (settings.useOpenRouter) {
        if (!getEffectiveOpenRouterKey(settings)) {
          setError('Fut OpenRouter API Key te cilësimet dhe ruaj.')
          setNav('settings')
          return
        }
      } else if (!settings.apiKey.trim()) {
        setError(
          'Shto OpenAI API Key, aktivizo OpenRouter, ose aktivizo proxy të serverit.',
        )
        setNav('settings')
        return
      }
    }

    let userContent = trimmed
    if (nav === 'explain' && code.trim()) {
      userContent = `${trimmed}\n\n${explainUserPayload(code, language)}`
    } else if (nav === 'debug' && code.trim()) {
      userContent = `${trimmed}\n\n${debugUserPayload(code, language)}`
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: userContent,
      createdAt: Date.now(),
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setChatInput('')
    setError(null)
    setLoading(true)

    try {
      const reply = await chatCompletion(
        [...apiMessages, { role: 'user' as const, content: userContent }],
        settings.apiKey,
        settings.model,
        {
          openRouterKey:
            settings.useOpenRouter && getEffectiveOpenRouterKey(settings)
              ? getEffectiveOpenRouterKey(settings)
              : undefined,
        },
      )
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      }
      const finalMsgs = [...nextMessages, assistantMsg]
      setMessages(finalMsgs)
      const newId = persistConversation(finalMsgs, conversationId)
      setConversationId(newId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gabim i panjohur.')
    } finally {
      setLoading(false)
    }
  }, [
    apiMessages,
    chatInput,
    code,
    conversationId,
    language,
    loading,
    messages,
    nav,
    persistConversation,
    settings.apiKey,
    settings.model,
    settings.useOpenRouter,
  ])

  const handleExplainFollowUp = useCallback(
    (assistantContent: string) => {
      setChatInput(
        'Shpjego më tej këtë përgjigje, veçanërisht logjikën dhe pjesët kryesore të kodit:\n\n' +
          assistantContent.slice(0, 4000),
      )
    },
    [],
  )

  const handleRun = useCallback(() => {
    setOutputDoc(buildPreview(code, language))
    setShowOutput(true)
  }, [code, language])

  const handleSaveSettings = useCallback(() => {
    saveSettings(settings)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2500)
  }, [settings])

  const handleOpenHistory = useCallback((c: Conversation) => {
    setConversationId(c.id)
    setMessages(c.messages)
    setNav('chat')
  }, [])

  const handleDeleteHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((c) => c.id !== id))
    if (conversationId === id) {
      setConversationId(null)
      setMessages([])
    }
  }, [conversationId])

  const newChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setChatInput('')
    setError(null)
    setNav('chat')
  }, [])

  const mainWorkspace =
    nav === 'settings' ? (
      <SettingsView
        settings={settings}
        onChange={setSettings}
        onSave={handleSaveSettings}
        savedHint={settingsSaved}
        useServerOpenAiKey={openAiProxyEnabled}
      />
    ) : nav === 'history' ? (
      <HistoryView
        items={history}
        onOpen={handleOpenHistory}
        onDelete={handleDeleteHistory}
      />
    ) : nav === 'design' ? (
      <DesignGeneratorView
        useOpenRouter={settings.useOpenRouter}
        apiKey={settings.apiKey}
        model={settings.model}
        openRouterKey={
          settings.useOpenRouter
            ? getEffectiveOpenRouterKey(settings) || undefined
            : undefined
        }
        onNeedSettings={() => setNav('settings')}
      />
    ) : nav === 'imageToUi' ? (
      <ImageToUIView
        settings={settings}
        onNeedSettings={() => setNav('settings')}
      />
    ) : nav === 'compare' ? (
      <CompareAIView
        settings={settings}
        onNeedSettings={() => setNav('settings')}
      />
    ) : (
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[45vh] min-w-0 flex-1 flex-col border-b border-[#E5E7EB] lg:min-h-0 lg:max-w-[min(100%,560px)] lg:border-b-0 lg:border-r">
          <ChatPanel
            messages={messages}
            navMode={nav}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={sendChat}
            onNewChat={newChat}
            onOpenCompare={() => setNav('compare')}
            loading={loading}
            voiceEnabled={settings.voiceEnabled}
            onExplainFollowUp={handleExplainFollowUp}
            error={error}
          />
        </div>
        <div className="flex min-h-[50vh] min-w-0 flex-[1.15] flex-col bg-white lg:min-h-0">
          <div className="min-h-0 flex-1">
            <CodeEditorPanel
              language={language}
              onLanguageChange={setLanguage}
              value={code}
              onChange={setCode}
              navMode={nav}
              onRun={handleRun}
              onClear={() => setCode('')}
              autoFocus={
                nav === 'editor' || nav === 'explain' || nav === 'debug'
              }
            />
          </div>
          <OutputPreview srcDoc={outputDoc} visible={showOutput} />
        </div>
      </div>
    )

  return (
    <div className="flex h-full min-h-0 bg-[#FFFFFF] text-[#1F2937]">
      <Sidebar
        active={nav}
        onNavigate={setNav}
        mobileOpen={mobileMenu}
        onCloseMobile={() => setMobileMenu(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-3 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenu(true)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] text-[#0A0F2C] transition hover:scale-[1.02]"
            aria-label="Hap menunë"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="leading-tight">
            <p className="text-xs font-medium uppercase tracking-wider text-[#3B82F6]">
              JUEJ AI
            </p>
            <p className="text-sm font-semibold text-[#0A0F2C]">Code</p>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mainWorkspace}
        </main>
      </div>
    </div>
  )
}
