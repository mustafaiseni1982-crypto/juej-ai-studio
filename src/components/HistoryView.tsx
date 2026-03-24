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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold text-[#0A0F2C]">Historia e bisedave</h1>
      <p className="mt-1 text-sm text-[#1F2937]/65">
        Kliko për të rifilluar një bisedë. Të dhënat janë në këtë pajisje.
      </p>

      {sorted.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-10 text-center text-sm text-[#1F2937]/60">
          Nuk ka ende biseda të ruajtura.
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {sorted.map((c) => (
            <li
              key={c.id}
              className="flex items-stretch gap-2 rounded-xl border border-[#E5E7EB] bg-white shadow-sm transition hover:border-[#3B82F6]/30"
            >
              <button
                type="button"
                onClick={() => onOpen(c)}
                className="flex min-h-[56px] flex-1 items-center gap-3 px-4 py-3 text-left transition hover:scale-[1.01]"
              >
                <MessageSquare className="h-5 w-5 shrink-0 text-[#3B82F6]" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#1F2937]">
                    {c.title}
                  </p>
                  <p className="text-xs text-[#1F2937]/50">
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
                className="flex min-h-[56px] min-w-[52px] touch-manipulation items-center justify-center rounded-r-xl border-l border-[#E5E7EB] text-[#1F2937]/45 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Fshi"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
