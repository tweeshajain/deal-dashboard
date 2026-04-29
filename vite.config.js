import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Pick LLM from .env without requiring VITE_ on secret keys. */
function resolveAiProvider(e) {
  const explicit = (e.AI_PROVIDER || e.VITE_AI_PROVIDER || '').trim().toLowerCase()
  if (['anthropic', 'openai', 'gemini'].includes(explicit)) return explicit
  if (e.ANTHROPIC_API_KEY?.trim()) return 'anthropic'
  if (e.OPENAI_API_KEY?.trim()) return 'openai'
  if (e.GEMINI_API_KEY?.trim()) return 'gemini'
  return 'anthropic'
}

function createAiProxies(env) {
  return {
    '/anthropic-proxy': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/anthropic-proxy/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY || '')
          proxyReq.setHeader('anthropic-version', '2023-06-01')
        })
      },
    },
    '/openai-proxy': {
      target: 'https://api.openai.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/openai-proxy/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${env.OPENAI_API_KEY || ''}`)
        })
      },
    },
    '/gemini-proxy': {
      target: 'https://generativelanguage.googleapis.com',
      changeOrigin: true,
      rewrite: (path) => `/v1beta${path.replace(/^\/gemini-proxy/, '')}`,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('x-goog-api-key', env.GEMINI_API_KEY || '')
        })
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const aiProvider = resolveAiProvider(env)
  const proxy = createAiProxies(env)

  return {
    define: {
      __APP_AI_PROVIDER__: JSON.stringify(aiProvider),
    },
    plugins: [react()],
    /** host: true avoids Windows localhost (::1) vs 127.0.0.1 mismatch; keeps dev reachable at localhost:5173 */
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      proxy,
    },
    /** Same proxies as dev — required for `npm run preview` to reach LLM APIs. */
    preview: { proxy },
  }
})
