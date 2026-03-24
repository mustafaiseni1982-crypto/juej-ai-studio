/** First fenced code block in markdown, or null */
export function extractFirstCodeBlock(md: string): string | null {
  const m = md.match(/```(?:\w+)?\s*\n([\s\S]*?)```/)
  return m ? m[1].trim() : null
}

/** First fenced block + mbetja e tekstit (për panel krahasimi: kod / shpjegim). */
export function splitFirstCodeBlock(md: string): {
  code: string | null
  rest: string
} {
  const re = /```(?:\w+)?\s*\n([\s\S]*?)```/
  const m = md.match(re)
  if (!m || m.index === undefined) {
    return { code: null, rest: md.trim() }
  }
  const code = m[1].trim()
  const before = md.slice(0, m.index).trim()
  const after = md.slice(m.index + m[0].length).trim()
  const rest = [before, after].filter(Boolean).join('\n\n').trim()
  return { code, rest: rest || md.replace(m[0], '').trim() }
}

/** Strip markdown-ish noise for TTS */
export function plainTextForSpeech(md: string): string {
  let t = md.replace(/```[\s\S]*?```/g, ' [kod] ')
  t = t.replace(/^#{1,6}\s+/gm, '')
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
  t = t.replace(/\*([^*]+)\*/g, '$1')
  t = t.replace(/`([^`]+)`/g, '$1')
  return t.replace(/\s+/g, ' ').trim()
}
