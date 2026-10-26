import { Prisma } from "@prisma/client";
import { readTogether } from "@shared/infrastructure/database/readTogether";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { DashboardReadRepository } from "../../../application/contracts/DashboardReadRepository";
import {
  ExpiringLotDTO,
  FinancialSectionDTO,
  InventorySectionDTO,
  OutOfStockItemDTO,
  PurchasesSectionDTO,
  SalesSectionDTO,
  TopVariantDTO,
} from "../../../application/dto/DashboardDTO";

/**
 * Timestamps são gravados como `timestamp` sem fuso, em UTC: converte para o fuso de
 * negócio antes de truncar para a data. Datas sem hora (vencimento, validade) ficam à
 * meia-noite UTC e viram data direto. Somas em numeric no banco; `::text` evita float.
 */
const businessDay = Prisma.sql`("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date`;

const money = (value: string | null): number => Math.round(Number(value ?? 0) * 100) / 100;

interface SalesSummaryRow {
  today_count: number;
  today_total: string;
  month_count: number;
  month_total: string;
}
interface Last7Row {
  date: string;
  count: number;
  total: string;
}
interface TopRow {
  productVariantId: string;
  label: string;
  quantity: bigint;
  total: string;
}
interface FinancialRow {
  open: string;
  overdue: string;
  next_count: number;
  next_amount: string;
}
interface OutOfStockRow {
  productVariantId: string;
  label: string;
  quantity: number;
  total: number;
}
interface ExpiringRow {
  lotId: string;
  batchNumber: string | null;
  label: string;
  expirationDate: string;
  remainingQuantity: number;
  total: number;
}
interface PurchasesRow {
  count: number;
  total: string;
}

export class PrismaDashboardReadRepository implements DashboardReadRepository {
  async sales(today: string): Promise<SalesSectionDTO> {
    const db = getDb();
    const [summary, last7, top] = await readTogether([
      db.$queryRaw<SalesSummaryRow[]>`
        SELECT
          (COUNT(*) FILTER (WHERE d = ${today}::date))::int AS today_count,
          COALESCE(SUM("totalAmount") FILTER (WHERE d = ${today}::date), 0)::text AS today_total,
          COUNT(*)::int AS month_count,
          COALESCE(SUM("totalAmount"), 0)::text AS month_total
        FROM (
          SELECT "totalAmount", ${businessDay} AS d
          FROM "Sale"
          WHERE status <> 'CANCELED'
            AND "createdAt" >= (date_trunc('month', ${today}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC'
        ) s
        WHERE d >= date_trunc('month', ${today}::date)::date AND d <= ${today}::date`,
      db.$queryRaw<Last7Row[]>`
        SELECT to_char(g.day, 'YYYY-MM-DD') AS date,
               COALESCE(a.count, 0)::int AS count,
               COALESCE(a.total, 0)::text AS total
        FROM generate_series(${today}::date - 6, ${today}::date, interval '1 day') AS g(day)
        LEFT JOIN (
          SELECT d, COUNT(*) AS count, SUM("totalAmount") AS total
          FROM (
            SELECT "totalAmount", ${businessDay} AS d
            FROM "Sale"
            WHERE status <> 'CANCELED'
              AND "createdAt" >= ((${today}::date - 6)::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC'
          ) s
          GROUP BY d
        ) a ON a.d = g.day::date
        ORDER BY g.day`,
      db.$queryRaw<TopRow[]>`
        SELECT v.id AS "productVariantId",
               p.name || ' — ' || v.name AS label,
               SUM(si.quantity)::bigint AS quantity,
               SUM(si.quantity * si."unitPrice")::text AS total
        FROM "SaleItem" si
        JOIN "Sale" s ON s.id = si."saleId"
        JOIN "ProductVariant" v ON v.id = si."productVariantId"
        JOIN "Product" p ON p.id = v."productId"
        WHERE s.status <> 'CANCELED'
          AND s."createdAt" >= (date_trunc('month', ${today}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC'
          AND (s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date <= ${today}::date
        GROUP BY v.id, p.name, v.name
        ORDER BY SUM(si.quantity) DESC, SUM(si.quantity * si."unitPrice") DESC, v.id
        LIMIT 5`,
    ]);
    const s = summary[0];
    return {
      today: { count: s.today_count, total: money(s.today_total) },
      month: { count: s.month_count, total: money(s.month_total) },
      last7Days: last7.map((r) => ({ date: r.date, count: r.count, total: money(r.total) })),
      topVariants: top.map(
        (r): TopVariantDTO => ({
          productVariantId: r.productVariantId,
          label: r.label,
          quantity: Number(r.quantity),
          total: money(r.total),
        }),
      ),
    };
  }

