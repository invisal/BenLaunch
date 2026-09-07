/**
 * Enumerates installed web browsers so the Create Quicklink form can offer an
 * "Open With" choice. Reads the canonical Windows registry location
 * (`Clients\StartMenuInternet`) that every browser registers itself under; each
 * entry's `shell\open\command` gives the executable to hand a URL to.
 *
 * Windows-only — other platforms return an empty list (the form then just shows
 * "Default browser").
 */
import { execFile } from 'node:child_process'
import type { OpenWithApp } from '../../shared/quicklink.ts'

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$roots = 'HKLM:\\SOFTWARE\\Clients\\StartMenuInternet','HKCU:\\SOFTWARE\\Clients\\StartMenuInternet'
$seen = @{}
$list = foreach ($root in $roots) {
  if (Test-Path $root) {
    foreach ($key in Get-ChildItem $root) {
      $name = (Get-ItemProperty $key.PSPath).'(default)'
      $cmd  = (Get-ItemProperty "$($key.PSPath)\\shell\\open\\command").'(default)'
      if ($name -and $cmd) {
        $exe = $cmd.Trim('"')
        if (-not $seen.ContainsKey($exe.ToLower())) {
          $seen[$exe.ToLower()] = $true
          [pscustomobject]@{ name = [string]$name; path = $exe }
        }
      }
    }
  }
}
$list | ConvertTo-Json -Compress
`

let cache: Promise<OpenWithApp[]> | null = null

/** Installed browsers, `{ name, path }`, best-effort. Result is cached for the session. */
export function listBrowsers(): Promise<OpenWithApp[]> {
  if (process.platform !== 'win32') return Promise.resolve([])
  if (cache) return cache

  cache = new Promise<OpenWithApp[]>((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
      { windowsHide: true, timeout: 8000 },
      (error, stdout) => {
        if (error) {
          console.error('[browsers] Failed to enumerate:', error)
          resolve([])
          return
        }
        try {
          const parsed: unknown = JSON.parse(stdout.trim() || 'null')
          const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
          const apps = rows
            .filter(
              (row): row is OpenWithApp =>
                !!row &&
                typeof row === 'object' &&
                typeof (row as OpenWithApp).name === 'string' &&
                typeof (row as OpenWithApp).path === 'string'
            )
            .map((row) => ({ name: row.name, path: row.path }))
            .sort((a, b) => a.name.localeCompare(b.name))
          resolve(apps)
        } catch (parseError) {
          console.error('[browsers] Failed to parse output:', parseError)
          resolve([])
        }
      }
    )
  })
  return cache
}
