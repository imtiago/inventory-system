import type { ReactNode } from "react";

import { useCan } from "./useCan";
import type { Permission } from "./permissions";

/** Renders children only when the current user has the permission. */
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useCan(permission) ? <>{children}</> : null;
}
