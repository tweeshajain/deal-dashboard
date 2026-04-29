/**
 * Production proxy for Anthropic Messages API (keys stay on Vercel, never in the browser).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key?.trim()) {
    return res.status(500).json({
      error: {
        message:
          'ANTHROPIC_API_KEY is missing. Add it in Vercel → Project → Settings → Environment Variables (Production).',
      },
    })
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(req.body),
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
