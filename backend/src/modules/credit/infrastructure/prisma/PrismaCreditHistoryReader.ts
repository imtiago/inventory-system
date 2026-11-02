import { Prisma } from "@prisma/client";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditHistory } from "@credit/domain/creditScore";
import type { CreditHistoryReader } from "@credit/application/contracts/CreditHistoryReader";
import type { CreditSettingsReader } from "@credit/application/contracts/CreditSettingsReader";
import { crediarioInstallmentForHistory, receivableParcelsCte } from "./receivableParcelsSql";

type Row = {
  id: string;
  months: number;
  paid_installments: number;
  paid_on_time: number;
  paid_late30: number;
  total_days_late: number;
  max_paid_late: number;
  current_overdue: number;
  total_paid_c: bigint;
};

/**
 * Só parcelas do crediário (`crediarioInstallmentForHistory`: sem vendas pagas no ato nem a entrada).
 * Janela `[today − months, today]`. Uma única classificação por parcela alimenta `paidInstallments`
 * e `paidOnTime` (mesma janela: quitação dentro dela). Dias de atraso = quitação − vencimento;
 * em dia = atraso ≤ carência; `totalDaysLate` soma só as atrasadas (além da carência);
 * `maxDaysLateInPeriod` = maior entre os atrasos das quitadas no período e das vencidas em aberto.
 * Parcela "a combinar" nunca tem atraso (`counts_as_late`).
 */
export class PrismaCreditHistoryReader implements CreditHistoryReader {
  constructor(private readonly settings: CreditSettingsReader) {}

  async forCustomers(customerIds: string[], today: string, months: number): Promise<Map<string, CreditHistory>> {
    const ids = [...new Set(customerIds)];
    if (ids.length === 0) return new Map();
    const { rules } = await this.settings.get();
    const grace = rules.graceDays;
    const idList = Prisma.join(ids);
    const parcels = receivableParcelsCte(Prisma.sql`fd."partyId" IN (${idList})`, crediarioInstallmentForHistory());

    const rows = await getDb().$queryRaw<Row[]>`
      WITH win AS (
        SELECT ${today}::date AS today, (${today}::date - make_interval(months => ${months}::int))::date AS start
      ),
      cust AS (
        SELECT c.id, (c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date AS since
        FROM "Customer" c WHERE c.id IN (${idList})
      ),
      parcel AS (${parcels}),
      classified AS (
        SELECT pa.cid, pa.due, pa.remaining_c, pa.counts_as_late,
               (pa.remaining_c = 0 AND pa.last_paid IS NOT NULL AND pa.last_paid BETWEEN win.start AND win.today) AS paid_in_period,
               CASE WHEN pa.counts_as_late THEN GREATEST(pa.last_paid - pa.due, 0) ELSE 0 END AS days_late
        FROM parcel pa CROSS JOIN win
      ),
      paid_window AS (
        SELECT fd."partyId" AS cid, (SUM(p.amount) * 100)::bigint AS total_c
        FROM "Payment" p
        JOIN "FinancialParcel" fp ON fp.id = p."parcelId"
        JOIN "FinancialDocument" fd ON fd.id = fp."financialDocumentId"
        CROSS JOIN win
        WHERE fd.type = 'RECEIVABLE' AND fd."partyType" = 'CUSTOMER' AND fd."partyId" IN (${idList})
          AND ${crediarioInstallmentForHistory()} AND p."reversedAt" IS NULL AND NOT p."atCheckout"
          AND p."paymentDate"::date BETWEEN win.start AND win.today
        GROUP BY fd."partyId"
      )
      SELECT cust.id,
             GREATEST(EXTRACT(YEAR FROM age(win.today, cust.since)) * 12 + EXTRACT(MONTH FROM age(win.today, cust.since)), 0)::int AS months,
             COUNT(cl.cid) FILTER (WHERE cl.paid_in_period)::int AS paid_installments,
             COUNT(cl.cid) FILTER (WHERE cl.paid_in_period AND cl.days_late <= ${grace}::int)::int AS paid_on_time,
             COUNT(cl.cid) FILTER (WHERE cl.paid_in_period AND cl.days_late > 30)::int AS paid_late30,
             COALESCE(SUM(cl.days_late) FILTER (WHERE cl.paid_in_period AND cl.days_late > ${grace}::int), 0)::int AS total_days_late,
             COALESCE(MAX(cl.days_late) FILTER (WHERE cl.paid_in_period), 0)::int AS max_paid_late,
             COALESCE(MAX(win.today - cl.due) FILTER (WHERE cl.remaining_c > 0 AND cl.due < win.today AND cl.counts_as_late), 0)::int AS current_overdue,
             COALESCE(MAX(pw.total_c), 0)::bigint AS total_paid_c
      FROM cust
      CROSS JOIN win
      LEFT JOIN classified cl ON cl.cid = cust.id
      LEFT JOIN paid_window pw ON pw.cid = cust.id
      GROUP BY cust.id, cust.since, win.today`;

    const out = new Map<string, CreditHistory>();
    for (const r of rows) {
      out.set(r.id, {
        paidInstallments: r.paid_installments,
        paidOnTime: r.paid_on_time,
        paidLate30Plus: r.paid_late30,
        totalDaysLate: r.total_days_late,
        relationshipMonths: r.months,
        totalPaidCents: Number(r.total_paid_c),
        renegotiations: 0,
        maxDaysLateInPeriod: Math.max(r.max_paid_late, r.current_overdue),
        currentMaxOverdueDays: r.current_overdue,
      });
    }
    return out;
  }
}
