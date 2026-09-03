/**
 * Default global accelerators for every Window Management command, keyed by
 * action id (`win:left-half`, …). One consistent modifier scheme per OS —
 * `Control+Alt` on Windows/Linux, `Control+Option` on macOS (the Electron
 * accelerator name for the same physical key) — deliberately avoids `Super`/
 * `Meta` entirely, since Windows already reserves `Win+Arrow` for its own Snap.
 * `⌃⌥←` for Left Half matches the example Raycast itself gives on
 * https://www.raycast.com/core-features/window-management.
 *
 * The halves get the bare arrows; "Move" (nudge, no resize) is Shift+arrow, so
 * it reads as a variant of the same direction rather than a competing scheme.
 * Quarters use a spatial-grid mnemonic (U/I/J/K, like Rectangle and similar
 * tools) since arrows alone can't express "which corner." Thirds use D/F/G,
 * two-thirds add Shift. Maximize's width/height variants are literally W/H,
 * and Toggle Fullscreen is Shift+F ("fullscreen", shifted since F is already
 * Center Third). 27 commands, no collisions.
 */
const MODIFIER = process.platform === 'darwin' ? 'Control+Option' : 'Control+Alt'

function key(suffix: string): string {
  return `${MODIFIER}+${suffix}`
}

export const DEFAULT_WINDOW_SHORTCUTS: Record<string, string> = {
  'win:left-half': key('Left'),
  'win:right-half': key('Right'),
  'win:top-half': key('Up'),
  'win:bottom-half': key('Down'),
  'win:center-half': key('Shift+C'),
  'win:move-left': key('Shift+Left'),
  'win:move-right': key('Shift+Right'),
  'win:move-up': key('Shift+Up'),
  'win:move-down': key('Shift+Down'),
  'win:top-left': key('U'),
  'win:top-right': key('I'),
  'win:bottom-left': key('J'),
  'win:bottom-right': key('K'),
  'win:first-third': key('D'),
  'win:center-third': key('F'),
  'win:last-third': key('G'),
  'win:first-two-thirds': key('Shift+D'),
  'win:last-two-thirds': key('Shift+G'),
  'win:center': key('C'),
  'win:almost-maximize': key('Shift+Return'),
  'win:maximize': key('Return'),
  'win:maximize-width': key('W'),
  'win:maximize-height': key('H'),
  'win:toggle-fullscreen': key('Shift+F'),
  'win:next-display': key('N'),
  'win:previous-display': key('P'),
  'win:restore': key('Z')
}
