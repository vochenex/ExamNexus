import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Stamps the built service worker with a unique build ID so its bytes change
// on every build. Without this, /sw.js is byte-identical between deploys and
// the browser never detects a new version — so installed PWAs would never be
// told to update.
function serviceWorkerBuildStamp() {
  return {
    name: 'sw-build-stamp',
    apply: 'build',
    writeBundle() {
      const swPath = path.resolve(__dirname, 'dist', 'sw.js')
      if (!fs.existsSync(swPath)) return
      const buildId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`
      const stamped = fs
        .readFileSync(swPath, 'utf8')
        .replace(/__BUILD_ID__/g, buildId)
      fs.writeFileSync(swPath, stamped)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorkerBuildStamp()],
  server: {
    open: '/',
  },
  preview: {
    open: '/',
  },
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (
            id.includes('react-dom')
            || id.includes('react-router')
            || id.includes('/react/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('@fontsource')) return 'vendor-fonts'
          if (id.includes('react-day-picker')) return 'vendor-calendar'

          return undefined
        },
      },
    },
  },
})
