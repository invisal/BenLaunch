import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // `@benpocket/win` is an optionalDependency (win32-only), so
    // externalizeDepsPlugin's default `pkg.dependencies` scan misses it — list it
    // explicitly so it stays a runtime `import`/`require` instead of something
    // Rollup tries (and fails) to resolve into the bundle on other platforms.
    // `@benpocket/win` and `electron-liquid-glass` are optionalDependencies with a
    // native addon, so externalizeDepsPlugin's default `pkg.dependencies` scan
    // misses them — list them explicitly so they stay a runtime `import` instead
    // of something Rollup tries (and fails) to bundle.
    plugins: [
      externalizeDepsPlugin({ include: ['@benpocket/win', 'electron-liquid-glass'] })
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Runs out-of-process (via ELECTRON_RUN_AS_NODE) so that resolving installed
          // apps and their icons — synchronous native calls — never blocks Electron's
          // main/browser process. See src/main/native/apps.ts.
          // Output name stays `apps-worker.js` (the input key); apps.ts resolves it
          // as `join(__dirname, 'apps-worker.js')` at runtime.
          'apps-worker': resolve(__dirname, 'src/main/native/apps-worker.ts'),
          // Runs a QuickValue's user function out-of-process (same reason as above);
          // src/main/sources/quickvalue/runner.ts spawns it as `quickvalue-worker.js`
          // (the input key below sets the output name).
          'quickvalue-worker': resolve(__dirname, 'src/main/sources/quickvalue/worker.ts')
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
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html'),
          quickvalue: resolve(__dirname, 'src/renderer/quickvalue.html'),
          'custom-layout': resolve(__dirname, 'src/renderer/custom-layout.html')
        }
      }
    },
    plugins: [react()]
  }
})
