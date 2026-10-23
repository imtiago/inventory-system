import { useAuthStore } from "@/shared/store/auth";
import { can, type Permission } from "./permissions";

export function useCan(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return can(role, permission);
}
