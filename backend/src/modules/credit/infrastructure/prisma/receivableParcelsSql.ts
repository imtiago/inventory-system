import { Prisma } from "@prisma/client";

/**
 * Parcelas de RECEIVABLE de clientes (documento filtrado por `docFilter`), com pago em centavos
 * (pagamentos ativos) e data de quitação (último pagamento ativo). Base comum de exposição e histórico.
 * Colunas: cid, id, due (date), amount_c, paid_c, remaining_c, last_paid (date|null).
 */
export function receivableParcelsCte(customerFilter: Prisma.Sql, docFilter: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT fd."partyId" AS cid, fp.id, fp."dueDate"::date AS due,
           (fp.amount * 100)::bigint AS amount_c,
           COALESCE(pay.paid_c, 0)::bigint AS paid_c,
           GREATEST((fp.amount * 100)::bigint - COALESCE(pay.paid_c, 0), 0)::bigint AS remaining_c,
           pay.last_paid
    FROM "FinancialDocument" fd
    JOIN "FinancialParcel" fp ON fp."financialDocumentId" = fd.id
    LEFT JOIN LATERAL (
      SELECT (SUM(p.amount) * 100)::bigint AS paid_c, MAX(p."paymentDate"::date) AS last_paid
      FROM "Payment" p
      WHERE p."parcelId" = fp.id AND p."reversedAt" IS NULL
    ) pay ON TRUE
    WHERE fd.type = 'RECEIVABLE' AND fd."partyType" = 'CUSTOMER' AND ${customerFilter} AND ${docFilter}`;
}
