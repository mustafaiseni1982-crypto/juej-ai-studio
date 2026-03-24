export type LiveCodeParts = {
  html: string
  css: string
  js: string
}

function fence(
  text: string,
  lang: string,
): RegExpMatchArray | null {
  const re = new RegExp(
    '```\\s*' + lang + '\\s*([\\s\\S]*?)```',
    'i',
  )
  return text.match(re)
}

/**
 * Nxjerr <style> / <script> / përmbajtje body nga një dokument HTML i përzier.
 */
export function trySplitMixedHtmlSource(raw: string): LiveCodeParts | null {
  const s = raw.trim()
  if (!s) return null

  const hasStyle = /<style\b/i.test(s)
  const hasScript = /<script\b/i.test(s)
  const hasBody = /<body\b/i.test(s)
  const looksLikeDoc = /<!DOCTYPE/i.test(s) || /<html\b/i.test(s)

  if (!hasStyle && !hasScript && !hasBody && !looksLikeDoc) return null

  let css = ''
  let js = ''
  let work = s

  work = work.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, inner) => {
    css += (css ? '\n' : '') + String(inner).trim()
    return ''
  })
  work = work.replace(
    /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi,
    (full, attrs, inner) => {
      const a = String(attrs || '')
      if (/\bsrc\s*=/i.test(a)) return full
      js += (js ? '\n' : '') + String(inner).trim()
      return ''
    },
  )

  const bodyM = work.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let html = bodyM ? bodyM[1].trim() : ''

  if (!html) {
    html = work
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .trim()
  }

  if (!html && !css && !js) return null
  return { html, css, js }
}

/**
 * Nxjerr blloqe ```html```, ```css```, ```js``` / ```javascript```.
 * Nëse mungon ndarja, provo të ndash nga një dokument i vetëm HTML.
 */
export function extractCodeBlocks(text: string): LiveCodeParts {
  const htmlM = fence(text, 'html')
  const cssM = fence(text, 'css')
  const jsM =
    text.match(/```\s*javascript\s*([\s\S]*?)```/i) ??
    text.match(/```\s*js\s*([\s\S]*?)```/i)

  let html = htmlM ? htmlM[1].trim() : ''
  let css = cssM ? cssM[1].trim() : ''
  let js = jsM ? jsM[1].trim() : ''

  if (html && (/<!DOCTYPE/i.test(html) || /<html\b/i.test(html))) {
    const split = trySplitMixedHtmlSource(html)
    if (split) {
      html = split.html || html
      if (!css) css = split.css
      if (!js) js = split.js
    }
  }

  if (!html && !css && !js) {
    const htmM = text.match(/```\s*htm(?:l)?\s*([\s\S]*?)```/i)
    if (htmM) {
      const chunk = htmM[1].trim()
      const split = trySplitMixedHtmlSource(chunk)
      if (split) {
        html = split.html
        css = split.css
        js = split.js
      } else {
        html = chunk
      }
    }
  }

  if (!html && !css && !js) {
    const generic = text.match(/```(?:\w+)?\s*([\s\S]*?)```/)
    if (generic) {
      const chunk = generic[1].trim()
      if (
        /<style\b/i.test(chunk) ||
        /<script\b/i.test(chunk) ||
        /<body\b/i.test(chunk) ||
        /<!DOCTYPE/i.test(chunk) ||
        /<html\b/i.test(chunk)
      ) {
        const split = trySplitMixedHtmlSource(chunk)
        if (split) {
          html = split.html
          css = split.css
          js = split.js
        }
      }
    }
  }

  return { html, css, js }
}

export function hasLivePreviewContent(parts: LiveCodeParts): boolean {
  return Boolean(parts.html.trim() || parts.css.trim() || parts.js.trim())
}

export function buildPreviewDocument(
  html: string,
  css: string,
  js: string,
): string {
  const safeCss = (css || '').replace(/<\/style>/gi, '<\\/style>')
  const safeJs = (js || '').replace(/<\/script>/gi, '<\\/script>')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${safeCss}
  </style>
</head>
<body>
${html || ''}
  <script>
${safeJs}
  <\/script>
</body>
</html>`
}
