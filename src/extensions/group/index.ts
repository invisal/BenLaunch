import { Extension } from "@core/base";
import { ActionDefinition } from "@main/types";

export class GroupExtension extends Extension {
  constructor() {
    super("group");
  }

  execute(actionId: string, query: string): void | Promise<void> {
    if (actionId === "group:list") {
      this.ctx.navigate("group-list");
      return;
    }
    console.log("group:", "execute", actionId, query);
  }

  async provide(): Promise<ActionDefinition[]> {
    return [
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
          id: "group:list",
          title: "Manage Group",
          type: "command",
          icon: "G",
        },
        run: () => {},
      },
    ];
  }
}
