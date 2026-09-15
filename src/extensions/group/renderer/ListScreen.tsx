import { ListScreen } from "@renderer/shared/ui";
import { useEffect, useState } from "react";
import type { GroupDef } from "../shared/types";

export default function GroupListScreen() {
  const [groups, setGroups] = useState<GroupDef[]>([]);

  useEffect(() => {
    window.api.group.list().then(setGroups);
  }, []);

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
