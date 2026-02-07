import { useEffect } from "react";

export function Homepage() {
  useEffect(() => {
    document.title = "Home";
  }, []);

  return "Hello, world!";
}
