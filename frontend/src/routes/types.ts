// src/routes/types.ts

import type { ComponentType, ReactNode } from "react";

export type RouteGuard = "public" | "auth" | "admin" | "seller";

export interface AppRoute {
  label: string;
  path: string;
  component: ComponentType;
  element?: ReactNode;
  guard: RouteGuard;
}
