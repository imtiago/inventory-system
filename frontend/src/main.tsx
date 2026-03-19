import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "./routes";
import { Toaster } from "sonner";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
      <Toaster richColors />
    </QueryClientProvider>
  </React.StrictMode>,
);
