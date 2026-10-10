import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const MODES = { dev: 'dev', development: 'dev', prod: 'prod', production: 'prod' }

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Read client/.env next to this file, so the result is the same wherever the build is started from.
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')
  // VITE_MODE picks which API the bundle talks to; without it a production build means prod.
  const apiMode = MODES[String(env.VITE_MODE || '').trim().toLowerCase()] || (command === 'build' ? 'prod' : 'dev')
  const apiUrl = (apiMode === 'prod' ? env.VITE_PROD_API_URL : env.VITE_DEV_API_URL)
    // The old single variable is a fallback only where no mode-specific URL exists, so a stale dev value cannot become a prod build's API.
    || (apiMode === 'prod' && env.VITE_DEV_API_URL ? '' : env.VITE_API_URL)
    || (apiMode === 'prod' ? '/api' : 'http://localhost:5000/api')

  if (command === 'build') {
    const warn = (message) => console.warn(`\n[env] ${message}\n`)
    if (apiMode === 'dev') warn(`VITE_MODE=dev: this build will call the development API (${apiUrl}). Set VITE_MODE=prod in client/.env before a production deploy.`)
    else if (/\/\/(localhost|127\.0\.0\.1)[:/]/.test(apiUrl)) warn(`This production build will call ${apiUrl}. Set VITE_PROD_API_URL.`)
    else if (!env.VITE_PROD_API_URL) warn('VITE_PROD_API_URL is not set, so this build calls /api on its own origin. Set it if the API is on another host.')
  }

  return {
    envDir: import.meta.dirname,
    plugins: [react()],
    // Resolved here so only the chosen URL is compiled into the bundle.
    define: { 'import.meta.env.VITE_RESOLVED_API_URL': JSON.stringify(apiUrl) },
  }
})
