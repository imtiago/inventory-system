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
  "sales.cancel.request",
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
  "pricing.manage",
  "reports.profit",
  "credit.approve",
  "credit.manage",
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
    "sales.cancel.request",
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

export interface PermissionSubject {
  role: string;
  canApproveCredit: boolean;
}

/** Permissões que, além do papel, podem ser concedidas por uma marca do usuário. */
export const USER_FLAG_PERMISSIONS: Partial<Record<Permission, keyof Omit<PermissionSubject, "role">>> = {
  "credit.approve": "canApproveCredit",
};

/** Papel **ou** marca por usuário (`USER_FLAG_PERMISSIONS`). Papel desconhecido nunca tem permissão. */
export function hasUserPermission(subject: PermissionSubject, permission: Permission): boolean {
  if (!Object.hasOwn(ROLE_PERMISSIONS, subject.role)) return false;
  if (hasPermission(subject.role, permission)) return true;
  const flag = USER_FLAG_PERMISSIONS[permission];
  return flag !== undefined && subject[flag] === true;
}
