import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { containsLiteral } from "@shared/infrastructure/database/literalSearch";
import type { LegacyCustomerLookup } from "../../application/contracts/LegacyImportBatchRepository";
import { normalizeName } from "../../domain/nameSimilarity";

/** Até este total, todos os clientes entram na comparação (loja pequena: < 100 clientes no caderninho). */
export const LARGE_STORE = 5000;

export class PrismaLegacyCustomerLookup implements LegacyCustomerLookup {
  async candidates(names: string[]) {
    const db = getDb();
    const select = { id: true, name: true, phone: true } as const;
    const total = await db.customer.count();
    if (total <= LARGE_STORE) return db.customer.findMany({ select, orderBy: [{ name: "asc" }, { id: "asc" }] });
    // Loja grande: só quem contém o 1º termo normalizado de algum nome (ILIKE). Limitação: o banco não
    // ignora acento, então "Jose" não traz "José"; nesse caso o aviso de parecido pode não aparecer.
    const tokens = [...new Set(names.map((n) => normalizeName(n)[0]).filter((t): t is string => !!t))];
    if (tokens.length === 0) return [];
    return db.customer.findMany({
      select,
      where: { OR: tokens.map((t) => ({ name: containsLiteral(t) })) },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async exists(id: string) {
    return (await getDb().customer.count({ where: { id } })) > 0;
  }

  async get(id: string) {
    return getDb().customer.findUnique({ where: { id }, select: { id: true, name: true, phone: true } });
  }
}
