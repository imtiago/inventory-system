import { InventoryLot } from "../entities/InventoryLot";

/**
 * Ordem de saída dos lotes (FEFO → mais antigo): validade ascendente (sem validade
 * por último), depois criação, depois id. Espelha o `orderBy` do repositório Prisma.
 */
export function compareLotsForConsumption(a: InventoryLot, b: InventoryLot): number {
  const ea = a.expirationDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const eb = b.expirationDate?.getTime() ?? Number.POSITIVE_INFINITY;
  if (ea !== eb) return ea < eb ? -1 : 1;
  const ca = a.createdAt.getTime();
  const cb = b.createdAt.getTime();
  if (ca !== cb) return ca < cb ? -1 : 1;
  return 0;
}
