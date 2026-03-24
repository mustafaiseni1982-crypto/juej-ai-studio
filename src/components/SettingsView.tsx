import { Cpu, Save, Server, Volume2 } from 'lucide-react'
import type { AppSettings } from '../types'

interface SettingsViewProps {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  onSave: () => void
  savedHint: boolean
  useServerOpenAiKey?: boolean
}

export function SettingsView({
  settings,
  onChange,
  onSave,
  savedHint,
  useServerOpenAiKey = true,
}: SettingsViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-8">
      <div className="glass-panel mx-auto w-full max-w-lg p-8 sm:p-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#6366f1] shadow-[0_0_32px_rgba(59,130,246,0.35)]">
            <Cpu className="h-6 w-6 text-white" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              System Settings
            </h1>
            <p className="mt-1.5 text-sm text-[#94a3b8]">
              AI backend configuration
            </p>
          </div>
        </div>

        {useServerOpenAiKey ? (
          <div className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Server className="h-4 w-4 text-[#60a5fa]" aria-hidden />
              Backend (Railway)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
              Të gjitha kërkesat shkojnë te{' '}
              <code className="rounded-md bg-black/30 px-1.5 py-0.5 text-xs text-slate-300">
                VITE_API_BASE_URL
              </code>{' '}
              +{' '}
              <code className="rounded-md bg-black/30 px-1.5 py-0.5 text-xs text-slate-300">
                /api/chat
              </code>{' '}
              dhe{' '}
              <code className="rounded-md bg-black/30 px-1.5 py-0.5 text-xs text-slate-300">
                /api/ai
              </code>
              . Çelësat API vendosen vetëm në Railway (p.sh.{' '}
              <code className="rounded bg-black/30 px-1 text-[11px]">
                OPENROUTER_API_KEY
              </code>
              ).
            </p>
          </div>
        ) : null}

        <div className="space-y-8">
          <section>
            <label
              htmlFor="model"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#94a3b8]"
            >
              Default model
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
              className="premium-input premium-select min-h-[52px] cursor-pointer font-medium shadow-[0_0_20px_rgba(59,130,246,0.08)]"
            >
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
            </select>
          </section>

          <section className="flex items-center justify-between gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6]/20 to-[#6366f1]/10 text-[#60a5fa]">
                <Volume2 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-white">Voice (TTS)</p>
                <p className="mt-0.5 text-sm text-[#94a3b8]">
                  Read explanations aloud
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.voiceEnabled}
              data-on={settings.voiceEnabled ? 'true' : 'false'}
              className="premium-switch"
              onClick={() =>
                onChange({ ...settings, voiceEnabled: !settings.voiceEnabled })
              }
            >
              <span className="premium-switch-thumb" />
            </button>
          </section>

          <button type="button" onClick={onSave} className="btn-premium-primary w-full">
            <Save className="h-4 w-4" aria-hidden />
            Save preferences
          </button>

          {savedHint ? (
            <p
              className="text-center text-sm font-medium text-[#60a5fa]"
              role="status"
            >
              Saved successfully.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
