import { Prisma } from "@prisma/client";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { ExportTooLargeError } from "@shared/domain/errors";

export interface SaleReportRow {
  id: string;
  day: string;
  customerName: string;
  status: string;
  itemsCount: number;
  total: string;
}

export interface SaleItemReportRow {
  saleId: string;
  day: string;
  customerName: string;
  productName: string;
  variantName: string;
  code: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface StockReportRow {
  productName: string;
  variantName: string;
  code: string;
  barcode: string | null;
  quantity: number;
  reserved: number;
  averageCost: string;
  stockValue: string;
}

const TZ = "America/Sao_Paulo";
// Dia de negócio (BRT) de um instante gravado em UTC (timestamp sem fuso).
const SALE_DAY = Prisma.sql`to_char((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`;

/** Intervalo de dias de negócio [from, to] como limites UTC (sargável em createdAt). */
const salePeriod = (from: string, to: string) => Prisma.sql`
  s."createdAt" >= ((${from}::date)::timestamp AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC'
  AND s."createdAt" < (((${to}::date + 1))::timestamp AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC'`;

function guard<T>(rows: T[], limit: number): T[] {
  if (rows.length > limit) throw new ExportTooLargeError();
  return rows;
}

/** Leituras em SQL dos relatórios CSV; cada consulta traz no máximo `limit + 1` linhas. */
export class PrismaReportReadRepository {
  async sales(from: string, to: string, status: string | null, limit: number): Promise<SaleReportRow[]> {
    const rows = await getDb().$queryRaw<SaleReportRow[]>`
      SELECT s."id", ${SALE_DAY} AS "day", c."name" AS "customerName", s."status"::text AS "status",
             (SELECT count(*) FROM "SaleItem" si WHERE si."saleId" = s."id")::int AS "itemsCount",
             s."totalAmount"::text AS "total"
      FROM "Sale" s
      JOIN "Customer" c ON c."id" = s."customerId"
      WHERE ${salePeriod(from, to)}
        AND (${status}::text IS NULL OR s."status"::text = ${status}::text)
      ORDER BY s."createdAt", s."id"
      LIMIT ${limit + 1}`;
    return guard(rows, limit);
  }

  async saleItems(from: string, to: string, limit: number): Promise<SaleItemReportRow[]> {
    const rows = await getDb().$queryRaw<SaleItemReportRow[]>`
      SELECT s."id" AS "saleId", ${SALE_DAY} AS "day", c."name" AS "customerName",
             p."name" AS "productName", si."productName" AS "variantName", COALESCE(si."sku", v."code") AS "code",
             si."quantity", si."unitPrice"::text AS "unitPrice", (si."quantity" * si."unitPrice")::text AS "total"
      FROM "SaleItem" si
      JOIN "Sale" s ON s."id" = si."saleId"
      JOIN "Customer" c ON c."id" = s."customerId"
      JOIN "ProductVariant" v ON v."id" = si."productVariantId"
      JOIN "Product" p ON p."id" = v."productId"
      WHERE ${salePeriod(from, to)}
        AND s."status"::text <> 'CANCELED'
      ORDER BY s."createdAt", s."id", si."id"
      LIMIT ${limit + 1}`;
    return guard(rows, limit);
  }

  async stock(limit: number): Promise<StockReportRow[]> {
    const rows = await getDb().$queryRaw<StockReportRow[]>`
      SELECT p."name" AS "productName", v."name" AS "variantName", v."code", v."barcode",
             i."quantity", i."reservedQuantity" AS "reserved",
             round(i."averageCost", 2)::text AS "averageCost",
             round(i."quantity" * i."averageCost", 2)::text AS "stockValue"
      FROM "Inventory" i
      JOIN "ProductVariant" v ON v."id" = i."productVariantId"
      JOIN "Product" p ON p."id" = v."productId"
      ORDER BY p."name", v."name", v."id"
      LIMIT ${limit + 1}`;
    return guard(rows, limit);
  }
}
