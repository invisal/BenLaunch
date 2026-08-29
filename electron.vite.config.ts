import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Runs out-of-process (via ELECTRON_RUN_AS_NODE) so that resolving installed
          // apps and their icons — synchronous native calls — never blocks Electron's
          // main/browser process. See src/main/sources/apps/apps.ts.
          // Output name stays `apps-worker.js` (the input key); apps.ts resolves it
          // as `join(__dirname, 'apps-worker.js')` at runtime.
          'apps-worker': resolve(__dirname, 'src/main/sources/apps/worker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
