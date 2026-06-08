import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { useWorker } from "@/components/worker_context.tsx";
import { Greeting, GreetingProps } from "@/components/form/greeting/index.tsx";

export function Index() {
  const worker = useWorker();

  useEffect(() => {
    document.title = "Home";
  }, []);

  const handleOnSubmit: GreetingProps["onSubmit"] = async (value) => {
    const message = await worker.greeting.getGreeting(value.name);
    alert(message);
  };

  return <Greeting onSubmit={handleOnSubmit} />;
}

export const Route = createFileRoute("/")({
  component: Index,
});
