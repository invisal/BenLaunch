import { ActionSource } from "@main/sources/base";
import { ActionDefinition } from "@main/types";

export class GroupExtension implements ActionSource {
  id = "group";

  execute(actionId: string, query: string): void | Promise<void> {
    console.log("group:", "execute", actionId, query);
    return;
  }

  owns(actionId: string) {
    return actionId.startsWith("group:");
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
