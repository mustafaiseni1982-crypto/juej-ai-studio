export interface DesignPayload {
  html: string
  css: string
  javascript: string
  explanation: string
}

function tryParseJsonObject(text: string): DesignPayload | null {
  const trimmed = text.trim()
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>
    const html = String(o.html ?? o.body ?? '').trim()
    const css = String(o.css ?? '').trim()
    const explanation = String(
      o.explanation ?? o.shpjegim ?? o.explain ?? '',
    ).trim()
    const jsRaw = o.javascript ?? o.js
    const javascript =
      jsRaw !== undefined && jsRaw !== null ? String(jsRaw).trim() : ''
    if (!html && !css) return null
    return { html, css, javascript, explanation }
  } catch {
    return null
  }
}

/** Extract first ```json ... ``` block */
function extractJsonFence(raw: string): string | null {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : null
}

function parseFromMarkdownBlocks(raw: string): DesignPayload | null {
  const htmlM = raw.match(/```html\s*([\s\S]*?)```/i)
  const cssM = raw.match(/```css\s*([\s\S]*?)```/i)
  const jsM = raw.match(/```(?:javascript|js)\s*([\s\S]*?)```/i)
  if (!htmlM || !cssM) return null
  const html = htmlM[1].trim()
  const css = cssM[1].trim()
  const javascript = jsM ? jsM[1].trim() : ''
  const stripped = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+.*/gm, '')
    .trim()
  const explanation = stripped || 'Shpjegimi nuk u gjet në përgjigje.'
  return { html, css, javascript, explanation }
}

export function parseDesignResponse(raw: string): DesignPayload | null {
  const fenced = extractJsonFence(raw)
  if (fenced) {
    const p = tryParseJsonObject(fenced)
    if (p) return p
  }
  const direct = tryParseJsonObject(raw)
  if (direct) return direct
  return parseFromMarkdownBlocks(raw)
}

export function buildDesignSrcDoc(p: DesignPayload): string {
  const js = p.javascript.trim()
  const safeJs = js.replace(new RegExp('</script>', 'gi'), '<\\/script>')
  const script = js
    ? `<script>\n${safeJs}\n` + '</scr' + 'ipt>'
    : ''
  return `<!DOCTYPE html><html lang="sq"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Parapamje</title><style>\n${p.css}\n</style></head><body>\n${p.html}\n</body>${script}</html>`
}
