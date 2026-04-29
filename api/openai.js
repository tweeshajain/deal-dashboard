/**
 * Production proxy for OpenAI Chat Completions.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const key = process.env.OPENAI_API_KEY
  if (!key?.trim()) {
    return res.status(500).json({
      error: {
        message:
          'OPENAI_API_KEY is missing. Add it in Vercel → Project → Settings → Environment Variables (Production).',
      },
    })
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
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
