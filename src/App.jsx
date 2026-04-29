import { useState, useEffect, useMemo } from 'react'

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const DEFAULT_OPENAI_MODEL = 'gpt-4o'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/**
 * Provider: VITE_AI_PROVIDER (works on Vercel without API keys at build time) wins;
 * else build-time __APP_AI_PROVIDER__ from .env keys during `vite build`.
 */
function getProvider() {
  const v = import.meta.env.VITE_AI_PROVIDER?.trim().toLowerCase()
  if (v && ['anthropic', 'openai', 'gemini'].includes(v)) return v
  return __APP_AI_PROVIDER__.toLowerCase()
}

function isProdDeployment() {
  return import.meta.env.PROD
}

function anthropicEndpoint() {
  const custom = import.meta.env.VITE_ANTHROPIC_MESSAGES_URL?.trim()
  if (custom) return custom
  return isProdDeployment() ? '/api/anthropic' : '/anthropic-proxy/v1/messages'
}

function openaiEndpoint() {
  const custom = import.meta.env.VITE_OPENAI_CHAT_URL?.trim()
  if (custom) return custom
  return isProdDeployment() ? '/api/openai' : '/openai-proxy/v1/chat/completions'
}

function anthropicBlocksToText(data) {
  if (!data?.content) return ''
  return data.content.map((b) => (b.type === 'text' ? b.text : b.text || '') || '').join('')
}

/**
 * Single user message → plain text. Dev server proxies add API keys (see vite.config.js).
 * Prod: set VITE_ANTHROPIC_MESSAGES_URL / VITE_OPENAI_CHAT_URL / VITE_GEMINI_GENERATE_URL to your backend.
 */
async function completeText(userPrompt, options = {}) {
  const maxTokens = options.maxTokens ?? 4096
  const provider = getProvider()

  if (provider === 'openai') {
    const model = import.meta.env.VITE_OPENAI_MODEL || DEFAULT_OPENAI_MODEL
    const url = openaiEndpoint()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: maxTokens,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const msg = data?.error?.message || response.statusText || 'Request failed'
      throw new Error(msg)
    }
    const out = data.choices?.[0]?.message?.content || ''
    if (!out) throw new Error('OpenAI returned no message content.')
    return out
  }

  if (provider === 'gemini') {
    const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    const custom = import.meta.env.VITE_GEMINI_GENERATE_URL?.trim()
    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }
    const url =
      custom ||
      (isProdDeployment()
        ? '/api/gemini'
        : `/gemini-proxy/models/${encodeURIComponent(model)}:generateContent`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        custom || !isProdDeployment()
          ? payload
          : { model, ...payload },
      ),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const msg = data?.error?.message || data?.error?.status || response.statusText || 'Request failed'
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(data.error))
    }
    const parts = data.candidates?.[0]?.content?.parts
    const out = parts?.map((p) => p.text || '').join('') || ''
    if (!out) {
      const block = data.promptFeedback?.blockReason
      const finish = data.candidates?.[0]?.finishReason
      const detail = [block, finish].filter(Boolean).join('; ') || JSON.stringify(data).slice(0, 280)
      throw new Error(`Empty Gemini response (${detail}). Try another model via VITE_GEMINI_MODEL.`)
    }
    return out
  }

  const model = import.meta.env.VITE_ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
  const url = anthropicEndpoint()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: false,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = data?.error?.message || response.statusText || 'Request failed'
    throw new Error(msg)
  }
  const out = anthropicBlocksToText(data)
  if (!out) throw new Error('Anthropic returned no text (check model id and API errors).')
  return out
}

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_COMPANIES = [
  { id: 1, name: 'NeuralCargo', sector: 'Logistics AI', stage: 'Seed', raised: '$2.1M', founded: 2023, hq: 'Austin, TX', founders: 'ex-SpaceX, ex-Flexport', signal: 94, traction: '3x MoM GMV', status: 'new' },
  { id: 2, name: 'HelixDx', sector: 'BioTech / Diagnostics', stage: 'Series A', raised: '$8.4M', founded: 2022, hq: 'Boston, MA', founders: 'MIT Media Lab, ex-Illumina', signal: 88, traction: 'FDA Breakthrough Device', status: 'reviewing' },
  { id: 3, name: 'GridMind', sector: 'Energy AI', stage: 'Pre-Seed', raised: '$900K', founded: 2024, hq: 'San Francisco, CA', founders: 'ex-Google DeepMind, ex-PG&E', signal: 91, traction: 'LOI with 2 utilities', status: 'new' },
  { id: 4, name: 'Pulsr', sector: 'Creator Economy', stage: 'Seed', raised: '$3.2M', founded: 2023, hq: 'New York, NY', founders: 'ex-TikTok, ex-Spotify', signal: 76, traction: '180K MAU, 40% WoW', status: 'passed' },
  { id: 5, name: 'FractalMed', sector: 'Healthcare AI', stage: 'Series A', raised: '$12M', founded: 2022, hq: 'Chicago, IL', founders: 'Stanford Med + a16z alum', signal: 85, traction: '$1.2M ARR, NPS 72', status: 'reviewing' },
  { id: 6, name: 'QuantumRoute', sector: 'Cybersecurity', stage: 'Seed', raised: '$4.5M', founded: 2023, hq: 'Seattle, WA', founders: 'ex-NSA, ex-CrowdStrike', signal: 89, traction: '4 F500 pilots', status: 'new' },
]

