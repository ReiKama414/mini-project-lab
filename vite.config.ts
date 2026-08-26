import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

/** Strip CSP on Vite responses — old caches / proxies must not block HMR preamble. */
function stripCsp(): Plugin {
  return {
    name: 'strip-csp-in-dev',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        const original = res.setHeader.bind(res)
        res.setHeader = ((name: string, value: number | string | readonly string[]) => {
          if (String(name).toLowerCase() === 'content-security-policy') return res
          return original(name, value)
        }) as typeof res.setHeader
        next()
      })
    },
  }
}

/** Safe headers for `vite preview` only (no CSP — would break if any inline remains). */
const previewHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export default defineConfig({
  plugins: [react(), stripCsp()],
  server: {
    // Do not set Content-Security-Policy here — Vite needs inline scripts for React Refresh.
    headers: {
      'X-Content-Type-Options': 'nosniff',
    },
  },
  preview: {
    headers: previewHeaders,
  },
})
