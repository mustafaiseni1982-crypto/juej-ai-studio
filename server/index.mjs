/**
 * Proxy për OpenAI + /api/ai shumë-furnizues (OpenAI, Anthropic, DeepSeek).
 * Nis: npm run server
 * Me Vite: VITE_OPENAI_PROXY=true + proxy në vite.config
 */
import http from 'node:http'

const PORT = process.env.PORT || 10000

/** Hapësirat e panevojshme në .env bëjnë që çelësi të duket i vendosur por Bearer dërgohet bosh — OpenRouter: "Missing Authentication header". */
function cleanEnvKey(name) {
  const v = process.env[name]
  if (typeof v !== 'string') return ''
  const t = v.trim()
  return t || ''
}

const OPENAI_KEY = cleanEnvKey('OPENAI_API_KEY')
const ANTHROPIC_KEY = cleanEnvKey('ANTHROPIC_API_KEY')
const DEEPSEEK_KEY = cleanEnvKey('DEEPSEEK_API_KEY')
/** Një çelës për të gjitha modelet përmes OpenRouter (alternativë ndaj çelësave të veçantë). */
const OPENROUTER_KEY = cleanEnvKey('OPENROUTER_API_KEY')
const OPENROUTER_REFERER =
  cleanEnvKey('OPENROUTER_HTTP_REFERER') || 'http://127.0.0.1:5173'

const ALLOWED_MODEL_IDS = new Set([
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'deepseek/deepseek-chat',
])

/** MIME types OpenRouter lists for vision inputs (image/jpg is non-standard — normalize). */
const VISION_ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

function normalizeVisionMime(mime) {
  const m = String(mime || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
  if (m === 'image/jpg' || m === 'image/pjpeg') return 'image/jpeg'
  return m || 'image/png'
}

function sanitizeVisionBase64(b64) {
  return String(b64).replace(/[\s\r\n]+/g, '')
}

function humanizeProviderErrorMessage(msg) {
  const s = String(msg)
  if (/did not match the expected pattern/i.test(s)) {
    return 'The image could not be processed by the AI provider. Try a smaller PNG or JPG, or re-export the screenshot.'
  }
  if (/missing authentication header/i.test(s)) {
    return 'OPENROUTER_API_KEY mungon ose është i pavlefshëm në server. Vendos çelësin në mjedis (pa hapësira para/pas) dhe rinise proxy-n.'
  }
  return s
}

/** @returns {{ mode: 'none' } | { mode: 'error', message: string } | { mode: 'url', url: string }} */
function getVisionImageUrlFromBody(body) {
  // Kontrata e përbashkët: `image` = data URL e plotë (data:image/png;base64,...)
  // ose `imageDataUrl` / `imageBase64` për përputhshmëri.
  const dataUrl = [
    typeof body.image === 'string' ? body.image.trim() : '',
    typeof body.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '',
  ]
    .find(Boolean) || ''
  const rawField =
    typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : ''

  if (!dataUrl && !rawField) return { mode: 'none' }

  if (dataUrl) {
    if (/^blob:/i.test(dataUrl)) {
      return {
        mode: 'error',
        message:
          'Invalid image reference. Please choose the file again from your device (do not paste a preview URL).',
      }
    }
    const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i.exec(dataUrl)
    if (!m) {
      return {
        mode: 'error',
        message:
          'Invalid image data. Export as PNG or JPG and upload again.',
      }
    }
    const mime = normalizeVisionMime(m[1])
    if (!VISION_ALLOWED_MIMES.has(mime)) {
      return {
        mode: 'error',
        message:
          'Unsupported image type. Use PNG, JPEG, WebP, or GIF.',
      }
    }
    const b64 = sanitizeVisionBase64(m[2])
    if (!b64) {
      return { mode: 'error', message: 'Image data was empty. Try another file.' }
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) {
      return {
        mode: 'error',
        message: 'Image data looks corrupted. Try re-exporting the image.',
      }
    }
    if (b64.length > 14 * 1024 * 1024) {
      return {
        mode: 'error',
        message: 'Image is too large. Use a file under 5 MB or a smaller screenshot.',
      }
    }
    return { mode: 'url', url: `data:${mime};base64,${b64}` }
  }

  const b64 = sanitizeVisionBase64(
    rawField.replace(/^data:[^;]+;base64,\s*/i, ''),
  )
  if (!b64) {
    return { mode: 'error', message: 'Image data was empty. Try another file.' }
  }
  let mime = normalizeVisionMime(
    typeof body.imageMimeType === 'string' && body.imageMimeType.trim()
      ? body.imageMimeType.trim()
      : 'image/png',
  )
  if (!VISION_ALLOWED_MIMES.has(mime)) {
    return {
      mode: 'error',
      message: 'Unsupported image type. Use PNG, JPEG, WebP, or GIF.',
    }
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) {
    return {
      mode: 'error',
      message: 'Image data looks corrupted. Try re-exporting the image.',
    }
  }
  if (b64.length > 14 * 1024 * 1024) {
    return {
      mode: 'error',
      message: 'Image is too large. Use a file under 5 MB or a smaller screenshot.',
    }
  }
  return { mode: 'url', url: `data:${mime};base64,${b64}` }
}

function allowOrigin(origin) {
  if (!origin) return '*'
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    return origin
  return 'null'
}

function corsHeaders(req) {
  const origin = req.headers.origin ?? ''
  return {
    'Access-Control-Allow-Origin': allowOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

/** Çelës OpenRouter nga klienti kur nuk ka OPENROUTER_API_KEY në server. */
function extractBearerToken(req) {
  const raw = req.headers.authorization
  if (typeof raw !== 'string') return ''
  const m = /^Bearer\s+(\S+)/i.exec(raw.trim())
  if (!m) return ''
  const t = m[1].trim()
  return t || ''
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function json(res, status, cors, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors })
  res.end(JSON.stringify(body))
}

async function openRouterChat(messages, modelSlug, apiKey, options = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : ''
  if (!key) {
    throw new Error(
      'OPENROUTER_API_KEY mungon ose është bosh në server. Vendos një çelës të vlefshëm në mjedis.',
    )
  }
  const payload = {
    model: modelSlug,
    messages,
    temperature: 0.65,
  }
  if (options.maxTokens != null) payload.max_tokens = options.maxTokens

  const upstream = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': OPENROUTER_REFERER,
        'X-Title': 'JUEJ AI Code',
      },
      body: JSON.stringify(payload),
    },
  )
  const text = await upstream.text()
  if (!upstream.ok) {
    if (options.logFullErrorResponse) {
      console.error(
        '[OpenRouter vision/multimodal] HTTP',
        upstream.status,
        '— full body:',
        text,
      )
    }
    let msg = upstream.statusText
    try {
      const err = JSON.parse(text)
      if (err.error?.message) msg = err.error.message
      else if (typeof err.message === 'string') msg = err.message
    } catch {
      /* ignore */
    }
    throw new Error(humanizeProviderErrorMessage(msg))
  }
  const data = JSON.parse(text)
  const raw = data.choices?.[0]?.message?.content
  let reply
  if (typeof raw === 'string') reply = raw
  else if (Array.isArray(raw)) {
    reply = raw
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
  }
  if (!reply || typeof reply !== 'string') {
    throw new Error('Përgjigje e zbrazët nga OpenRouter.')
  }
  return reply
}