  receivables(today: string): Promise<FinancialSectionDTO> {
    return this.financial("RECEIVABLE", today);
  }

  payables(today: string): Promise<FinancialSectionDTO> {
    return this.financial("PAYABLE", today);
  }

  /**
   * Restante da parcela = valor − pagamentos não estornados. Só documentos em aberto
   * (OPEN/PARTIALLY_PAID): cancelados não contam e quitados têm restante 0. Os pagamentos
   * são somados por parcela (Payment_parcelId_idx), sem agregar a tabela Payment inteira.
   */
  private async financial(type: "RECEIVABLE" | "PAYABLE", today: string): Promise<FinancialSectionDTO> {
    const [row] = await getDb().$queryRaw<FinancialRow[]>`
      SELECT
        COALESCE(SUM(remaining) FILTER (WHERE remaining > 0), 0)::text AS open,
        COALESCE(SUM(remaining) FILTER (WHERE remaining > 0 AND due < ${today}::date), 0)::text AS overdue,
        (COUNT(*) FILTER (WHERE remaining > 0 AND due >= ${today}::date AND due <= ${today}::date + 7))::int AS next_count,
        COALESCE(SUM(remaining) FILTER (WHERE remaining > 0 AND due >= ${today}::date AND due <= ${today}::date + 7), 0)::text AS next_amount
      FROM (
        SELECT fp."dueDate"::date AS due,
               fp.amount - COALESCE(pay.paid, 0) AS remaining
        FROM "FinancialParcel" fp
        JOIN "FinancialDocument" fd ON fd.id = fp."financialDocumentId"
        LEFT JOIN LATERAL (
          SELECT SUM(py."amount") AS paid
          FROM "Payment" py
          WHERE py."parcelId" = fp.id AND py."reversedAt" IS NULL
        ) pay ON TRUE
        WHERE fd.type = ${type}::"FinancialType" AND fd.status IN ('OPEN', 'PARTIALLY_PAID')
      ) p`;
    return {
      open: money(row.open),
      overdue: money(row.overdue),
      dueNext7Days: { count: row.next_count, amount: money(row.next_amount) },
    };
  }

  async inventory(today: string): Promise<InventorySectionDTO> {
    const db = getDb();
    const [out, lots] = await readTogether([
      db.$queryRaw<OutOfStockRow[]>`
        SELECT v.id AS "productVariantId", p.name || ' — ' || v.name AS label,
               i.quantity, (COUNT(*) OVER())::int AS total
        FROM "Inventory" i
        JOIN "ProductVariant" v ON v.id = i."productVariantId"
        JOIN "Product" p ON p.id = v."productId"
        WHERE i.quantity <= 0
        ORDER BY i.quantity ASC, label ASC, v.id
        LIMIT 10`,
      db.$queryRaw<ExpiringRow[]>`
        SELECT l.id AS "lotId", l."batchNumber", p.name || ' — ' || v.name AS label,
               to_char(l."expirationDate"::date, 'YYYY-MM-DD') AS "expirationDate",
               l."remainingQuantity", (COUNT(*) OVER())::int AS total
        FROM "InventoryLot" l
        JOIN "ProductVariant" v ON v.id = l."productVariantId"
        JOIN "Product" p ON p.id = v."productId"
        WHERE l."remainingQuantity" > 0
          AND l."expirationDate"::date >= ${today}::date
          AND l."expirationDate"::date <= ${today}::date + 30
        ORDER BY l."expirationDate" ASC, l."batchNumber" ASC, l.id
        LIMIT 5`,
    ]);
    return {
      outOfStockCount: out[0]?.total ?? 0,
      outOfStock: out.map(
        (r): OutOfStockItemDTO => ({ productVariantId: r.productVariantId, label: r.label, quantity: r.quantity }),
      ),
      expiringLots: {
        count: lots[0]?.total ?? 0,
        items: lots.map(
          (r): ExpiringLotDTO => ({
            lotId: r.lotId,
            batchNumber: r.batchNumber,
            label: r.label,
            expirationDate: r.expirationDate,
            remainingQuantity: r.remainingQuantity,
          }),
        ),
      },
    };
  }

  async purchases(): Promise<PurchasesSectionDTO> {
    const [row] = await getDb().$queryRaw<PurchasesRow[]>`
      SELECT COUNT(*)::int AS count, COALESCE(SUM("totalAmount"), 0)::text AS total
      FROM "Purchase"
      WHERE status IN ('PENDING', 'PARTIALLY_RECEIVED')`;
    return { awaitingReceipt: { count: row.count, total: money(row.total) } };
  }
}
