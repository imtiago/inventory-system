export type UserRole = "ADMIN" | "VENDEDOR" | "ESTOQUISTA";

/** Espelha backend/src/shared/auth/permissions.ts (matriz aprovada na spec da Fase 4A). */
export const PERMISSIONS = [
  "users.manage",
  "catalog.read",
  "catalog.write",
  "catalog.delete",
  "customers.read",
  "customers.write",
  "sales.read",
  "sales.create",
  "sales.cancel",
  "inventory.read",
  "inventory.write",
  "finance.read",
  "finance.pay",
  "finance.reverse",
  "self",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  VENDEDOR: [
    "catalog.read",
    "catalog.write",
    "customers.read",
    "customers.write",
    "sales.read",
    "sales.create",
    "sales.cancel",
    "inventory.read",
    "finance.read",
    "finance.pay",
    "self",
  ],
  ESTOQUISTA: ["catalog.read", "catalog.write", "inventory.read", "inventory.write", "self"],
};

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
  return ROLE_PERMISSIONS[role as UserRole].includes(permission);
}
