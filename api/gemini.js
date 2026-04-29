/**
 * Production proxy for Gemini generateContent.
 * Body: { model, contents, generationConfig } (same fields as client sends).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const key = process.env.GEMINI_API_KEY
  if (!key?.trim()) {
    return res.status(500).json({
      error: {
        message:
          'GEMINI_API_KEY is missing. Add it in Vercel → Project → Settings → Environment Variables (Production).',
      },
    })
  }

  const { model, contents, generationConfig } = req.body || {}
  if (!model) {
    return res.status(400).json({ error: { message: 'Missing model in request body' } })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({ contents, generationConfig }),
  })

  const text = await upstream.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { error: { message: text || upstream.statusText } }
  }
  res.status(upstream.status).json(data)
}
