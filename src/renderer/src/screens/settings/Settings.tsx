import { useEffect, useState } from 'react'
import type { WindowShortcutInfo } from '../../../../shared/types'
import { formatShortcut } from '../../lib/shortcut'

const TOGGLE_SHORTCUT =
  window.api.platform === 'darwin' ? 'Command+Shift+Space' : 'Alt+Space'

function Row({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-4">
      <div className="min-w-0">
        <div className="text-foreground">{title}</div>
        <div className="text-xs text-foreground-subtle">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function AccessibilityRow() {
  const [trusted, setTrusted] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.getAccessibilityStatus().then(setTrusted)
  }, [])

  async function grant(): Promise<void> {
    const result = await window.api.requestAccessibility()
    setTrusted(result)
  }

  return (
    <Row
      title="Accessibility access"
      description="Required so Window Management can move and resize other apps' windows."
    >
      {trusted === null ? (
        <span className="text-xs text-foreground-subtle">Checking…</span>
      ) : trusted ? (
        <span className="text-xs text-foreground-subtle">Granted</span>
      ) : (
        <button
          onClick={() => void grant()}
          className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-item-hover"
        >
          Grant Access
        </button>
      )}
    </Row>
  )
}

function GapSizeRow() {
  const [gapPx, setGapPx] = useState<number | null>(null)

  useEffect(() => {
    window.api.getGapSize().then(setGapPx)
  }, [])

  async function save(value: number): Promise<void> {
    setGapPx(value)
    await window.api.setGapSize(value)
  }

  return (
    <Row
      title="Window gap"
      description='Spacing a custom layout inserts when its "Use preferred gap settings" is on.'
    >
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          value={gapPx ?? ''}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) void save(Math.max(0, n))
          }}
          className="w-16 rounded border border-border bg-transparent px-2 py-1 text-right text-xs outline-none"
        />
        <span className="text-xs text-foreground-subtle">px</span>
      </div>
    </Row>
  )
}

function Settings() {
  const [windowShortcuts, setWindowShortcuts] = useState<WindowShortcutInfo[]>([])

  useEffect(() => {
    window.api.getWindowShortcuts().then(setWindowShortcuts)
  }, [])

  return (
    <div className="h-screen w-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-foreground-subtle">
          Configure how BenLaunch behaves.
        </p>

        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            General
          </h2>
          <Row
            title="Toggle shortcut"
            description="Global hotkey that shows and hides the launcher."
          >
            <kbd className="rounded border border-border px-2 py-1 font-sans text-xs text-foreground-subtle">
              {formatShortcut(TOGGLE_SHORTCUT)}
            </kbd>
          </Row>
          <Row
            title="Launch at login"
            description="Start BenLaunch automatically when you sign in."
          >
            <input type="checkbox" disabled />
          </Row>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            Window Management
          </h2>
          {window.api.platform === 'darwin' && <AccessibilityRow />}
          <GapSizeRow />
          {windowShortcuts.map((command) => (
            <Row key={command.id} title={command.title} description="Window Management">
              {command.shortcut ? (
                <kbd className="rounded border border-border px-2 py-1 font-sans text-xs text-foreground-subtle">
                  {formatShortcut(command.shortcut)}
                </kbd>
              ) : (
                <span className="text-xs text-foreground-subtle">Disabled</span>
              )}
            </Row>
          ))}
        </section>

        <p className="mt-8 text-xs text-foreground-subtle">
          More options coming soon.
        </p>
      </div>
    </div>
  )
}

export default Settings
