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
  surcharge: string;
  paymentCondition: string;
  cardInstallments: number | null;
  crediarioInstallments: number | null;
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
  surchargeCents: number;
  paymentCondition: string;
  cardInstallments: number | null;
  crediarioInstallments: number | null;
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
export const SALE_DAY = Prisma.sql`to_char((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`;

/** Intervalo de dias de negócio [from, to] como limites UTC (sargável em createdAt). */
export const salePeriod = (from: string, to: string) => Prisma.sql`
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
             s."totalAmount"::text AS "total", s."surchargeAmount"::text AS "surcharge",
             s."paymentCondition"::text AS "paymentCondition", s."cardInstallments",
             sf."installments" AS "crediarioInstallments"
      FROM "Sale" s
      JOIN "Customer" c ON c."id" = s."customerId"
      LEFT JOIN "SaleFinancing" sf ON sf."saleId" = s."id"
      WHERE ${salePeriod(from, to)}
        AND (${status}::text IS NULL OR s."status"::text = ${status}::text)
      ORDER BY s."createdAt", s."id"
      LIMIT ${limit + 1}`;
    return guard(rows, limit);
  }

  async saleItems(from: string, to: string, limit: number): Promise<SaleItemReportRow[]> {
    // Rateio do acréscimo da venda: cada linha leva floor(acréscimo × linha / itens); a última
    // linha (maior id) fica com o resto, então a soma das linhas fecha com a venda.
    const rows = await getDb().$queryRaw<(Omit<SaleItemReportRow, "surchargeCents"> & { surchargeCents: bigint })[]>`
      SELECT "saleId", "day", "customerName", "productName", "variantName", "code", "quantity", "unitPrice", "total",
             "paymentCondition", "cardInstallments", "crediarioInstallments",
             (CASE WHEN "lastRow" THEN "saleSurcharge" - ("shareSum" - "share") ELSE "share" END)::bigint AS "surchargeCents"
      FROM (
        SELECT *,
               SUM("share") OVER (PARTITION BY "saleId") AS "shareSum",
               ROW_NUMBER() OVER (PARTITION BY "saleId" ORDER BY "itemId" DESC) = 1 AS "lastRow"
        FROM (
          SELECT s."id" AS "saleId", si."id" AS "itemId", s."createdAt" AS "saleAt", ${SALE_DAY} AS "day", c."name" AS "customerName",
                 p."name" AS "productName", si."productName" AS "variantName", COALESCE(si."sku", v."code") AS "code",
                 si."quantity", si."unitPrice"::text AS "unitPrice", (si."quantity" * si."unitPrice")::text AS "total",
                 s."paymentCondition"::text AS "paymentCondition", s."cardInstallments",
                 sf."installments" AS "crediarioInstallments",
                 round(s."surchargeAmount" * 100) AS "saleSurcharge",
                 CASE WHEN SUM(si."quantity" * si."unitPrice") OVER (PARTITION BY s."id") > 0
                      THEN floor(round(s."surchargeAmount" * 100) * si."quantity" * si."unitPrice"
                                 / SUM(si."quantity" * si."unitPrice") OVER (PARTITION BY s."id"))
                      ELSE 0 END AS "share"
          FROM "SaleItem" si
          JOIN "Sale" s ON s."id" = si."saleId"
          JOIN "Customer" c ON c."id" = s."customerId"
          JOIN "ProductVariant" v ON v."id" = si."productVariantId"
          JOIN "Product" p ON p."id" = v."productId"
          LEFT JOIN "SaleFinancing" sf ON sf."saleId" = s."id"
          WHERE ${salePeriod(from, to)}
            AND s."status"::text <> 'CANCELED'
        ) base
      ) shares
      ORDER BY "saleAt", "saleId", "itemId"
      LIMIT ${limit + 1}`;
    return guard(rows, limit).map((r) => ({ ...r, surchargeCents: Number(r.surchargeCents) }));
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
