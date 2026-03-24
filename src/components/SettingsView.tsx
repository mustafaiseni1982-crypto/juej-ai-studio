import { KeyRound, Save, Volume2 } from 'lucide-react'
import { writeOpenRouterKeyToLocalStorage } from '../lib/storage'
import type { AppSettings } from '../types'

interface SettingsViewProps {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  onSave: () => void
  savedHint: boolean
  /** Kur është true, çelësi OpenAI lexohet nga OPENAI_API_KEY në server (proxy). */
  useServerOpenAiKey?: boolean
}

export function SettingsView({
  settings,
  onChange,
  onSave,
  savedHint,
  useServerOpenAiKey = false,
}: SettingsViewProps) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-xl font-semibold text-[#0A0F2C]">Cilësimet</h1>
      <p className="mt-1 text-sm text-[#1F2937]/65">
        {useServerOpenAiKey
          ? 'Modaliteti proxy: çelësi OpenAI vendoset në server (OPENAI_API_KEY), jo në shfletues.'
          : 'Çelësi ruhet vetëm në shfletuesin tënd (localStorage). Për prodhim, përdor një backend të sigurt.'}
      </p>

      {useServerOpenAiKey && (
        <div className="mt-4 rounded-xl border border-[#3B82F6]/25 bg-[#3B82F6]/08 px-4 py-3 text-sm text-[#0A0F2C]">
          <strong className="font-semibold">Proxy aktiv.</strong> Sigurohu që{' '}
          <code className="rounded bg-white/80 px-1 text-xs">npm run server</code>{' '}
          po punon. Mund të përdorësh{' '}
          <strong className="font-semibold">një çelës të vetëm</strong> me{' '}
          <code className="rounded bg-white/80 px-1 text-xs">
            OPENROUTER_API_KEY
          </code>{' '}
          (OpenRouter) për bisedë + krahasim me GPT-4o, Claude dhe DeepSeek.{' '}
          Alternativisht:{' '}
          <code className="rounded bg-white/80 px-1 text-xs">OPENAI_API_KEY</code>{' '}
          dhe për krahasim{' '}
          <code className="rounded bg-white/80 px-1 text-xs">
            ANTHROPIC_API_KEY
          </code>
          ,{' '}
          <code className="rounded bg-white/80 px-1 text-xs">
            DEEPSEEK_API_KEY
          </code>
          . Opsionale:{' '}
          <code className="rounded bg-white/80 px-1 text-xs">
            OPENROUTER_HTTP_REFERER
          </code>{' '}
          (URL referimi për OpenRouter).
        </div>
      )}

      <div className="mt-8 space-y-6">
        {/* Gjithmonë e dukshme: edhe me proxy, për Image to UI / Bearer opsional */}
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <div>
                <p className="text-sm font-medium text-[#1F2937]">
                  OpenRouter — një çelës për të gjithë AI-t
                </p>
                <p className="mt-0.5 text-xs text-[#1F2937]/60">
                  Bisedë, Design, Image to UI dhe Krahaso përmes openrouter.ai (modelet:
                  openai/gpt-4o, anthropic/claude-3.5-sonnet, deepseek/deepseek-chat).
                </p>
                {useServerOpenAiKey ? (
                  <p className="mt-2 text-xs font-medium text-violet-900/80">
                    Proxy aktiv: çelësi mund të jetë në server (
                    <code className="rounded bg-white/90 px-1">OPENROUTER_API_KEY</code>
                    ). Fut çelësin edhe këtu nëse dëshiron që shfletuesi ta dërgojë te
                    proxy (p.sh. kur mungon në server).
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.useOpenRouter}
              aria-label="Përdor OpenRouter"
              onClick={() =>
                onChange({ ...settings, useOpenRouter: !settings.useOpenRouter })
              }
              className={`relative h-8 w-14 shrink-0 self-end rounded-full transition duration-200 sm:self-center ${
                settings.useOpenRouter ? 'bg-violet-600' : 'bg-[#E5E7EB]'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition duration-200 ${
                  settings.useOpenRouter ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="mt-4 border-t border-violet-200/80 pt-4">
            <label
              htmlFor="openrouter-key"
              className="block text-sm font-medium text-[#1F2937]"
            >
              OpenRouter API Key
            </label>
            <input
              id="openrouter-key"
              type="password"
              autoComplete="off"
              value={settings.openRouterApiKey}
              onChange={(e) =>
                onChange({
                  ...settings,
                  openRouterApiKey: e.target.value,
                })
              }
              onBlur={(e) => {
                const t = e.target.value.trim()
                onChange({ ...settings, openRouterApiKey: t })
                writeOpenRouterKeyToLocalStorage(t)
              }}
              placeholder="sk-or-v1-... (nga openrouter.ai → Keys)"
              className="mt-2 w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#1F2937] shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <p className="mt-2 text-xs leading-relaxed text-[#1F2937]/60">
              {useServerOpenAiKey ? (
                <>
                  Ndiz OpenRouter dhe ruaj: kërkesat te{' '}
                  <code className="rounded bg-white/80 px-1 text-[11px]">/api/ai</code> /{' '}
                  <code className="rounded bg-white/80 px-1 text-[11px]">/api/chat</code>{' '}
                  mund të përfshijnë këtë çelës si <code className="rounded bg-white/80 px-1 text-[11px]">Authorization</code>{' '}
                  kur mungon në server.
                </>
              ) : (
                <>
                  Fut çelësin këtu, pastaj{' '}
                  <strong className="font-medium text-[#1F2937]/75">ndiz</strong> OpenRouter me
                  ndërprerësin më lart. Pa ndezje, aplikacioni përdor fushat OpenAI / Anthropic /
                  DeepSeek më poshtë.
                </>
              )}
            </p>
          </div>
        </div>

        {!useServerOpenAiKey && !settings.useOpenRouter && (
          <div className="space-y-5">
            <div>
              <label
                htmlFor="api-key"
                className="flex items-center gap-2 text-sm font-medium text-[#1F2937]"
              >
                <KeyRound className="h-4 w-4 text-[#3B82F6]" aria-hidden />
                OpenAI API Key
              </label>
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                value={settings.apiKey}
                onChange={(e) =>
                  onChange({ ...settings, apiKey: e.target.value.trim() })
                }
                placeholder="sk-..."
                className="mt-2 w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#1F2937] shadow-sm transition focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
            <div>
              <label
                htmlFor="anthropic-key"
                className="block text-sm font-medium text-[#1F2937]"
              >
                Anthropic API Key (për Krahaso AI — Claude)
              </label>
              <input
                id="anthropic-key"
                type="password"
                autoComplete="off"
                value={settings.anthropicApiKey}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    anthropicApiKey: e.target.value.trim(),
                  })
                }
                placeholder="sk-ant-..."
                className="mt-2 w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#1F2937] shadow-sm transition focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
            <div>
              <label
                htmlFor="deepseek-key"
                className="block text-sm font-medium text-[#1F2937]"
              >
                DeepSeek API Key (për Krahaso AI — DeepSeek)
              </label>
              <input
                id="deepseek-key"
                type="password"
                autoComplete="off"
                value={settings.deepseekApiKey}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    deepseekApiKey: e.target.value.trim(),
                  })
                }
                placeholder="sk-..."
                className="mt-2 w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm text-[#1F2937] shadow-sm transition focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="model"
            className="block text-sm font-medium text-[#1F2937]"
          >
            Modeli
          </label>
          <select
            id="model"
            value={settings.model}
            onChange={(e) =>
              onChange({
                ...settings,
                model: e.target.value as AppSettings['model'],
              })
            }
            className="mt-2 w-full min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#1F2937] focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
          >
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-4">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-[#3B82F6]" aria-hidden />
            <div>
              <p className="text-sm font-medium text-[#1F2937]">Zëri (TTS)</p>
              <p className="text-xs text-[#1F2937]/55">
                Aktivizo leximin me zë të shpjegimeve
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.voiceEnabled}
            onClick={() =>
              onChange({ ...settings, voiceEnabled: !settings.voiceEnabled })
            }
            className={`relative h-8 w-14 shrink-0 rounded-full transition duration-200 ${
              settings.voiceEnabled ? 'bg-[#3B82F6]' : 'bg-[#E5E7EB]'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition duration-200 ${
                settings.voiceEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={onSave}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0A0F2C] text-sm font-semibold text-white shadow-[0_4px_14px_rgba(10,15,44,0.2)] transition hover:scale-[1.02] hover:bg-[#121836]"
        >
          <Save className="h-4 w-4" />
          Ruaj cilësimet
        </button>

        {savedHint && (
          <p className="text-center text-sm font-medium text-[#3B82F6]">
            U ruajt me sukses.
          </p>
        )}
      </div>
    </div>
  )
}
