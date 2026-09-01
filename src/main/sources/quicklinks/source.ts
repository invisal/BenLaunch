import { app, clipboard, shell } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { QuicklinkCreateResult, QuicklinkDraft } from '../../../shared/quicklink'
import type { ActionDefinition } from '../../types'
import type { ActionSource } from '../base'
import {
  QuicklinkStore,
  expandDynamic,
  hasPlaceholder,
  isWebTarget,
  monogramIcon,
  parseArgument,
  prettyLink,
  resolveLink,
  type Quicklink
} from './quicklinks'

/** Ids of the built-in management actions this source also provides. */
const EDIT_ACTION_ID = 'ql:__edit'
const CREATE_ACTION_ID = 'ql:__create'

/**
 * User-defined quicklinks (`ql:` ids) — named shortcuts to a URL, optionally with
 * a `{query}` placeholder that the typed argument is substituted into. This is a
 * query-driven source: `provide` looks at the current query so the result can
 * show a live preview of the URL that will open, but the action id stays stable
 * (`ql:<id>`) so usage-ranking still works. The argument is re-parsed from the
 * query at execution time.
 */
export class QuicklinkSource implements ActionSource {
  readonly id = 'ql'

  private readonly store = new QuicklinkStore({ dir: app.getPath('userData') })

  init(): void {
    this.store.list()
  }

  refresh(): void {
    this.store.reload()
  }

  provide(query: string): ActionDefinition[] {
    const definitions = this.store.list().map((link) => this.toDefinition(link, query))
    definitions.push(
      {
        action: {
          id: CREATE_ACTION_ID,
          title: 'Create Quicklink',
          subtitle: 'Add a shortcut to a URL, file, or folder',
          icon: '➕',
          type: 'command',
          view: 'create-quicklink'
        },
        run: () => {}
      },
      {
        action: {
          id: EDIT_ACTION_ID,
          title: 'Edit Quicklinks',
          subtitle: 'Open quicklinks.json in your editor',
          icon: '🔗',
          type: 'command'
        },
        run: () => {
          void shell.openPath(this.store.filePath())
        }
      }
    )
    return definitions
  }

  /** Persist a quicklink from the Create form; surfaces validation errors to the renderer. */
  create(draft: QuicklinkDraft): QuicklinkCreateResult {
    try {
      const entry = this.store.add(draft)
      return { ok: true, name: entry.name }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' }
    }
  }

  owns(actionId: string): boolean {
    return actionId.startsWith(`${this.id}:`)
  }

  async execute(actionId: string, query: string): Promise<void> {
    if (actionId === EDIT_ACTION_ID) {
      await shell.openPath(this.store.filePath())
      return
    }

    const link = this.store.list().find((entry) => `ql:${entry.id}` === actionId)
    if (!link) return

    const withArgument = resolveLink(link.link, parseArgument(query, link))
    const needsClipboard = /\{\s*clipboard\s*\}/i.test(withArgument)
    const target = expandDynamic(withArgument, {
      clipboard: needsClipboard ? await clipboard.readText() : undefined
    })

    // "Open With" a specific app: hand it the target as an argument.
    if (link.openWith && existsSync(link.openWith)) {
      execFile(link.openWith, [target.replace(/^file:\/\//i, '')], (error) => {
        if (error) console.error(`[quicklinks] Failed to open ${target} with ${link.openWith}:`, error)
      })
      return
    }

    if (isWebTarget(target)) {
      await shell.openExternal(target)
    } else {
      const error = await shell.openPath(target.replace(/^file:\/\//i, ''))
      if (error) console.error(`[quicklinks] Failed to open ${target}: ${error}`)
    }
  }

  private toDefinition(link: Quicklink, query: string): ActionDefinition {
    const takesArgument = hasPlaceholder(link.link)
    const argument = parseArgument(query, link)
    // Preview only — the real open re-resolves with live clipboard/uuid values.
    const resolved = expandDynamic(resolveLink(link.link, argument))

    let subtitle: string
    if (!takesArgument) {
      subtitle = prettyLink(link.link)
    } else if (argument) {
      subtitle = `Open ${prettyLink(resolved)}`
    } else {
      // Show the target with the placeholder collapsed to an ellipsis, e.g.
      // "www.google.com/search?q=…", so it reads as a real destination.
      subtitle = prettyLink(link.link).replace(/\{[^}]*\}/g, '…')
    }

    return {
      action: {
        id: `ql:${link.id}`,
        title: link.name,
        subtitle,
        icon: link.icon ?? monogramIcon(link.name),
        type: 'quicklink',
        ...(link.keyword ? { keyword: link.keyword } : {}),
        ...(link.tags?.length ? { tags: link.tags } : {})
      },
      run: () => {
        void this.execute(`ql:${link.id}`, query)
      }
    }
  }
}
