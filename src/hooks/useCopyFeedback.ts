import { useCallback, useRef, useState } from 'react'
import { copyTextToClipboard } from '../lib/clipboard'

/**
 * Kopjim me mesazh të përkohshëm ("Copied!" / gabim / bosh).
 */
export function useCopyFeedback(dismissMs = 2200) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const copy = useCallback(
    async (
      text: string,
      options?: { emptyHint?: string },
    ): Promise<boolean> => {
      const emptyHint = options?.emptyHint ?? 'Nothing to copy'
      if (!text.trim()) {
        clearTimer()
        setFeedback(emptyHint)
        timerRef.current = setTimeout(() => setFeedback(null), dismissMs)
        return false
      }
      const ok = await copyTextToClipboard(text)
      clearTimer()
      setFeedback(ok ? 'Copied!' : 'Copy failed')
      timerRef.current = setTimeout(() => setFeedback(null), dismissMs)
      return ok
    },
    [clearTimer, dismissMs],
  )

  return { copy, feedback }
}