async function openAiChat(messages, model, apiKey) {
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.65,
    }),
  })
  const text = await upstream.text()
  if (!upstream.ok) {
    let msg = upstream.statusText
    try {
      const err = JSON.parse(text)
      if (err.error?.message) msg = err.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const data = JSON.parse(text)
  const raw = data.choices?.[0]?.message?.content
  let reply
  if (typeof raw === 'string') reply = raw
  else if (Array.isArray(raw)) {
    reply = raw
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
  }
  if (!reply || typeof reply !== 'string') {
    throw new Error('Përgjigje e zbrazët nga OpenAI.')
  }
  return reply
}

async function deepseekChat(messages, apiKey) {
  const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.65,
    }),
  })
  const text = await upstream.text()
  if (!upstream.ok) {
    let msg = upstream.statusText
    try {
      const err = JSON.parse(text)
      if (err.error?.message) msg = err.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const data = JSON.parse(text)
  const reply = data.choices?.[0]?.message?.content
  if (!reply || typeof reply !== 'string') {
    throw new Error('Përgjigje e zbrazët nga DeepSeek.')
  }
  return reply
}

async function anthropicChat(messages, apiKey) {
  const systemParts = []
  const rest = []
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content)
      continue
    }
    if (m.role === 'user' || m.role === 'assistant') {
      const last = rest[rest.length - 1]
      if (last && last.role === m.role) {
        last.content = `${last.content}\n\n${m.content}`
      } else {
        rest.push({ role: m.role, content: m.content })
      }
    }
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      temperature: 0.65,
      system: systemParts.join('\n\n').trim() || undefined,
      messages: rest,
    }),
  })
  const text = await upstream.text()
  if (!upstream.ok) {
    let msg = upstream.statusText
    try {
      const err = JSON.parse(text)
      if (err.error?.message) msg = err.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const data = JSON.parse(text)
  const blocks = data.content ?? []
  const reply = blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
  if (!reply) throw new Error('Përgjigje e zbrazët nga Anthropic.')
  return reply
}

async function handleMultiAi(req, body, cors, res) {
  let modelId
  let messages

  if (
    typeof body?.prompt === 'string' &&
    typeof body?.model === 'string' &&
    ALLOWED_MODEL_IDS.has(body.model)
  ) {
    modelId = body.model
    const vision = getVisionImageUrlFromBody(body)
    if (vision.mode === 'error') {
      json(res, 400, cors, { error: { message: vision.message } })
      return
    }
    if (vision.mode === 'url') {
      messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: body.prompt },
            {
              type: 'image_url',
              image_url: { url: vision.url },
            },
          ],
        },
      ]
    } else {
      messages = [{ role: 'user', content: body.prompt }]
    }
  } else if (
    typeof body?.modelId === 'string' &&
    ALLOWED_MODEL_IDS.has(body.modelId) &&
    Array.isArray(body.messages)
  ) {
    modelId = body.modelId
    messages = body.messages
  } else {
    json(res, 400, cors, {
      error: {
        message:
          'Dërgo { model, prompt } ose { modelId, messages } me model të lejuar.',
      },
    })
    return
  }

  const hasVisionImage = messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((p) => p && p.type === 'image_url'),
  )

  const bearerKey = extractBearerToken(req)
  const openRouterForRequest = OPENROUTER_KEY || bearerKey

  if (
    hasVisionImage &&
    !openRouterForRequest &&
    modelId !== 'openai/gpt-4o' &&
    modelId !== 'openai/gpt-4o-mini'
  ) {
    json(res, 400, cors, {
      error: {
        message:
          'Imazhi kërkon OpenRouter (Authorization ose OPENROUTER_API_KEY në server) ose model openai/gpt-4o / openai/gpt-4o-mini me OpenAI API key.',
      },
    })
    return
  }

  try {
    let reply
    if (openRouterForRequest) {
      reply = await openRouterChat(messages, modelId, openRouterForRequest, {
        maxTokens: hasVisionImage ? 8192 : undefined,
        logFullErrorResponse: hasVisionImage,
      })
      json(res, 200, cors, { reply, output: reply })
      return
    }

    if (modelId === 'openai/gpt-4o') {
      if (!OPENAI_KEY) {
        json(res, 500, cors, {
          error: { message: 'OPENAI_API_KEY mungon në server.' },
        })
        return
      }
      reply = await openAiChat(messages, 'gpt-4o', OPENAI_KEY)
    } else if (modelId === 'deepseek/deepseek-chat') {
      if (!DEEPSEEK_KEY) {
        json(res, 500, cors, {
          error: { message: 'DEEPSEEK_API_KEY mungon në server.' },
        })
        return
      }
      reply = await deepseekChat(messages, DEEPSEEK_KEY)
    } else if (modelId === 'anthropic/claude-3.5-sonnet') {
      if (!ANTHROPIC_KEY) {
        json(res, 500, cors, {
          error: { message: 'ANTHROPIC_API_KEY mungon në server.' },
        })
        return
      }
      reply = await anthropicChat(messages, ANTHROPIC_KEY)
    } else {
      json(res, 400, cors, { error: { message: 'Model i panjohur.' } })
      return
    }
    json(res, 200, cors, { reply, output: reply })
  } catch (e) {
    if (hasVisionImage) {
      console.error('[ /api/ai ] Vision request failed:', e)
    }
    const msg = humanizeProviderErrorMessage(
      e instanceof Error ? e.message : String(e),
    )
    json(res, 502, cors, { error: { message: msg } })
  }
}

