import { MessageSquare, Trash2 } from 'lucide-react'
import type { Conversation } from '../types'

interface HistoryViewProps {
  items: Conversation[]
  onOpen: (c: Conversation) => void
  onDelete: (id: string) => void
}

export function HistoryView({ items, onOpen, onDelete }: HistoryViewProps) {
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Historia e bisedave
        </h1>
        <p className="mt-2 text-sm text-[#94a3b8]">
          Kliko për të rifilluar një bisedë. Të dhënat janë në këtë pajisje.
        </p>

        {sorted.length === 0 ? (
          <div className="glass-panel-subtle mt-10 border border-dashed border-white/[0.12] p-12 text-center text-sm text-[#94a3b8]">
            Nuk ka ende biseda të ruajtura.
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {sorted.map((c) => (
              <li
                key={c.id}
                className="glass-panel overflow-hidden !rounded-2xl transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]"
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => onOpen(c)}
                    className="flex min-h-[56px] flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                  >
                    <MessageSquare
                      className="h-5 w-5 shrink-0 text-[#60a5fa]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{c.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(c.updatedAt).toLocaleString('sq-AL')}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(c.id)
                    }}
                    className="flex min-h-[56px] min-w-[52px] touch-manipulation items-center justify-center border-l border-white/[0.08] text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                    aria-label="Fshi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
