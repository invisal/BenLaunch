import type { IpcMain } from "electron";
import { Extension } from "@core/base";
import type { ActionDefinition } from "@main/types";
import { GROUP_CHANNELS, type GroupDraft } from "./shared/types";
import { GroupStore } from "./main/store";

/**
 * As the Group `Extension` this is also the composition root for its store —
 * it persists through `this.storage` (`<userData>/extensions/group.json`,
 * keyed `groups`) and exposes it as `store` so the manager screen's IPC
 * (`registerIpc()`) wires to the same instance.
 */
export class GroupExtension extends Extension {
  readonly store: GroupStore;

  constructor() {
    super("group");
    this.store = new GroupStore(this.storage);
  }

  init(): void {
    this.store.init();
  }

  /** Wires the Group manager screen's CRUD calls to the store directly — small enough not to need its own `ipc/handlers.ts`. */
  registerIpc(ipc: IpcMain): void {
    ipc.handle(GROUP_CHANNELS.list, () => this.store.list());
    ipc.handle(
      GROUP_CHANNELS.get,
      (_event, id: string) => this.store.get(id) ?? null,
    );
    ipc.handle(GROUP_CHANNELS.save, (_event, draft: GroupDraft) =>
      this.store.save(draft),
    );
    ipc.handle(GROUP_CHANNELS.delete, (_event, id: string) => {
      this.store.remove(id);
    });
    ipc.handle(GROUP_CHANNELS.items, async (_event, id: string) => {
      const group = this.store.get(id);
      if (!group) return [];
      const definitions = await this.ctx.resolveActions(group.sourceIds);
      return definitions.map((definition) => definition.action);
    });
  }

  execute(actionId: string, query: string): void | Promise<void> {
    if (actionId === "group:manage") {
      this.ctx.navigate("group-list");
      return;
    }
    console.log("group:", "execute", actionId, query);
  }

  /** The two management commands, plus one row per Group the store holds. */
  provide(): ActionDefinition[] {
    const commands: ActionDefinition[] = [
      {
        action: {
          id: "group:create",
          title: "Create Group",
          type: "command",
          icon: "G",
        },
        run: () => {},
      },
      {
        action: {
          id: "group:manage",
          title: "Manage Group",
          type: "command",
          icon: "G",
        },
        run: () => {},
      },
    ];

    const groups: ActionDefinition[] = this.store.list().map((group) => ({
      action: {
        id: `group:${group.id}`,
        title: group.name,
        subtitle: `${group.sourceIds.length} item${group.sourceIds.length === 1 ? "" : "s"}`,
        type: "command",
        icon: "G",
      },
      run: () => {},
    }));

    return [...commands, ...groups];
  }
}
