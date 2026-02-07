import { useEffect } from "react";

export function App() {
  useEffect(() => {
    document.title = "Index";
  });

  return "Hello world";
}
