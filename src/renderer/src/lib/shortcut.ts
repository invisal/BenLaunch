/**
 * Formats Electron accelerator strings (e.g. "CommandOrControl+Shift+K")
 * into the symbols/labels users expect on their platform.
 */

export function isMac(): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform
  return /Mac|iPhone|iPod|iPad/i.test(platform)
}

const MAC_SYMBOLS: Record<string, string> = {
  commandorcontrol: '⌘',
  cmdorctrl: '⌘',
  command: '⌘',
  cmd: '⌘',
  control: '⌃',
  ctrl: '⌃',
  option: '⌥',
  alt: '⌥',
  shift: '⇧',
  super: '⌘',
  meta: '⌘',
  space: 'Space',
  plus: '+',
  enter: '⏎',
  return: '⏎',
  backspace: '⌫',
  delete: '⌦',
  escape: '⎋',
  esc: '⎋',
  tab: '⇥',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→'
}

const OTHER_LABELS: Record<string, string> = {
  commandorcontrol: 'Ctrl',
  cmdorctrl: 'Ctrl',
  command: 'Ctrl',
  cmd: 'Ctrl',
  control: 'Ctrl',
  ctrl: 'Ctrl',
  option: 'Alt',
  alt: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
  space: 'Space',
  plus: '+',
  enter: 'Enter',
  return: 'Enter',
  backspace: 'Backspace',
  delete: 'Delete',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→'
}

export function formatShortcut(accelerator: string, mac: boolean = isMac()): string {
  const map = mac ? MAC_SYMBOLS : OTHER_LABELS
  const tokens = accelerator
    .split('+')
    .filter(Boolean)
    .map((token) => map[token.toLowerCase()] ?? token.toUpperCase())

  if (!mac) return tokens.join('+')

  // On mac, modifier symbols are conventionally run together with no
  // separator, e.g. "⌘⇧K", but a word like "Space" still needs a gap.
  return tokens.reduce((out, token, i) => {
    if (i === 0) return token
    const needsSpace = token.length > 1
    return out + (needsSpace ? ' ' : '') + token
  }, '')
}
