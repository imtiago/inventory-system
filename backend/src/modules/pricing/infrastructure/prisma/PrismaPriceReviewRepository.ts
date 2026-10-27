import { Prisma } from "@prisma/client";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { readTogether } from "@shared/infrastructure/database/readTogether";
import { toCents } from "@shared/domain/money";
import { toCost4 } from "@shared/domain/cost4";
import type {
  PendingReviewWrite,
  PriceReviewCandidate,
  PriceReviewListItem,
  PriceReviewRecord,
  PriceReviewRepository,
} from "@pricing/application/contracts/PriceReviewRepository";
import type { ReviewScope } from "@pricing/application/contracts/PriceReviewTrigger";
import type { PriceReviewStatus } from "@pricing/domain/priceReview";

/** Centavos inteiros → texto decimal exato ("2490" → "24.90"), sem float. */
const centsText = (c: number) => `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, "0")}`;

type Row = {
  id: string;
  productVariantId: string;
  reason: PriceReviewRecord["reason"];
  status: PriceReviewStatus;
  currentPrice: Prisma.Decimal;
  suggestedPrice: Prisma.Decimal;
  createdAt: Date;
};

const toRecord = (r: Row): PriceReviewRecord => ({
  id: r.id,
  productVariantId: r.productVariantId,
  reason: r.reason,
  status: r.status,
  currentPriceCents: toCents(Number(r.currentPrice)),
  suggestedPriceCents: toCents(Number(r.suggestedPrice)),
  createdAt: r.createdAt,
});

export class PrismaPriceReviewRepository implements PriceReviewRepository {
  async findCandidates(scope: ReviewScope): Promise<PriceReviewCandidate[]> {
    const where =
      scope.kind === "ALL"
        ? Prisma.sql`TRUE`
        : scope.kind === "VARIANT"
          ? Prisma.sql`v.id = ${scope.id}`
          : scope.kind === "PRODUCT"
            ? Prisma.sql`v."productId" = ${scope.id}`
            : Prisma.sql`p."categoryId" = ${scope.id}`;
    const rows = await getDb().$queryRaw<
      { id: string; salePrice: string; averageCost: string; vm: number | null; pm: number | null; cm: number | null }[]
    >`
      SELECT v.id, v."salePrice"::text AS "salePrice", COALESCE(i."averageCost", 0)::text AS "averageCost",
             v."targetMarginBps" AS vm, p."targetMarginBps" AS pm, c."targetMarginBps" AS cm
      FROM "ProductVariant" v
      JOIN "Product" p ON p.id = v."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      LEFT JOIN "Inventory" i ON i."productVariantId" = v.id
      WHERE ${where}
      ORDER BY v.id`;
    return rows.map((r) => ({
      variantId: r.id,
      salePriceCents: toCents(Number(r.salePrice)),
      averageCost4: toCost4(Number(r.averageCost)),
      levels: { variant: r.vm, product: r.pm, category: r.cm },
    }));
  }

  async upsertPending(rows: PendingReviewWrite[]): Promise<void> {
    if (rows.length === 0) return;
    const sorted = [...rows].sort((a, b) => (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));
    // ON CONFLICT no único parcial: duas entradas simultâneas da mesma variante → uma só PENDING
    // (a segunda espera a primeira e atualiza a linha), nunca P2002.
    // FOR KEY SHARE da variante: variante excluída depois da leitura dos candidatos (configuração recalculando
    // tudo × exclusão de variante) sai do INSERT em vez de violar a FK (23503 → 409 RESOURCE_IN_USE).
    await getDb().$executeRaw`
      INSERT INTO "PriceReview" ("id", "productVariantId", "reason", "currentPrice", "suggestedPrice", "status", "createdAt")
      SELECT gen_random_uuid()::text, u.vid, u.reason::"PriceReviewReason", u.cur, u.sug, 'PENDING', now() AT TIME ZONE 'UTC'
      FROM unnest(
        ${sorted.map((r) => r.variantId)}::text[],
        ${sorted.map((r) => r.reason)}::text[],
        ${sorted.map((r) => centsText(r.currentPriceCents))}::numeric[],
        ${sorted.map((r) => centsText(r.suggestedPriceCents))}::numeric[]
      ) AS u(vid, reason, cur, sug)
      JOIN "ProductVariant" v ON v.id = u.vid
      ORDER BY u.vid
      FOR KEY SHARE OF v
      ON CONFLICT ("productVariantId") WHERE "status" = 'PENDING'
      DO UPDATE SET "reason" = EXCLUDED."reason", "currentPrice" = EXCLUDED."currentPrice",
                    "suggestedPrice" = EXCLUDED."suggestedPrice", "createdAt" = EXCLUDED."createdAt"`;
  }

  async deletePending(variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return;
    await getDb().priceReview.deleteMany({ where: { status: "PENDING", productVariantId: { in: variantIds } } });
  }

  async resolvePendingOfVariant(variantId: string, status: "APPLIED" | "DISMISSED", userId: string): Promise<void> {
    await getDb().priceReview.updateMany({
      where: { productVariantId: variantId, status: "PENDING" },
      data: { status, resolvedAt: new Date(), resolvedById: userId },
    });
  }

  async findByIds(ids: string[]): Promise<PriceReviewRecord[]> {
    return (await getDb().priceReview.findMany({ where: { id: { in: ids } } })).map(toRecord);
  }

  async lockByIds(ids: string[]): Promise<PriceReviewRecord[]> {
    if (ids.length === 0) return [];
    const rows = await getDb().$queryRaw<Row[]>`
      SELECT "id", "productVariantId", "reason"::text AS "reason", "status"::text AS "status",
             "currentPrice", "suggestedPrice", "createdAt"
      FROM "PriceReview" WHERE "id" = ANY(${ids}::text[])
      ORDER BY "productVariantId", "id" FOR UPDATE`;
    return rows.map(toRecord);
  }

  async resolve(ids: string[], status: "APPLIED" | "DISMISSED", userId: string): Promise<void> {
    if (ids.length === 0) return;
    await getDb().priceReview.updateMany({
      where: { id: { in: ids } },
      data: { status, resolvedAt: new Date(), resolvedById: userId },
    });
  }

  async list(input: { status: PriceReviewStatus; page: number; limit: number }) {
    const db = getDb();
    const where = { status: input.status };
    const [rows, total] = await readTogether([
      db.priceReview.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: { productVariant: { select: { name: true, product: { select: { name: true } } } } },
      }),
      db.priceReview.count({ where }),
    ]);
    const items: PriceReviewListItem[] = rows.map((r) => ({
      ...toRecord(r),
      label: `${r.productVariant.product.name} — ${r.productVariant.name}`,
    }));
    return { items, total };
  }

  countPending(): Promise<number> {
    return getDb().priceReview.count({ where: { status: "PENDING" } });
  }
}
