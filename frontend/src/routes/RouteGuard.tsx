// src/routes/RouteGuard.tsx

import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../shared/hooks/useAuth";
import type { RouteGuard as GuardType } from "./types";

interface Props {
  guard: GuardType;
  children: ReactNode;
}

export function RouteGuard({ guard, children }: Props) {
  const { isAuthenticated } = useAuth();

  switch (guard) {
    case "public":
      if (isAuthenticated) {
        return <Navigate to="/" replace />;
      }
      return <>{children}</>;

    case "auth":
      if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
      }
      return <>{children}</>;

    case "admin":
      // implementar futuramente
      return <>{children}</>;

    case "seller":
      // implementar futuramente
      return <>{children}</>;

    default:
      return <>{children}</>;
  }
}
