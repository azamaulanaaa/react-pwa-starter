import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { v7 as uuidv7 } from "uuid";

import { useWorker } from "@/component/worker_context.tsx";
import {
  FormInsertListItem,
  FormInsertListItemProps,
} from "@/component/insert_list_item/index.tsx";
import { List, ListProps } from "@/component/list/index.tsx";
import { proxy } from "comlink";

const Index = () => {
  const worker = useWorker();
  const [items, setItems] = useState<ListProps["items"]>([]);

  useEffect(() => {
    document.title = "Home";

    if (!worker) return;

    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      unsubscribe = await worker.db.observeQuery(
        "list",
        { selector: {} },
        proxy((data) => {
          const transformed_data = data.map((item: any) => ({
            ...item,
            created_at: new Date(item.created_at),
            modified_at: new Date(item.modified_at),
          }));
          setItems(transformed_data);
        }),
      );
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [worker]);

  const handleOnSubmit: FormInsertListItemProps["onSubmit"] = async (value) => {
    if (!worker) return;

    await worker.db.insert("list", {
      version: 1,
      id: uuidv7(),
      content: value.content,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormInsertListItem onSubmit={handleOnSubmit} />
      <List items={items} />
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: Index,
});
