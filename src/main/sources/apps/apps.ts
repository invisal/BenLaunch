import { app, shell } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { ActionDefinition } from '../../types'
import { writeAppsCache } from './cache'
import type { AppsWorkerResult } from './worker'

/**
 * Resolving installed apps and their icons happens in worker.ts, spawned as a
 * separate `ELECTRON_RUN_AS_NODE` process — see that file for why. This module just
 * spawns it, parses its output, and attaches the (necessarily main-process) `run`
 * handlers Electron's `shell`/`execFile` APIs require.
 */
async function runAppsWorker(): Promise<AppsWorkerResult> {
  const workerPath = join(__dirname, 'apps-worker.js')
  const iconCacheDir = join(app.getPath('userData'), 'icon-cache')

  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [workerPath],
      {
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          BENPOCKET_ICON_CACHE_DIR: iconCacheDir
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message))
          return
        }
        try {
          resolve(JSON.parse(stdout) as AppsWorkerResult)
        } catch (parseError) {
          reject(parseError)
        }
      }
    )
  })
}

export async function getInstalledApplications(): Promise<ActionDefinition[]> {
  if (process.platform !== 'win32') return []

  let result: AppsWorkerResult
  try {
    result = await runAppsWorker()
  } catch (error) {
    console.error('[main] Failed to resolve installed applications:', error)
    return []
  }

  // Persist the raw worker result so the next launch can serve it instantly while
  // a fresh run happens in the background (see actions.ts).
  writeAppsCache(result)

  return mapWorkerResult(result)
}

/**
 * Turns a serializable `AppsWorkerResult` into `ActionDefinition`s, rebuilding the
 * main-process `run` handlers that can't be persisted. Shared by the live worker
 * path and the on-disk cache path.
 */
export function mapWorkerResult(result: AppsWorkerResult): ActionDefinition[] {
  const classicDefinitions: ActionDefinition[] = result.shortcuts.map((entry) => ({
    action: {
      id: `app:${entry.path.toLowerCase()}`,
      title: entry.title,
      subtitle: 'Application',
      icon: entry.icon,
      type: 'application'
    },
    run: async () => {
      const openError = await shell.openPath(entry.path)
      if (openError) console.error(`[main] Failed to open ${entry.path}: ${openError}`)
    }
  }))

  const packagedDefinitions: ActionDefinition[] = result.packaged.map((entry) => ({
    action: {
      id: `pkg:${entry.appId.toLowerCase()}`,
      title: entry.title,
      subtitle: 'Application',
      icon: entry.icon,
      type: 'application'
    },
    run: () => {
      execFile('explorer.exe', [`shell:AppsFolder\\${entry.appId}`], (error) => {
        if (error) console.error(`[main] Failed to open ${entry.title}:`, error)
      })
    }
  }))

  const definitions = [...classicDefinitions, ...packagedDefinitions]
  return definitions.sort((a, b) => a.action.title.localeCompare(b.action.title))
}
