import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolveBuildEnv, SITE_VARS } from './config/buildEnv.js'
import { deployFiles, siteHtml } from './config/deployFiles.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Tests always see the dev defaults and the bracketed identity placeholders, whatever client/.env says.
  const testing = Boolean(process.env.VITEST)
  // Read client/.env (and VITE_* from the process env, e.g. the host's build settings) next to this
  // file, so the result is the same wherever the build is started from.
  const env = testing ? {} : loadEnv(mode, import.meta.dirname, 'VITE_')
  // VITE_MODE is the one switch. Every input it selects is validated here: an unknown mode, a bad API
  // URL or (in a prod build) missing identity throws, so a broken prod bundle is never produced.
  const build = resolveBuildEnv(env, command)

  if (!testing) {
    const how = build.explicit ? `VITE_MODE=${build.mode}` : `VITE_MODE unset, so ${command === 'build' ? 'a build' : 'the dev server'} defaults to ${build.mode}`
    console.info(`\n[env] ${how}; API ${build.apiUrl}${build.site.domain ? `; site https://${build.site.domain}` : ''}\n`)
    if (command === 'build' && build.mode === 'dev') console.warn(`[env] This build calls the development API. Set VITE_MODE=prod for a production deploy.\n`)
  }

  const define = {
    // Resolved here so only the chosen values are compiled into the bundle.
    'import.meta.env.VITE_RESOLVED_API_URL': JSON.stringify(build.apiUrl),
    'import.meta.env.VITE_RESOLVED_MODE': JSON.stringify(build.mode),
  }
  // src/content/site.js reads these; '' means "not set" and shows the dev placeholder.
  for (const [key, name] of Object.entries(SITE_VARS)) define[`import.meta.env.${name}`] = JSON.stringify(build.site[key] || '')

  return {
    envDir: import.meta.dirname,
    plugins: [
      react(),
      siteHtml({ site: build.site }),
      deployFiles({ apiOrigin: build.apiOrigin, site: build.site, publicDir: path.join(import.meta.dirname, 'public') }),
    ],
    define,
    // The public docs render consumer docs from ../docs, which sit above this package. Vite inlines
    // them at build time; the dev server needs permission to read them.
    server: { fs: { allow: ['..'] } },
    // `npm test`: component tests in jsdom. e2e/ is Playwright's and runs against a live stack instead.
    test: { environment: 'jsdom', include: ['src/**/*.test.{js,jsx}', 'config/**/*.test.js', 'scripts/**/*.test.js'] },
  }
})
