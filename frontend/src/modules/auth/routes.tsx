// src/modules/auth/routes.ts
import { Login } from "./pages/Login"; // named export

export const authRoutes = [
  {
    path: "/login",
    element: <Login />
  },
];