const server = http.createServer(async (req, res) => {
  const cors = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }

  const path = req.url?.split('?')[0] ?? ''

  if (req.method === 'POST' && path === '/api/ai') {
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      json(res, 400, cors, { error: { message: 'JSON i pavlefshëm' } })
      return
    }
    await handleMultiAi(req, body, cors, res)
    return
  }

  if (req.method !== 'POST' || path !== '/api/chat') {
    res.writeHead(404, { 'Content-Type': 'application/json', ...cors })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  if (!OPENROUTER_KEY && !OPENAI_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json', ...cors })
    res.end(
      JSON.stringify({
        error: {
          message:
            'Vendos OPENROUTER_API_KEY ose OPENAI_API_KEY në mjedis përpara se të nisësh serverin.',
        },
      }),
    )
    return
  }

  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...cors })
    res.end(JSON.stringify({ error: { message: 'JSON i pavlefshëm' } }))
    return
  }

  const { messages, model } = body
  if (!Array.isArray(messages) || typeof model !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json', ...cors })
    res.end(
      JSON.stringify({
        error: {
          message:
            'Fushat "messages" (array) dhe "model" (string) janë të detyrueshme.',
        },
      }),
    )
    return
  }

  try {
    const openRouterForChat = OPENROUTER_KEY || extractBearerToken(req)
    if (openRouterForChat) {
      const orModel =
        model === 'gpt-4o' ? 'openai/gpt-4o' : 'openai/gpt-4o-mini'
      const reply = await openRouterChat(messages, orModel, openRouterForChat)
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors })
      res.end(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: reply } }],
        }),
      )
      return
    }

    const upstream = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.65,
        }),
      },
    )
    const text = await upstream.text()
    res.writeHead(upstream.status, {
      'Content-Type': 'application/json',
      ...cors,
    })
    res.end(text)
  } catch (e) {
    const msg = humanizeProviderErrorMessage(
      e instanceof Error ? e.message : String(e),
    )
    res.writeHead(502, { 'Content-Type': 'application/json', ...cors })
    res.end(JSON.stringify({ error: { message: msg } }))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT)
})
