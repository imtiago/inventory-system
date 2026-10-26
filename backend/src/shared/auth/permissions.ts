import { UserRole } from "@auth/domain/enums/UserRole";

/** Permissões da aplicação (matriz aprovada na spec da Fases 4A e 6A). */
export const PERMISSIONS = [
  "users.manage",
  "catalog.read",
  "catalog.write",
  "catalog.delete",
  "catalog.price",
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
  "purchases.revert",
  "payables.read",
  "payables.pay",
  "payables.reverse",
  "self",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.ADMIN]: PERMISSIONS,
  [UserRole.VENDEDOR]: [
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
  [UserRole.ESTOQUISTA]: [
    "catalog.read",
    "catalog.write",
    "inventory.read",
    "inventory.write",
    "purchases.read",
    "purchases.receive",
    "self",
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  // hasOwn: "constructor", "__proto__" etc. não são papéis.
  if (!Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
  return ROLE_PERMISSIONS[role as UserRole].includes(permission);
}
