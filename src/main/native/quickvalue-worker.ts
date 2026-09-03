/**
 * Runs one QuickValue's user function out-of-process, spawned by
 * `quickvalue/runner.ts` via `ELECTRON_RUN_AS_NODE` — never inside Electron's
 * browser process, so a slow `fetch(...)` or a runaway loop can't freeze window
 * paint / IPC. Mirrors `apps-worker.ts`: read input, write one JSON blob to
 * stdout, exit.
 *
 *   stdin  : { "code": string, "timeoutMs"?: number }
 *   stdout : { "ok": true, "value": string|number|null } | { "ok": false, "error": string }
 */
import { runUserCode, type UserCodeResult } from '../quickvalue/run-user-code'

async function readStdin(): Promise<string> {
  process.stdin.setEncoding('utf8')
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  return input
}

function emit(result: UserCodeResult): void {
  process.stdout.write(JSON.stringify(result))
}

async function main(): Promise<void> {
  const raw = await readStdin()

  let code = ''
  let timeoutMs: number | undefined
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; timeoutMs?: unknown }
    if (typeof parsed.code === 'string') code = parsed.code
    if (typeof parsed.timeoutMs === 'number') timeoutMs = parsed.timeoutMs
  } catch {
    emit({ ok: false, error: 'QuickValue worker received invalid input' })
    return
  }

  emit(await runUserCode(code, timeoutMs))
}

main().catch((error) => {
  emit({ ok: false, error: error instanceof Error ? error.message : String(error) })
  process.exitCode = 1
})
