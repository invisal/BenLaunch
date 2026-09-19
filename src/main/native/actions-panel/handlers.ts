import { ipcMain, type BrowserWindow } from 'electron'
import { loadNativeMac } from './native-mac'
import {
  ACTIONS_PANEL_CHANNELS,
  type ActionsFormEvent,
  type ActionsFormSpec,
  type ActionsPanelItem
} from './types'

/** The launcher-window state the panel needs, owned by `main/index.ts`. */
export interface ActionsPanelIpcHost {
  getLauncherWindow: () => BrowserWindow | null
  /** The panel takes key focus, which would otherwise blur-hide the launcher. */
  setSuppressAutoHide: (value: boolean) => void
}

/** Hands focus back to the launcher, but only if it's still on screen — a hidden one must stay hidden. */
function refocus(win: BrowserWindow): void {
  if (!win.isDestroyed() && win.isVisible()) win.focus()
}

const watched = new WeakSet<BrowserWindow>()

/**
 * A panel is a child of the launcher, so it has to go when the launcher does:
 * left open, it would reappear (and keep the launcher from auto-hiding) the
 * next time the launcher is shown.
 */
function closePanelsWhenHidden(win: BrowserWindow, host: ActionsPanelIpcHost): void {
  if (watched.has(win)) return
  watched.add(win)
  win.on('hide', () => {
    const native = loadNativeMac()
    native?.closeActionsPanel()
    host.setSuppressAutoHide(false)
  })
}

/**
 * `show` resolves with the picked row's id, or `null` if the panel was
 * dismissed (Esc, focus loss, `close`). The native panel reports exactly once.
 */
export function registerActionsPanelIpc(host: ActionsPanelIpcHost): void {
  ipcMain.handle(ACTIONS_PANEL_CHANNELS.supported, () => {
    return typeof loadNativeMac()?.showActionsPanel === 'function'
  })

  ipcMain.handle(
    ACTIONS_PANEL_CHANNELS.show,
    (_event, title: string, items: ActionsPanelItem[]) => {
      const native = loadNativeMac()
      const win = host.getLauncherWindow()
      if (!native || !win || !win.isVisible()) return Promise.resolve(null)
      closePanelsWhenHidden(win, host)

      return new Promise<string | null>((resolve) => {
        host.setSuppressAutoHide(true)
        try {
          native.showActionsPanel(win.getNativeWindowHandle(), title, items, (event) => {
            host.setSuppressAutoHide(false)
            refocus(win)
            resolve(event.kind === 'select' ? (event.id ?? null) : null)
          })
        } catch (error) {
          host.setSuppressAutoHide(false)
          console.error('[actions-panel] show failed:', error)
          resolve(null)
        }
      })
    }
  )

  ipcMain.handle(ACTIONS_PANEL_CHANNELS.close, () => {
    loadNativeMac()?.closeActionsPanel()
  })

  registerFormIpc(host)
}

/**
 * A form outlives its first event (see `native/mac/src/actions_form.rs`): the
 * user can save, be told it failed, and save again. So instead of one promise
 * per open, native events are queued here and pulled one at a time with
 * `formNext`. The renderer answers a `submit` with `formClose` (saved) or
 * `formFail` (show a message and keep the form up).
 */
function registerFormIpc(host: ActionsPanelIpcHost): void {
  let queue: ActionsFormEvent[] = []
  let waiter: ((event: ActionsFormEvent) => void) | null = null

  const push = (event: ActionsFormEvent): void => {
    if (waiter) {
      const resolve = waiter
      waiter = null
      resolve(event)
    } else {
      queue.push(event)
    }
  }

  ipcMain.handle(ACTIONS_PANEL_CHANNELS.formOpen, (_event, spec: ActionsFormSpec) => {
    const native = loadNativeMac()
    const win = host.getLauncherWindow()
    if (!native || !win || !win.isVisible()) return false
    closePanelsWhenHidden(win, host)

    // A previous session's leftovers, and anyone still waiting on it.
    queue = []
    push({ kind: 'cancel' })
    queue = []

    host.setSuppressAutoHide(true)
    try {
      native.showActionsForm(win.getNativeWindowHandle(), spec, (event) => {
        if (event.kind === 'cancel') {
          host.setSuppressAutoHide(false)
          refocus(win)
        }
        push({
          kind: event.kind === 'submit' ? 'submit' : 'cancel',
          value: event.value ?? undefined
        })
      })
      return true
    } catch (error) {
      host.setSuppressAutoHide(false)
      console.error('[actions-panel] form failed:', error)
      return false
    }
  })

  ipcMain.handle(ACTIONS_PANEL_CHANNELS.formNext, () => {
    return new Promise<ActionsFormEvent>((resolve) => {
      const queued = queue.shift()
      if (queued) resolve(queued)
      else waiter = resolve
    })
  })

  ipcMain.handle(ACTIONS_PANEL_CHANNELS.formFail, (_event, message: string) => {
    loadNativeMac()?.failActionsForm(message)
  })

  ipcMain.handle(ACTIONS_PANEL_CHANNELS.formClose, () => {
    loadNativeMac()?.closeActionsForm()
    host.setSuppressAutoHide(false)
    const win = host.getLauncherWindow()
    if (win) refocus(win)
  })
}
