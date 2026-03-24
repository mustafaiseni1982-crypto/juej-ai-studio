import {
  Bug,
  Code2,
  Columns2,
  History,
  ImageUp,
  MessageSquare,
  Palette,
  PanelLeftClose,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { NavId } from '../types'

const items: { id: NavId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Bisedë', icon: MessageSquare },
  { id: 'editor', label: 'Redaktori i kodit', icon: Code2 },
  { id: 'explain', label: 'Shpjego kodin', icon: Sparkles },
  { id: 'debug', label: 'Debug', icon: Bug },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'imageToUi', label: 'Image to UI', icon: ImageUp },
  { id: 'compare', label: 'Compare AI', icon: Columns2 },
  { id: 'history', label: 'Historia', icon: History },
  { id: 'settings', label: 'Cilësimet', icon: Settings },
]

interface SidebarProps {
  active: NavId
  onNavigate: (id: NavId) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({
  active,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[#0b0f1a]/70 backdrop-blur-md transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!mobileOpen}
        onClick={onCloseMobile}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[272px] flex-col border-r border-white/[0.08] transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background:
            'linear-gradient(165deg, rgba(18, 24, 48, 0.95) 0%, rgba(11, 15, 26, 0.98) 45%, #0b0f1a 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-6">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              JUEJ AI
            </span>
            <span className="mt-0.5 text-lg font-semibold tracking-tight text-white">
              Studio
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-xl p-2 text-slate-400 transition duration-200 hover:-translate-y-px hover:bg-white/[0.06] hover:text-white lg:hidden"
            aria-label="Mbyll menunë"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
          {items.slice(0, 4).map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onNavigate(id)
                  onCloseMobile()
                }}
                className={`group relative flex min-h-[46px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13px] font-medium transition duration-200 ease-out ${
                  isActive
                    ? 'scale-[1.03] bg-gradient-to-r from-[#3b82f6]/25 to-[#6366f1]/15 text-white shadow-[0_0_28px_rgba(59,130,246,0.28),inset_0_0_0_1px_rgba(59,130,246,0.25)]'
                    : 'text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition duration-200 ${
                    isActive
                      ? 'text-[#60a5fa] drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                  aria-hidden
                />
                {label}
              </button>
            )
          })}

          <div
            className="my-3 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"
            role="separator"
          />

          {items.slice(4, 7).map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onNavigate(id)
                  onCloseMobile()
                }}
                className={`group relative flex min-h-[46px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13px] font-medium transition duration-200 ease-out ${
                  isActive
                    ? 'scale-[1.03] bg-gradient-to-r from-[#3b82f6]/25 to-[#6366f1]/15 text-white shadow-[0_0_28px_rgba(59,130,246,0.28),inset_0_0_0_1px_rgba(59,130,246,0.25)]'
                    : 'text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition duration-200 ${
                    isActive
                      ? 'text-[#60a5fa] drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                  aria-hidden
                />
                {label}
              </button>
            )
          })}

          <div
            className="my-3 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"
            role="separator"
          />

          {items.slice(7).map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onNavigate(id)
                  onCloseMobile()
                }}
                className={`group relative flex min-h-[46px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13px] font-medium transition duration-200 ease-out ${
                  isActive
                    ? 'scale-[1.03] bg-gradient-to-r from-[#3b82f6]/25 to-[#6366f1]/15 text-white shadow-[0_0_28px_rgba(59,130,246,0.28),inset_0_0_0_1px_rgba(59,130,246,0.25)]'
                    : 'text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition duration-200 ${
                    isActive
                      ? 'text-[#60a5fa] drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                  aria-hidden
                />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-white/[0.06] px-5 py-4 text-[11px] leading-relaxed text-slate-500">
          JUEJ AI Code © {new Date().getFullYear()}
        </div>
      </aside>
    </>
  )
}
