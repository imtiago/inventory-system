import { Prisma } from "@prisma/client";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { ExportTooLargeError } from "@shared/domain/errors";
import { formatDateBr } from "@shared/http/csv";
import type { RawProfitRow } from "../../application/profit";
import type { ProfitView } from "../../interfaces/http/schemas/profitReportSchema";
import { SALE_DAY, salePeriod } from "./PrismaReportReadRepository";

interface SqlRow {
  key: string;
  label: string;
  revenueCents: string;
  cost4: string;
  itemsWithoutCost: number;
}

const DAY_BR = Prisma.sql`to_char((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')`;

/** Chave, rótulo, junções e ordem de cada agrupamento. */
function shape(view: ProfitView) {
  switch (view) {
    case "period":
      return {
        key: SALE_DAY,
        label: SALE_DAY,
        joins: Prisma.empty,
        group: Prisma.sql`${SALE_DAY}`,
        order: Prisma.sql`1`,
      };
    case "sale":
      return {
        key: Prisma.sql`s."id"`,
        label: Prisma.sql`c."name" || ' · ' || ${DAY_BR}`,
        joins: Prisma.sql`JOIN "Customer" c ON c."id" = s."customerId"`,
        group: Prisma.sql`s."id", s."createdAt", c."name"`,
        order: Prisma.sql`s."createdAt", s."id"`,
      };
    case "variant":
      return {
        key: Prisma.sql`v."id"`,
        label: Prisma.sql`p."name" || ' — ' || v."name"`,
        joins: Prisma.sql`JOIN "ProductVariant" v ON v."id" = si."productVariantId" JOIN "Product" p ON p."id" = v."productId"`,
        group: Prisma.sql`v."id", p."name", v."name"`,
        order: Prisma.sql`SUM(si."quantity" * si."unitPrice") DESC, 2, 1`,
      };
    case "category":
      return {
        key: Prisma.sql`cat."id"`,
        label: Prisma.sql`cat."name"`,
        joins: Prisma.sql`JOIN "ProductVariant" v ON v."id" = si."productVariantId" JOIN "Product" p ON p."id" = v."productId" JOIN "Category" cat ON cat."id" = p."categoryId"`,
        group: Prisma.sql`cat."id", cat."name"`,
        order: Prisma.sql`SUM(si."quantity" * si."unitPrice") DESC, 2, 1`,
      };
  }
}

/**
 * Receita e custo das vendas COMPLETED do período (dia de negócio de createdAt), agrupados.
 * Itens com unitCost NULL (vendas anteriores ao registro) não somam custo e entram em itemsWithoutCost.
 */
export class PrismaProfitReportRepository {
  async aggregate(
    from: string,
    to: string,
    view: ProfitView,
    sellerId: string | null,
    limit: number,
  ): Promise<RawProfitRow[]> {
    const g = shape(view);
    const rows = await getDb().$queryRaw<SqlRow[]>`
      SELECT ${g.key} AS "key", ${g.label} AS "label",
             COALESCE(SUM(si."quantity" * si."unitPrice" * 100), 0)::bigint::text AS "revenueCents",
             COALESCE(SUM(si."quantity" * COALESCE(si."unitCost", 0) * 10000), 0)::bigint::text AS "cost4",
             (count(*) FILTER (WHERE si."unitCost" IS NULL))::int AS "itemsWithoutCost"
      FROM "SaleItem" si
      JOIN "Sale" s ON s."id" = si."saleId"
      ${g.joins}
      WHERE ${salePeriod(from, to)}
        AND s."status"::text = 'COMPLETED'
        AND (${sellerId}::text IS NULL OR s."sellerId" = ${sellerId}::text)
      GROUP BY ${g.group}
      ORDER BY ${g.order}
      LIMIT ${limit + 1}`;
    if (rows.length > limit) throw new ExportTooLargeError();
    return rows.map((r) => ({
      key: r.key,
      label: view === "period" ? formatDateBr(r.label) : r.label,
      revenueCents: Number(r.revenueCents),
      cost4: Number(r.cost4),
      itemsWithoutCost: r.itemsWithoutCost,
    }));
  }
}
