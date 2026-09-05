import { formatShortcut } from '@renderer/lib/shortcut'
import { WindowFrame } from '@renderer/shared/ui'

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

function Settings() {
  return (
    <WindowFrame title="Settings" contentClassName="overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
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

        <p className="mt-8 text-xs text-foreground-subtle">
          More options coming soon.
        </p>
      </div>
    </WindowFrame>
  )
}

export default Settings
