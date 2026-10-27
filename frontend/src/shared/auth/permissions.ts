export type UserRole = "ADMIN" | "VENDEDOR" | "ESTOQUISTA";

/** Espelha backend/src/shared/auth/permissions.ts (matriz aprovada na spec da Fases 4A e 6A). */
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
  ADMIN: PERMISSIONS,
  VENDEDOR: [
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

export interface PermissionSubject {
  role: string;
  canApproveCredit?: boolean;
}

/** Espelha `USER_FLAG_PERMISSIONS` do backend: permissões que também podem vir de uma marca do usuário. */
export const USER_FLAG_PERMISSIONS: Partial<Record<Permission, 'canApproveCredit'>> = {
  'credit.approve': 'canApproveCredit',
};

/**
 * Papel **ou** marca por usuário (espelha `hasUserPermission`). Aceita só o papel (string) para
 * quem não tem o usuário inteiro à mão: nesse caso a marca não conta.
 */
export function can(
  subject: PermissionSubject | string | null | undefined,
  permission: Permission,
): boolean {
  if (!subject) return false;
  const { role, canApproveCredit } = typeof subject === 'string' ? { role: subject, canApproveCredit: false } : subject;
  if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
  if (ROLE_PERMISSIONS[role as UserRole].includes(permission)) return true;
  const flag = USER_FLAG_PERMISSIONS[permission];
  return flag !== undefined && flag === 'canApproveCredit' && canApproveCredit === true;
}
