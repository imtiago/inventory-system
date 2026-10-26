// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppToaster } from "./shared/components/AppToaster";
import { AppRoutes } from "./routes/AppRoutes";
import { queryClient } from "./shared/react-query/queryClient";
import { startThemeSync } from "./shared/store/theme";


import "./index.css";

// O script inline do index.html já pintou o tema certo; aqui o app passa a acompanhar o sistema e as outras abas.
startThemeSync();


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <AppToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
