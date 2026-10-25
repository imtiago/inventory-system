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
  const { isAuthenticated, isRestoring, restoreFailed, retryRestore, isRetrying, user, sessionExpired } = useAuth();

  if (isRestoring) return null;

  if (restoreFailed) {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">Não foi possível carregar sua sessão.</p>
        <p className="text-gray-600">Verifique sua conexão e tente novamente.</p>
        <button type="button" onClick={retryRestore} disabled={isRetrying} className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {isRetrying ? "Tentando novamente..." : "Tentar novamente"}
        </button>
      </div>
    );
  }

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
