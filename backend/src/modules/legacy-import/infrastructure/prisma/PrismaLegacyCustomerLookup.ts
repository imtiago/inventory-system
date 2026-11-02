import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { LegacyCustomerLookup } from "../../application/contracts/LegacyImportBatchRepository";
import type { CustomerCandidate } from "../../domain/legacyBatchReview";
import { normalizeName } from "../../domain/nameSimilarity";

/** Até este total, todos os clientes entram na comparação (loja pequena: < 100 clientes no caderninho). */
export const LARGE_STORE = 5000;

// Acentos do português (maiúsculas e minúsculas) → letra sem acento. A extensão `unaccent` não está
// instalada no banco (exigiria migration); `translate` faz o mesmo para os caracteres que aparecem em nomes.
const ACCENTED = "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn";

export class PrismaLegacyCustomerLookup implements LegacyCustomerLookup {
  /** `largeStore`: acima deste total de clientes, a busca se restringe pelo 1º termo (injetável no teste). */
  constructor(private readonly largeStore = LARGE_STORE) {}

  async candidates(names: string[]): Promise<CustomerCandidate[]> {
    const db = getDb();
    const select = { id: true, name: true, phone: true } as const;
    const total = await db.customer.count();
    if (total <= this.largeStore) return db.customer.findMany({ select, orderBy: [{ name: "asc" }, { id: "asc" }] });
    // Loja grande: só quem contém o 1º termo normalizado de algum nome, comparando sem acento e sem
    // maiúsculas ("Jose" traz "José"). Os termos de `normalizeName` só têm [a-z0-9] (nada a escapar no LIKE).
    const tokens = [...new Set(names.map((n) => normalizeName(n)[0]).filter((t): t is string => !!t))];
    if (tokens.length === 0) return [];
    const patterns = tokens.map((t) => `%${t}%`);
    return db.$queryRaw<CustomerCandidate[]>`
      SELECT id, name, phone FROM "Customer"
      WHERE lower(translate(name, ${ACCENTED}, ${PLAIN})) LIKE ANY (${patterns}::text[])
      ORDER BY name ASC, id ASC`;
  }

  async exists(id: string) {
    return (await getDb().customer.count({ where: { id } })) > 0;
  }

  async namesOf(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await getDb().customer.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async get(id: string) {
    return getDb().customer.findUnique({ where: { id }, select: { id: true, name: true, phone: true } });
  }
}
