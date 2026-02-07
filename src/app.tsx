import { BrowserRouter, Route, Routes } from "react-router";
import { Homepage } from "@/component/homepage.tsx";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
      </Routes>
    </BrowserRouter>
  );
}
