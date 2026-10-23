// src/routes/types.ts

import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import type { Permission } from "@/shared/auth/permissions";

export type RouteGuard = "public" | "auth";

export interface AppRoute {
  label: string;
  path: string;
  component: ComponentType;
  element?: ReactNode;
  guard: RouteGuard;
  /** Permission required to open the route (guard "auth" only). */
  permission?: Permission;
  showInMenu?: boolean;
  icon?: LucideIcon;
  /** Menu group heading; ungrouped items render first. */
  group?: string;
}
