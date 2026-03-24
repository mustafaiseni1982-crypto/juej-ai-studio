/**
 * Kopjim që funksionon edhe në Safari / iOS ku `navigator.clipboard` dështon shpesh.
 * Mos përdor `readonly` në textarea për fallback — në iOS zakonisht bllokon përzgjedhjen.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof document === 'undefined') return false

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback */
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('aria-hidden', 'true')
    ta.style.position = 'fixed'
    ta.style.left = '0'
    ta.style.top = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.padding = '0'
    ta.style.margin = '0'
    ta.style.border = 'none'
    ta.style.outline = 'none'
    ta.style.boxShadow = 'none'
    ta.style.background = 'transparent'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'

    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    if (typeof ta.setSelectionRange === 'function') {
      ta.setSelectionRange(0, text.length)
    }

    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
