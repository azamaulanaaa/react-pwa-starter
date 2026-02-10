import { BrowserRouter, Route, Routes } from "react-router";
import "@/app.css";

import { WorkerProvider } from "@/component/worker_context.tsx";
import { Homepage } from "@/page/homepage.tsx";

export function App() {
  return (
    <WorkerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Homepage />} />
        </Routes>
      </BrowserRouter>
    </WorkerProvider>
  );
}
