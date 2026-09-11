import { ListScreen } from "@renderer/shared/ui";
import { useState } from "react";
import type { GroupItem } from "./../types";

export default function GroupListScreen() {
  const [groups] = useState<GroupItem[]>([
    { id: "123456", name: "Testing" },
    { id: "123457", name: "Testing 1" },
    { id: "123458", name: "Testing 2" },
    { id: "123458", name: "Testing 3" },
  ]);

  return (
    <ListScreen
      data={groups}
      getId={(item) => item.id}
      getSearchText={(item) => item.name}
      customFooter={<div>Hello World</div>}
      renderItem={(item) => {
        return <ListScreen.Item title={item.name} />;
      }}
    />
  );
}
