import { app, shell } from 'electron'
import { exec } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ActionDefinition } from '../../types'
import type { ActionSource } from '../base'

/** Static launcher-level commands (lock, open folders, quit, …). */
export class BuiltinCommandSource implements ActionSource {
  readonly id = 'cmd'

  private readonly definitions: ActionDefinition[] = [
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

  provide(): ActionDefinition[] {
    return this.definitions
  }

  owns(actionId: string): boolean {
    return actionId.startsWith(`${this.id}:`)
  }

  async execute(actionId: string, _query: string): Promise<void> {
    await this.definitions.find((definition) => definition.action.id === actionId)?.run()
  }
}
