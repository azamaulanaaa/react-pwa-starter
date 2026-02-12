import { useEffect, useState } from "react";

import { useWorker } from "@/component/worker_context.tsx";
import {
  FormInsertListItem,
  FormInsertListItemProps,
} from "@/component/insert_list_item/index.tsx";
import { List, ListProps } from "@/component/list/index.tsx";

export const Homepage = () => {
  const worker = useWorker();

  const [items, setItems] = useState<
    ListProps["items"]
  >([]);

  const refreshData = async () => {
    const data = await worker.db.getAllListItems();
    const transformed_data = data.map((item) => ({
      ...item,
      created_at: new Date(item.created_at),
      modified_at: new Date(item.modified_at),
    }));
    setItems(transformed_data);
  };

  useEffect(() => {
    document.title = "Home";
    refreshData();
  }, []);

  const handleOnSubmit: FormInsertListItemProps["onSubmit"] = async (value) => {
    await worker.db.addListItem(value.content);
    await refreshData();
  };

  return (
    <div className="flex flex-col gap-4">
      <FormInsertListItem onSubmit={handleOnSubmit} />
      <List items={items} />
    </div>
  );
};
