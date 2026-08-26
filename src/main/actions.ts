import type { LauncherAction } from '../shared/types'

const actions: LauncherAction[] = [
  {
    id: 'testing-1',
    title: 'Testing 1',
    subtitle: 'Run testing action 1',
    icon: '🧪',
    type: 'command',
    shortcut: 'CommandOrControl+1'
  },
  {
    id: 'testing-2',
    title: 'Testing 2',
    subtitle: 'Run testing action 2',
    icon: '🧪',
    type: 'command',
    shortcut: 'CommandOrControl+2'
  },
  {
    id: 'testing-3',
    title: 'Testing 3',
    subtitle: 'Run testing action 3',
    icon: '🧪',
    type: 'application'
  }
]

export function searchActions(query: string): LauncherAction[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return actions
  return actions.filter((action) => action.title.toLowerCase().includes(trimmed))
}

export function executeAction(id: string): void {
  const action = actions.find((a) => a.id === id)
  if (!action) return
  console.log(`[main] Executing: ${action.title}`)
}
