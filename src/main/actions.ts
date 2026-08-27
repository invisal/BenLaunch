import { app, shell } from 'electron'
import { exec } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LauncherAction } from '../shared/types'
import { getInstalledApplications } from './apps'
import type { ActionDefinition } from './types'

const commandDefinitions: ActionDefinition[] = [
  {
    action: {
      id: 'cmd:lock',
      title: 'Lock Computer',
      subtitle: 'Lock this PC',
      icon: '🔒',
      type: 'command'
    },
    run: () => {
      exec('rundll32.exe user32.dll,LockWorkStation', (error) => {
        if (error) console.error('[main] Failed to lock computer:', error)
      })
    }
  },
  {
    action: {
      id: 'cmd:open-downloads',
      title: 'Open Downloads Folder',
      subtitle: 'Reveal your Downloads folder',
      icon: '📁',
      type: 'command'
    },
    run: () => {
      void shell.openPath(join(homedir(), 'Downloads'))
    }
  },
  {
    action: {
      id: 'cmd:open-documents',
      title: 'Open Documents Folder',
      subtitle: 'Reveal your Documents folder',
      icon: '📁',
      type: 'command'
    },
    run: () => {
      void shell.openPath(join(homedir(), 'Documents'))
    }
  },
  {
    action: {
      id: 'cmd:empty-recycle-bin',
      title: 'Empty Recycle Bin',
      subtitle: 'Permanently delete items in the Recycle Bin',
      icon: '🗑️',
      type: 'command'
    },
    run: () => {
      exec(
        'powershell.exe -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"',
        (error) => {
          if (error) console.error('[main] Failed to empty recycle bin:', error)
        }
      )
    }
  },
  {
    action: {
      id: 'cmd:quit',
      title: 'Quit Launcher',
      subtitle: 'Exit BenPocket Launcher',
      icon: '⏻',
      type: 'command',
      shortcut: 'CommandOrControl+Q'
    },
    run: () => {
      app.quit()
    }
  }
]

let appsPromise: Promise<ActionDefinition[]> | null = null

function loadInstalledApplications(): Promise<ActionDefinition[]> {
  if (!appsPromise) {
    appsPromise = getInstalledApplications().catch((error) => {
      console.error('[main] Failed to load installed applications:', error)
      return []
    })
  }
  return appsPromise
}

async function getAllDefinitions(): Promise<ActionDefinition[]> {
  const installedApps = await loadInstalledApplications()
  return [...commandDefinitions, ...installedApps]
}

export async function searchActions(query: string): Promise<LauncherAction[]> {
  const definitions = await getAllDefinitions()

  const trimmed = query.trim().toLowerCase()
  const matches = trimmed
    ? definitions.filter((definition) => definition.action.title.toLowerCase().includes(trimmed))
    : definitions

  return matches.map((definition) => definition.action)
}

export async function executeAction(id: string): Promise<void> {
  const definitions = await getAllDefinitions()
  const definition = definitions.find((d) => d.action.id === id)
  await definition?.run()
}
