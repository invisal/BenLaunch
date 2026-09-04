import { clipboard } from 'electron'
import type { ActionDefinition } from '../../types'
import type { ActionSource } from '../base'
import { openQuickValueWindow } from './window'
import type { QuickValueRunner } from './runner'
import type { QuickValueStore } from './store'

/** Action id that opens the editor for an existing QuickValue (from the row menu). */
const EDIT_PREFIX = 'qv:edit:'

/**
 * Exposes each "exposed" QuickValue as a launcher command whose subtitle is the
 * value its function last returned. The list itself is cheap and in-memory (from
 * `QuickValueStore`); only the per-item values are async, and `QuickValueRunner`
 * already caches those with stale-then-refresh semantics — so this is a plain
 * `ActionSource`, not a `CachedActionSource`.
 *
 * Rows are marked `isDeferredSubtitle`: `provide()` never runs a QuickValue's
 * code itself (that would mean spawning a worker for every exposed QuickValue
 * on every keystroke, whether or not the row is ever seen). It only reports
 * whatever is already cached. The renderer requests a fresh subtitle — via
 * `requestSubtitle` below — once a row actually renders, which virtualization
 * keeps limited to visible rows.
 */
export class QuickValueSource implements ActionSource {
  readonly id = 'qv'

  constructor(
    private readonly store: QuickValueStore,
    private readonly runner: QuickValueRunner
  ) {}

  init(): void {
    this.store.init()
    this.runner.init()
  }

  provide(): ActionDefinition[] {
    const exposed = this.store.list().filter((qv) => qv.exposed)
    // Cheap bookkeeping only — drops cache entries for QuickValues that no
    // longer exist/are no longer exposed. No code runs here.
    this.runner.prune(exposed.map((qv) => qv.id))

    return exposed.map((qv) => {
      const subtitle = this.runner.getSubtitle(qv.id)
      return {
        action: {
          id: `qv:${qv.id}`,
          title: qv.name,
          subtitle: subtitle || 'QuickValue',
          icon: '⚡',
          type: 'quickvalue' as const,
          isDeferredSubtitle: true,
          // No cached value yet is just as much "not ready to show" as an
          // in-flight fetch — both render as a spinner.
          isLoading: this.runner.isLoading(qv.id) || subtitle === ''
        },
        run: () => {
          const s = this.runner.getSubtitle(qv.id)
          if (s) clipboard.writeText(s)
          void this.runner.run(qv.id, qv.code)
        }
      }
    })
  }

  owns(actionId: string): boolean {
    return actionId.startsWith('qv:')
  }

  async execute(actionId: string): Promise<void> {
    if (actionId.startsWith(EDIT_PREFIX)) {
      openQuickValueWindow({ view: 'edit', id: actionId.slice(EDIT_PREFIX.length) })
      return
    }
    const qv = this.store.get(actionId.slice('qv:'.length))
    if (qv) await this.runner.run(qv.id, qv.code)
  }

  requestSubtitle(actionId: string): Promise<void> {
    const id = actionId.slice('qv:'.length)
    const qv = this.store.get(id)
    if (!qv?.exposed) {
      console.log(`[quickvalue] ${id}: requestSubtitle ignored — not found or not exposed`)
      return Promise.resolve()
    }
    console.log(`[quickvalue] ${id}: requestSubtitle (row rendered)`)
    return this.runner.refreshIfStale(qv.id, qv.code)
  }
}
