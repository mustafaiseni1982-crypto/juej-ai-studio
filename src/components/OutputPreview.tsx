interface OutputPreviewProps {
  srcDoc: string | null
  visible: boolean
}

export function OutputPreview({ srcDoc, visible }: OutputPreviewProps) {
  if (!visible) return null
  return (
    <div className="flex min-h-[140px] flex-col border-t border-white/[0.08] bg-[#0b0f1a]/60 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
          Parapamja e daljes
        </span>
      </div>
      <iframe
        title="Parapamje"
        className="h-[min(280px,40vh)] w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={
          srcDoc ||
          '<!DOCTYPE html><html><body style="font-family:system-ui;padding:1rem;background:#0b0f1a;color:#94a3b8">Shtyp &quot;Ekzekuto&quot; për të parë rezultatin.</body></html>'
        }
      />
    </div>
  )
}