const statusColor = { new: '#00ff88', reviewing: '#f5a623', passed: '#ff4444', invested: '#00cfff' }
const statusLabel = { new: 'NEW SIGNAL', reviewing: 'IN REVIEW', passed: 'PASSED', invested: 'INVESTED' }

// ── Ticker ──────────────────────────────────────────────────────────────────
function Ticker() {
  const items = [
    '⬆ NeuralCargo +3x MoM GMV', '⚡ GridMind LOI w/ Pacific Gas', '🔬 HelixDx FDA Breakthrough Device',
    '📊 Pulsr 180K MAU milestone', '💊 FractalMed $1.2M ARR', '🔐 QuantumRoute 4 F500 pilots',
    '🧠 AI sector funding +62% YoY', '🌎 Climate tech deals up 44% Q1', '🚀 25 new signals processed today',
  ]
  return (
    <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1a2a1a', overflow: 'hidden', height: 28, display: 'flex', alignItems: 'center' }}>
      <div style={{ color: '#00ff88', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, background: '#00ff8822', padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', borderRight: '1px solid #00ff8844', marginRight: 16 }}>
        LIVE SIGNALS
      </div>
      <div style={{ display: 'flex', gap: 48, animation: 'ticker 30s linear infinite', whiteSpace: 'nowrap' }}>
        {[...items, ...items].map((item, i) => (
          <span key={i} style={{ color: '#888', fontFamily: 'monospace', fontSize: 10 }}>{item}</span>
        ))}
      </div>
    </div>
  )
}

// ── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const color = score >= 90 ? '#00ff88' : score >= 80 ? '#f5a623' : score >= 70 ? '#ffdd57' : '#ff6b6b'
  const r = 22
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: 58, height: 58, flexShrink: 0 }}>
      <svg width="58" height="58" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="29" cy="29" r={r} fill="none" stroke="#1a1a1a" strokeWidth="4" />
        <circle cx="29" cy="29" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 700, color }}>
        {score}
      </div>
    </div>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ seed }) {
  const pts = useMemo(() => {
    let state = (seed * 7919) >>> 0
    const rnd = () => {
      state = (1664525 * state + 1013904223) >>> 0
      return state / 0xffffffff
    }
    return Array.from({ length: 8 }, (_, i) => Math.floor(seed * 0.4 + i * seed * 0.08 + rnd() * 15))
  }, [seed])
  const max = Math.max(...pts)
  const min = Math.min(...pts)
  const w = 80
  const h = 28
  const points = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / (max - min + 1)) * h}`).join(' ')
  const gradId = `spkGrad-${seed}`
  return (
    <svg width={w} height={h}>
      <polyline points={points} fill="none" stroke="#00ff8888" strokeWidth="1.5" />
      <polyline points={`0,${h} ${points} ${w},${h}`} fill={`url(#${gradId})`} stroke="none" />
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Company Card ─────────────────────────────────────────────────────────────
function CompanyCard({ company, onClick, selected }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(company) } }}
      onClick={() => onClick(company)}
      style={{
        background: selected ? '#0d1f0d' : '#0c0c0c',
        border: `1px solid ${selected ? '#00ff8866' : '#1a1a1a'}`,
        borderLeft: `3px solid ${statusColor[company.status]}`,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#111' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = '#0c0c0c' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ScoreRing score={company.signal} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 14, fontWeight: 700, color: '#e8e8e8', letterSpacing: '0.05em' }}>{company.name}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: statusColor[company.status], background: `${statusColor[company.status]}18`, padding: '2px 6px', letterSpacing: '0.1em' }}>{statusLabel[company.status]}</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#555', marginBottom: 6 }}>
            {company.sector} · {company.stage} · {company.hq}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#00ff88' }}>↑ {company.traction}</span>
            <Sparkline seed={company.signal} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#f5a623' }}>{company.raised}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#444', marginTop: 2 }}>raised</div>
        </div>
      </div>
    </div>
  )
}

