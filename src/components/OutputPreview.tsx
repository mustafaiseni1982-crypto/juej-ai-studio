interface OutputPreviewProps {
  srcDoc: string | null
  visible: boolean
}

export function OutputPreview({ srcDoc, visible }: OutputPreviewProps) {
  if (!visible) return null
  return (
    <div className="flex min-h-[140px] flex-col border-t border-[#E5E7EB] bg-[#FAFAFA]">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1F2937]/70">
          Parapamja e daljes
        </span>
      </div>
      <iframe
        title="Parapamje"
        className="h-[min(280px,40vh)] w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={srcDoc || '<!DOCTYPE html><html><body style="font-family:system-ui;padding:1rem;color:#64748b">Shtyp &quot;Ekzekuto&quot; për të parë rezultatin.</body></html>'}
      />
    </div>
  )
}
