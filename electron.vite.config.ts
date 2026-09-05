import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * Serves `typescript/lib/typescript.js` (used by the QuickValue code editor's
 * language-service integration — see CodeEditor.tsx) as its own same-origin
 * script asset, with its trailing `//# sourceMappingURL=typescript.js.map`
 * comment stripped — that .map file doesn't actually ship in the `typescript`
 * npm package, and leaving the comment in makes Vite's dev server try (and
 * fail) to read it straight off disk, throwing an ENOENT.
 *
 * A plain `?url`/`?raw` import can't fix this on its own since it serves the
 * file byte-for-byte; this plugin re-serves a cleaned copy instead, as a
 * `virtual:typescript-runtime-url` module resolving to that copy's URL.
 */
function typescriptRuntimeAsset(): Plugin {
  const VIRTUAL_ID = 'virtual:typescript-runtime-url'
  const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID
  const SOURCE_PATH = resolve(__dirname, 'node_modules/typescript/lib/typescript.js')
  const DEV_PATH = '/__typescript-runtime.js'
  let command: 'build' | 'serve' = 'serve'

  function cleanedSource(): string {
    return readFileSync(SOURCE_PATH, 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '')
  }

  return {
    name: 'typescript-runtime-asset',
    configResolved(config) {
      command = config.command
    },
    configureServer(server) {
      server.middlewares.use(DEV_PATH, (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript')
        res.end(cleanedSource())
      })
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
      return undefined
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return undefined
      if (command === 'serve') {
        return `export default ${JSON.stringify(DEV_PATH)}`
      }
      const refId = this.emitFile({ type: 'asset', name: 'typescript.js', source: cleanedSource() })
      return `export default import.meta.ROLLUP_FILE_URL_${refId}`
    }
  }
}

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
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html'),
          quickvalue: resolve(__dirname, 'src/renderer/quickvalue.html')
        }
      }
    },
    plugins: [react(), typescriptRuntimeAsset()]
  }
})