// ── Memo Panel ───────────────────────────────────────────────────────────────
function MemoPanel({ company, onClose }) {
  const [memo, setMemo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('memo')

  useEffect(() => {
    if (!company) return
    generateMemo(company)
  }, [company?.id])

  async function generateMemo(co) {
    setLoading(true)
    setMemo(null)

    const prompt = `You are a senior VC analyst at a top-tier venture fund. Generate a structured investment memo for this startup:

Company: ${co.name}
Sector: ${co.sector}
Stage: ${co.stage}
Raised: ${co.raised}
Founded: ${co.founded}
HQ: ${co.hq}
Founders: ${co.founders}
Signal Score: ${co.signal}/100
Key Traction: ${co.traction}

Write a concise investment memo with these exact sections using markdown headers:
## EXECUTIVE SUMMARY
2-3 sentences on why this is (or isn't) compelling.

## MARKET OPPORTUNITY
TAM/SAM/SOM analysis, market trends, tailwinds.

## PRODUCT & TECHNOLOGY
What they've built, technical differentiation, moat.

## COMPETITIVE LANDSCAPE
Key competitors, how ${co.name} differentiates, defensibility.

## TRACTION & METRICS
Interpret the known traction signal, implied growth rate, key unit economics assumptions.

## TEAM ASSESSMENT
Assessment of the founding team profile, pattern matching to successful founders.

## RISK FACTORS
Top 3-4 risks: execution, market, technical, regulatory.

## INVESTMENT THESIS
Bull case, base case, bear case. Suggested check size and terms for ${co.stage}.

## VERDICT
One of: STRONG PASS / PASS / WATCH / EXPLORE / RECOMMEND
One sentence explaining the verdict.

Be specific, analytical, and use real venture capital frameworks. Reference actual market data where plausible.`

    try {
      const text = await completeText(prompt, { maxTokens: 4096 })
      setMemo(text || 'Error generating memo.')
    } catch (e) {
      const hint =
        getProvider() === 'openai'
          ? 'Local: OPENAI_API_KEY in .env. Vercel: OPENAI_API_KEY in Env Vars + redeploy; set VITE_AI_PROVIDER=openai if needed.'
          : getProvider() === 'gemini'
            ? 'Local: GEMINI_API_KEY in .env. Vercel: GEMINI_API_KEY in Env Vars + redeploy; set VITE_AI_PROVIDER=gemini if needed.'
            : 'Local: ANTHROPIC_API_KEY in .env. Vercel: ANTHROPIC_API_KEY in Project → Environment Variables (Production), then Redeploy.'
      setMemo(`Error connecting to AI analyst: ${e.message}. ${hint}`)
    }
    setLoading(false)
  }

  const renderMemo = (text) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <div key={i} style={{ marginTop: 20, marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#00ff88', letterSpacing: '0.15em', fontWeight: 700 }}>
              {line.replace('## ', '▸ ')}
            </span>
            <div style={{ height: 1, background: '#00ff8822', marginTop: 4 }} />
          </div>
        )
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <div key={i} style={{ color: '#f5a623', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, marginTop: 6 }}>{line.replace(/\*\*/g, '')}</div>
      }
      if (line.startsWith('- ')) {
        return <div key={i} style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, paddingLeft: 12 }}>→ {line.slice(2)}</div>
      }
      if (line.trim() === '') return <div key={i} style={{ height: 4 }} />
      return <div key={i} style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.75 }}>{line}</div>
    })
  }

  const tabs = ['memo', 'signals', 'comparables']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080808' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#e8e8e8', letterSpacing: '0.08em' }}>{company.name}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#444', marginTop: 2 }}>{company.sector} · Founded {company.founded} · {company.hq}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ScoreRing score={company.signal} />
          <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid #222', color: '#555', fontFamily: 'monospace', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>✕ CLOSE</button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a' }}>
        {tabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            style={{ background: activeTab === tab ? '#0d1f0d' : 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #00ff88' : '2px solid transparent', color: activeTab === tab ? '#00ff88' : '#444', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {activeTab === 'memo' && (
          <>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 16 }}>
                <div style={{ width: 40, height: 40, border: '2px solid #00ff8833', borderTop: '2px solid #00ff88', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#444', letterSpacing: '0.1em' }}>RUNNING AI ANALYSIS...</div>
              </div>
            ) : memo ? (
              <div>{renderMemo(memo)}</div>
            ) : null}
          </>
        )}

        {activeTab === 'signals' && (
          <SignalsTab company={company} />
        )}

        {activeTab === 'comparables' && (
          <CompsTab company={company} />
        )}
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
        {['PASS', 'WATCH', 'EXPLORE', 'RECOMMEND'].map((action) => (
          <button key={action} type="button"
            style={{
              flex: 1, padding: '8px 4px', fontFamily: 'monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer',
              background: action === 'RECOMMEND' ? '#00ff8822' : 'none',
              border: `1px solid ${action === 'RECOMMEND' ? '#00ff88' : '#222'}`,
              color: action === 'RECOMMEND' ? '#00ff88' : action === 'PASS' ? '#ff4444' : '#555',
            }}>
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Signals Tab ──────────────────────────────────────────────────────────────
function SignalsTab({ company }) {
  const signals = [
    { label: 'FOUNDER QUALITY', value: Math.floor(company.signal * 0.9 + 5), desc: 'Team pedigree + domain expertise' },
    { label: 'MARKET TIMING', value: Math.floor(company.signal * 0.85 + 8), desc: 'Secular tailwinds, category maturity' },
    { label: 'TRACTION VELOCITY', value: Math.floor(company.signal * 1.02), desc: 'Growth rate vs. stage benchmark' },
    { label: 'COMPETITIVE MOAT', value: Math.floor(company.signal * 0.78 + 12), desc: 'Technical / network / data advantages' },
    { label: 'FUNDING EFFICIENCY', value: Math.floor(company.signal * 0.88 + 6), desc: 'Capital deployed vs. milestones hit' },
    { label: 'EXIT POTENTIAL', value: Math.floor(company.signal * 0.92 + 4), desc: 'Strategic + IPO optionality' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#444', letterSpacing: '0.1em', marginBottom: 4 }}>SIGNAL DECOMPOSITION — {company.name}</div>
      {signals.map((s) => (
        <div key={s.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#888', letterSpacing: '0.08em' }}>{s.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: s.value >= 85 ? '#00ff88' : s.value >= 70 ? '#f5a623' : '#ff6b6b', fontWeight: 700 }}>{Math.min(s.value, 99)}</span>
          </div>
          <div style={{ height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(s.value, 99)}%`, background: s.value >= 85 ? '#00ff88' : s.value >= 70 ? '#f5a623' : '#ff6b6b', borderRadius: 2, transition: 'width 1s ease', boxShadow: `0 0 8px ${s.value >= 85 ? '#00ff8866' : '#f5a62366'}` }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#333', marginTop: 2 }}>{s.desc}</div>
        </div>
      ))}
    </div>
  )
}

function parseJsonArray(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('[')
    const end = clean.lastIndexOf(']')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1))
      } catch {
        return []
      }
    }
    return []
  }
}

// ── Comps Tab ─────────────────────────────────────────────────────────────────
function CompsTab({ company }) {
  const [comps, setComps] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchComps()
  }, [company.id])

  async function fetchComps() {
    setLoading(true)
    try {
      const text = await completeText(
        `For startup ${company.name} in ${company.sector} at ${company.stage} stage, list 4 comparable companies/exits as JSON array only, no markdown:
[{"name":"...", "outcome":"...", "multiple":"...", "relevance":"...", "note":"..."}]
outcome = Acquired/IPO/Active, multiple = exit multiple or current valuation, relevance = % similarity, note = 1 sentence why comparable.`,
        { maxTokens: 2000 },
      )
      setComps(parseJsonArray(text || '[]'))
    } catch {
      setComps([])
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12 }}>
        <div style={{ width: 24, height: 24, border: '2px solid #1a1a1a', borderTop: '2px solid #f5a623', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#444' }}>SCANNING COMPARABLE EXITS...</span>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#444', letterSpacing: '0.1em', marginBottom: 16 }}>COMPARABLE COMPANIES & EXITS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(comps || []).map((c, i) => (
          <div key={i} style={{ background: '#0c0c0c', border: '1px solid #1a1a1a', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#e8e8e8', fontWeight: 700 }}>{c.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#f5a623' }}>{c.multiple}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: c.outcome === 'Acquired' ? '#00ff88' : c.outcome === 'IPO' ? '#00cfff' : '#888', background: '#ffffff08', padding: '1px 6px' }}>{c.outcome}</span>
              </div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#555' }}>{c.note}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#333' }}>RELEVANCE</span>
              <div style={{ flex: 1, height: 2, background: '#111' }}>
                <div style={{ height: '100%', width: c.relevance, background: '#00ff8855' }} />
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#00ff88' }}>{c.relevance}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Source Companies Modal ───────────────────────────────────────────────────
function SourceModal({ onClose, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setResults(null)
    try {
      const text = await completeText(
        `You are a VC sourcing analyst. Generate 3 plausible fictional early-stage startups matching: "${query}".
Return ONLY a JSON array, no markdown:
[{"name":"...","sector":"...","stage":"Seed","raised":"$XM","founded":202X,"hq":"City, ST","founders":"...","signal":XX,"traction":"...","status":"new"}]
signal should be 60-95, traction should be a specific metric.`,
        { maxTokens: 2000 },
      )
      setResults(parseJsonArray(text || '[]'))
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0a0a0a', border: '1px solid #1a2a1a', width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#00ff88', letterSpacing: '0.1em' }}>⚡ SOURCE NEW DEALS</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontFamily: 'monospace' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="e.g. 'AI-native healthcare diagnostics' or 'climate fintech'"
              style={{ flex: 1, background: '#0c0c0c', border: '1px solid #222', color: '#e8e8e8', fontFamily: 'monospace', fontSize: 12, padding: '10px 14px', outline: 'none' }} />
            <button type="button" onClick={search} style={{ background: '#00ff8822', border: '1px solid #00ff8866', color: '#00ff88', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, padding: '0 20px', cursor: 'pointer', letterSpacing: '0.1em' }}>
              SCAN
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}>
              <div style={{ width: 20, height: 20, border: '2px solid #1a1a1a', borderTop: '2px solid #00ff88', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#444' }}>SCANNING DEAL FLOW...</span>
            </div>
          )}
          {results && results.map((co, i) => (
            <div key={i} style={{ background: '#0c0c0c', border: '1px solid #1a1a1a', padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <ScoreRing score={co.signal} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#e8e8e8' }}>{co.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#444', marginTop: 2 }}>{co.sector} · {co.stage} · {co.hq}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#00ff88', marginTop: 4 }}>↑ {co.traction}</div>
              </div>
              <button type="button" onClick={() => { onAdd({ ...co, id: Date.now() + i }) }}
                style={{ background: '#00ff8822', border: '1px solid #00ff8866', color: '#00ff88', fontFamily: 'monospace', fontSize: 9, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', letterSpacing: '0.1em' }}>
                + ADD
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Metrics Bar ──────────────────────────────────────────────────────────────
function MetricsBar({ companies }) {
  const avg = companies.length ? Math.round(companies.reduce((a, c) => a + c.signal, 0) / companies.length) : 0
  const metrics = [
    { label: 'TOTAL SIGNALS', value: companies.length, color: '#e8e8e8' },
    { label: 'NEW TODAY', value: companies.filter((c) => c.status === 'new').length, color: '#00ff88' },
    { label: 'IN REVIEW', value: companies.filter((c) => c.status === 'reviewing').length, color: '#f5a623' },
    { label: 'AVG SIGNAL', value: avg, color: '#00cfff' },
    { label: 'TOP SECTOR', value: 'AI/ML', color: '#b39ddb' },
    { label: 'PASSED', value: companies.filter((c) => c.status === 'passed').length, color: '#ff4444' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: '1px solid #1a1a1a' }}>
      {metrics.map((m, i) => (
        <div key={m.label} style={{ padding: '14px 16px', borderRight: i < 5 ? '1px solid #111' : 'none' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#444', letterSpacing: '0.12em', marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [companies, setCompanies] = useState(SEED_COMPANIES)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState({ sector: 'All', stage: 'All', sort: 'signal' })
  const [showSource, setShowSource] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const filtered = companies
    .filter((c) => filter.sector === 'All' || c.sector.includes(filter.sector))
    .filter((c) => filter.stage === 'All' || c.stage === filter.stage)
    .sort((a, b) => (filter.sort === 'signal' ? b.signal - a.signal : a.name.localeCompare(b.name)))

  return (
    <div style={{ background: '#080808', minHeight: '100vh', color: '#e8e8e8', fontFamily: 'monospace' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        body { background: #080808; }
      `}</style>

      <div style={{ height: 50, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#060606' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, background: '#00ff88', borderRadius: '50%', animation: 'pulse 2s infinite', boxShadow: '0 0 8px #00ff88' }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: '#e8e8e8', letterSpacing: '0.15em' }}>SIGNAL</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#00ff88', letterSpacing: '0.15em' }}>VC</span>
          </div>
          <div style={{ width: 1, height: 20, background: '#1a1a1a' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#333', letterSpacing: '0.1em' }}>AI-POWERED DEAL INTELLIGENCE PLATFORM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#333' }}>{time.toLocaleTimeString()} EST</span>
          <button type="button" onClick={() => setShowSource(true)}
            style={{ background: '#00ff8815', border: '1px solid #00ff8840', color: '#00ff88', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.1em' }}>
            + SOURCE DEALS
          </button>
        </div>
      </div>

      <Ticker />

      <MetricsBar companies={companies} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #111', background: '#060606' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#333', letterSpacing: '0.1em' }}>FILTER:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', 'Seed', 'Series A'].map((s) => (
            <button key={s} type="button" onClick={() => setFilter((f) => ({ ...f, stage: s }))}
              style={{ background: filter.stage === s ? '#00ff8818' : 'none', border: `1px solid ${filter.stage === s ? '#00ff8844' : '#1a1a1a'}`, color: filter.stage === s ? '#00ff88' : '#444', fontFamily: 'monospace', fontSize: 9, padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.08em' }}>{s}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 16, background: '#1a1a1a' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['signal', 'name'].map((s) => (
            <button key={s} type="button" onClick={() => setFilter((f) => ({ ...f, sort: s }))}
              style={{ background: filter.sort === s ? '#f5a62318' : 'none', border: `1px solid ${filter.sort === s ? '#f5a62344' : '#1a1a1a'}`, color: filter.sort === s ? '#f5a623' : '#444', fontFamily: 'monospace', fontSize: 9, padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.08em' }}>SORT: {s.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '380px 1fr' : '1fr', height: 'calc(100vh - 160px)' }}>
        <div style={{ overflow: 'auto', borderRight: '1px solid #111' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#333', fontFamily: 'monospace', fontSize: 11 }}>NO SIGNALS MATCH FILTER</div>
          )}
          {filtered.map((co) => (
            <div key={co.id} style={{ borderBottom: '1px solid #0f0f0f', animation: 'fadeIn 0.3s ease' }}>
              <CompanyCard company={co} onClick={(c) => setSelected(selected?.id === c.id ? null : c)} selected={selected?.id === co.id} />
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ overflow: 'hidden', animation: 'fadeIn 0.25s ease' }}>
            <MemoPanel company={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {showSource && (
        <SourceModal
          onClose={() => setShowSource(false)}
          onAdd={(co) => { setCompanies((prev) => [co, ...prev]); setShowSource(false) }}
        />
      )}
    </div>
  )
}
