import { clipboard } from 'electron'
import { Extension } from '@core/base'
import type { RequestSubtitleOptions } from '@shared/types'
import type { ActionDefinition } from '@main/types'
import { openWidgetWindow } from './window'
import { WidgetRunner } from './runner'
import { WidgetStore } from './store'

/** Action id that opens the code editor window for an existing Widget. */
const EDIT_PREFIX = 'widget:edit:'

/**
 * Exposes each "exposed" Widget as a launcher command whose subtitle is the
 * value its function last returned. The list itself is cheap and in-memory (from
 * `WidgetStore`); only the per-item values are async, and `WidgetRunner`
 * already caches those with stale-then-refresh semantics — so this is a plain
 * `Extension`, not a cached source.
 *
 * As the Widget `Extension` this is also the composition root for its pieces:
 * both `store` and `runner` persist through `this.storage`
 * (`<userData>/extensions/widget.json`, keyed `widgets` / `values`). They're
 * exposed so `index.ts` can wire the manager window's IPC to the same instances.
 *
 * Rows are marked `isDeferredSubtitle`: `provide()` never runs a Widget's
 * code itself (that would mean spawning a worker for every exposed Widget
 * on every keystroke, whether or not the row is ever seen). It only reports
 * whatever is already cached. The renderer requests a fresh subtitle — via
 * `requestSubtitle` below, which resolves with the value directly (there is no
 * separate push channel) — once a row actually renders, which virtualization
 * keeps limited to visible rows.
 */
export class WidgetSource extends Extension {
  readonly store: WidgetStore
  readonly runner: WidgetRunner

  constructor() {
    super('widget')
    this.store = new WidgetStore(this.storage)
    this.runner = new WidgetRunner(this.storage)
  }

  init(): void {
    this.store.init()
    this.runner.init()
  }

  provide(): ActionDefinition[] {
    const exposed = this.store.list().filter((widget) => widget.exposed)
    // Cheap bookkeeping only — drops cache entries for Widgets that no
    // longer exist/are no longer exposed. No code runs here.
    this.runner.prune(exposed.map((widget) => widget.id))

    return exposed.map((widget) => {
      const subtitle = this.runner.getSubtitle(widget.id)
      return {
        action: {
          id: `widget:${widget.id}`,
          title: widget.name,
          subtitle: subtitle || 'Widget',
          icon: '⚡',
          type: 'widget' as const,
          isDeferredSubtitle: true,
          // No cached value yet is just as much "not ready to show" as an
          // in-flight fetch — both render as a spinner.
          isLoading: this.runner.isLoading(widget.id) || subtitle === ''
        },
        run: () => {
          const s = this.runner.getSubtitle(widget.id)
          if (s) clipboard.writeText(s)
          void this.runner.run(widget.id, widget.code)
        }
      }
    })
  }

  async execute(actionId: string): Promise<void> {
    if (actionId.startsWith(EDIT_PREFIX)) {
      openWidgetWindow({ view: 'code', id: actionId.slice(EDIT_PREFIX.length) })
      return
    }
    const widget = this.store.get(actionId.slice('widget:'.length))
    if (widget) await this.runner.run(widget.id, widget.code)
  }

  async requestSubtitle(actionId: string, opts?: RequestSubtitleOptions): Promise<string | undefined> {
    const id = actionId.slice('widget:'.length)
    const widget = this.store.get(id)
    if (!widget?.exposed) {
      console.log(`[widget] ${id}: requestSubtitle ignored — not found or not exposed`)
      return undefined
    }
    if (opts?.force) {
      console.log(`[widget] ${id}: requestSubtitle (forced)`)
      await this.runner.run(widget.id, widget.code)
    } else {
      console.log(`[widget] ${id}: requestSubtitle (row rendered)`)
      await this.runner.refreshIfStale(widget.id, widget.code)
    }
    return this.runner.getSubtitle(widget.id)
  }
}
