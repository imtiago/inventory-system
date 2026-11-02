import { useAuthStore } from "@/shared/store/auth";
import { can, type Permission } from "./permissions";

export function useCan(permission: Permission): boolean {
  const user = useAuthStore((s) => s.user);
  return can(user, permission);
}
