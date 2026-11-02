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
  cardFeeCents: string;
  itemsWithoutCost: number;
}

const DAY_BR = Prisma.sql`to_char((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')`;

/** Chave, rótulo, junções, agrupamento (por linha) e ordem (sobre os agregados `x`) de cada visão. */
function shape(view: ProfitView) {
  const byRevenue = Prisma.sql`SUM(x."revenueCents") DESC, 2, 1`;
  switch (view) {
    case "period":
      return { key: SALE_DAY, label: SALE_DAY, joins: Prisma.empty, group: Prisma.sql`${SALE_DAY}`, order: Prisma.sql`1` };
    case "sale":
      return {
        key: Prisma.sql`s."id"`,
        label: Prisma.sql`c."name" || ' · ' || ${DAY_BR}`,
        joins: Prisma.sql`JOIN "Customer" c ON c."id" = s."customerId"`,
        group: Prisma.sql`s."createdAt", c."name"`,
        order: Prisma.sql`MIN(x."saleAt"), 1`,
      };
    case "variant":
      return {
        key: Prisma.sql`v."id"`,
        label: Prisma.sql`p."name" || ' — ' || v."name"`,
        joins: Prisma.sql`JOIN "ProductVariant" v ON v."id" = si."productVariantId" JOIN "Product" p ON p."id" = v."productId"`,
        group: Prisma.sql`v."id", p."name", v."name"`,
        order: byRevenue,
      };
    case "category":
      return {
        key: Prisma.sql`cat."id"`,
        label: Prisma.sql`cat."name"`,
        joins: Prisma.sql`JOIN "ProductVariant" v ON v."id" = si."productVariantId" JOIN "Product" p ON p."id" = v."productId" JOIN "Category" cat ON cat."id" = p."categoryId"`,
        group: Prisma.sql`cat."id", cat."name"`,
        order: byRevenue,
      };
  }
}

/**
 * Receita e custo das vendas COMPLETED do período (dia de negócio de createdAt), agrupados.
 * Receita = itens (quantidade × preço): o acréscimo cobrado do cliente (repasse da taxa do
 * cartão, juros do crediário — `Sale.surchargeAmount`) não é receita de venda.
 * Taxa de cartão: despesa só quando a loja absorveu (taxa gravada e nenhum acréscimo cobrado);
 * calculada por venda dentro de cada linha (meio para cima, como `applyBps`). Por isso, nas
 * visões por produto/categoria, uma venda dividida em várias linhas pode somar ±1 centavo.
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
      SELECT x."key", x."label",
             COALESCE(SUM(x."revenueCents"), 0)::bigint::text AS "revenueCents",
             COALESCE(SUM(x."cost4"), 0)::bigint::text AS "cost4",
             COALESCE(SUM(
               CASE WHEN x."cardFeeBps" IS NOT NULL AND x."surchargeAmount" = 0
                    THEN floor((x."revenueCents" * x."cardFeeBps" + 5000) / 10000)
                    ELSE 0 END
             ), 0)::bigint::text AS "cardFeeCents",
             SUM(x."itemsWithoutCost")::int AS "itemsWithoutCost"
      FROM (
        SELECT ${g.key} AS "key", ${g.label} AS "label", MIN(s."createdAt") AS "saleAt",
               s."cardFeeBps", s."surchargeAmount",
               SUM(si."quantity" * si."unitPrice" * 100) AS "revenueCents",
               SUM(si."quantity" * COALESCE(si."unitCost", 0) * 10000) AS "cost4",
               (count(*) FILTER (WHERE si."unitCost" IS NULL))::int AS "itemsWithoutCost"
        FROM "SaleItem" si
        JOIN "Sale" s ON s."id" = si."saleId"
        ${g.joins}
        WHERE ${salePeriod(from, to)}
          AND s."status"::text = 'COMPLETED'
          AND (${sellerId}::text IS NULL OR s."sellerId" = ${sellerId}::text)
        GROUP BY ${g.group}, s."id", s."cardFeeBps", s."surchargeAmount"
      ) x
      GROUP BY x."key", x."label"
      ORDER BY ${g.order}
      LIMIT ${limit + 1}`;
    if (rows.length > limit) throw new ExportTooLargeError();
    return rows.map((r) => ({
      key: r.key,
      label: view === "period" ? formatDateBr(r.label) : r.label,
      revenueCents: Number(r.revenueCents),
      cost4: Number(r.cost4),
      cardFeeCents: Number(r.cardFeeCents),
      itemsWithoutCost: r.itemsWithoutCost,
    }));
  }
}
