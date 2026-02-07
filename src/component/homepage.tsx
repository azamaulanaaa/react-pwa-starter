import { useEffect } from "react";

export function Homepage() {
  useEffect(() => {
    document.title = "Home";
  }, []);

  return <h1 className="text-bold">Hello, world!</h1>;
}
