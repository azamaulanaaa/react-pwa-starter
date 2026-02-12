import { useEffect } from "react";

import { useWorker } from "@/component/worker_context.tsx";
import { Greeting, GreetingProps } from "@/component/form/greeting/index.tsx";

export function Homepage() {
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
