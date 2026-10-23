// src/routes/RouteGuard.tsx

import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../shared/hooks/useAuth";
import { can, type Permission } from "../shared/auth/permissions";
import { ForbiddenPage } from "../shared/auth/ForbiddenPage";
import type { RouteGuard as GuardType } from "./types";

interface Props {
  guard: GuardType;
  permission?: Permission;
  children: ReactNode;
}

export function RouteGuard({ guard, permission, children }: Props) {
  const { isAuthenticated, isRestoring, user, sessionExpired } = useAuth();

  if (isRestoring) return null;

  switch (guard) {
    case "public":
      if (isAuthenticated) {
        return <Navigate to="/" replace />;
      }
      return <>{children}</>;

    case "auth":
      if (!isAuthenticated) {
        return <Navigate to={sessionExpired ? "/login?expired=1" : "/login"} replace />;
      }
      if (permission && !can(user?.role, permission)) {
        return <ForbiddenPage />;
      }
      return <>{children}</>;

    default:
      return <>{children}</>;
  }
}
