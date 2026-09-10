/**
 * Base class for launcher extensions.
 *
 * An extension is an {@link ActionSource} (it contributes rows and executes
 * them) plus a small per-extension context. Today that context is just
 * `this.storage` — a JSON document isolated by the extension's `id`, so two
 * extensions can use the same keys without colliding.
 *
 * Subclasses pass their `id` to `super()`; it is both the storage namespace and
 * the conventional prefix of their action ids.
 */
import { join } from 'node:path'
import type { ActionSource } from '@main/sources/base'
import type { ActionDefinition } from '@main/types'
import { ExtensionStorage } from './storage'

/** `<userData>/extensions`, set once at startup by `configureExtensions`. */
let rootDir = ''

/**
 * Point extensions at their storage directory. Must run before any `Extension`
 * is constructed — `actions.ts` calls this at module load.
 */
export function configureExtensions(userDataDir: string): void {
  rootDir = join(userDataDir, 'extensions')
}

export abstract class Extension implements ActionSource {
  readonly id: string
  protected readonly storage: ExtensionStorage

  constructor(id: string) {
    this.id = id
    this.storage = new ExtensionStorage(join(rootDir, `${id}.json`), `ext:${id}`)
  }

  /** `id` itself, or any `id:*` action. Override for a different scheme. */
  owns(actionId: string): boolean {
    return actionId === this.id || actionId.startsWith(`${this.id}:`)
  }

  abstract provide(query: string): ActionDefinition[] | Promise<ActionDefinition[]>

  abstract execute(actionId: string, query: string): void | Promise<void>
}
