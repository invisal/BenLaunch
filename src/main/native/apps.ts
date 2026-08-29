import { app } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { AppsWorkerResult } from './apps-worker'

/**
 * Native capability: enumerate installed Windows applications and their icons.
 *
 * The actual resolution happens in apps-worker.ts, spawned as a separate
 * `ELECTRON_RUN_AS_NODE` process — see that file for why. This module just spawns
 * it and parses its output. It deals only in the serializable `AppsWorkerResult`;
 * persisting it and turning it into launcher actions (with their main-process
 * `run` handlers) is the caller's job — see src/main/sources/apps.
 */
function runAppsWorker(): Promise<AppsWorkerResult> {
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

/**
 * Resolves the current set of installed applications, off the browser process.
 * Returns `null` on an unsupported platform or a worker failure, leaving callers
 * to keep their last known-good list.
 */
export async function listApplications(): Promise<AppsWorkerResult | null> {
  if (process.platform !== 'win32') return null

  try {
    return await runAppsWorker()
  } catch (error) {
    console.error('[native] Failed to resolve installed applications:', error)
    return null
  }
}

export type { AppsWorkerResult, ShortcutAppResult, PackagedAppResult } from './apps-worker'
