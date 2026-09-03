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
    this.warm()
  }

  /** Called when the launcher is shown; kick a background re-run of stale values. */
  refresh(): void {
    this.warm()
  }

  provide(): ActionDefinition[] {
    // Also nudge stale values here so the renderer that just called `query()` is
    // definitely mounted and listening by the time an update is pushed.
    this.warm()

    return this.store
      .list()
      .filter((qv) => qv.exposed)
      .map((qv) => ({
        action: {
          id: `qv:${qv.id}`,
          title: qv.name,
          subtitle: this.runner.getSubtitle(qv.id) || 'QuickValue',
          icon: '⚡',
          type: 'quickvalue' as const,
          isLoading: this.runner.isLoading(qv.id)
        },
        run: () => {
          const subtitle = this.runner.getSubtitle(qv.id)
          if (subtitle) clipboard.writeText(subtitle)
          void this.runner.run(qv.id, qv.code)
        }
      }))
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

  private warm(): void {
    const exposed = this.store.list().filter((qv) => qv.exposed)
    this.runner.prune(exposed.map((qv) => qv.id))
    for (const qv of exposed) this.runner.refreshIfStale(qv.id, qv.code)
  }
}
