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
        className={`fixed inset-0 z-40 bg-[#0A0F2C]/40 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!mobileOpen}
        onClick={onCloseMobile}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col border-r border-white/10 bg-[#0A0F2C] text-white transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-6">
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
              JUEJ AI
            </span>
            <span className="text-lg font-semibold tracking-tight">Code</span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-2 text-white/70 transition hover:scale-[1.02] hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Mbyll menunë"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 pb-6">
          {items.map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onNavigate(id)
                  onCloseMobile()
                }}
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition duration-200 hover:scale-[1.02] ${
                  isActive
                    ? 'bg-[#3B82F6] text-white shadow-[0_4px_14px_rgba(59,130,246,0.25)]'
                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/40">
          JUEJ AI Code © {new Date().getFullYear()}
        </div>
      </aside>
    </>
  )
}
