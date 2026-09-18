import { useEffect, useRef } from 'react'
import { matchesShortcut } from './shortcut'

type ShortcutHandler = (event: KeyboardEvent) => void

/** Map of Electron accelerator string -> handler. A falsy value disables that
 *  binding, so `busy ? undefined : save` reads naturally. */
export type ShortcutMap = Record<string, ShortcutHandler | false | null | undefined>

/**
 * Bind global keyboard shortcuts for as long as the caller is mounted. Keys are
 * Electron accelerator strings — "CommandOrControl+S", "Escape", "Shift+Alt+F".
 *
 * The listener is on the bubble phase and bails when something else already
 * handled the event (`defaultPrevented`), so a focused input or CodeMirror
 * keeps first claim on the key. On a match, `preventDefault()` runs before the
 * handler.
 *
 *   useShortcut({
 *     Escape: onClose,
 *     "CommandOrControl+S": () => format(),
 *     "CommandOrControl+Enter": busy ? undefined : () => save(),
 *   })
 *
 * The map may be a fresh object each render; handlers are always read live.
 *
 * `{ capture: true }` listens before the focused element does and, on a
 * match, stops the event there — for chords a focused widget would otherwise
 * swallow first (a Base UI combobox input consumes every Enter, modifiers or
 * not, to click its highlighted row).
 */
export function useShortcut(
  map: ShortcutMap,
  { capture = false }: { capture?: boolean } = {}
): void {
  const mapRef = useRef(map)
  mapRef.current = map

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!capture && event.defaultPrevented) return
      for (const [accelerator, handler] of Object.entries(mapRef.current)) {
        if (!handler || !matchesShortcut(accelerator, event)) continue
        event.preventDefault()
        if (capture) event.stopPropagation()
        handler(event)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown, capture)
    return () => window.removeEventListener('keydown', onKeyDown, capture)
  }, [capture])
}
