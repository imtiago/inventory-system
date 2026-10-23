export type UserRole = "ADMIN" | "VENDEDOR" | "ESTOQUISTA";

/** Espelha backend/src/shared/auth/permissions.ts (matriz aprovada na spec da Fases 4A e 6A). */
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
  "purchases.read",
  "purchases.write",
  "purchases.receive",
  "payables.read",
  "payables.pay",
  "payables.reverse",
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
  ESTOQUISTA: [
    "catalog.read",
    "catalog.write",
    "inventory.read",
    "inventory.write",
    "purchases.read",
    "purchases.receive",
    "self",
  ],
};

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
  return ROLE_PERMISSIONS[role as UserRole].includes(permission);
}
