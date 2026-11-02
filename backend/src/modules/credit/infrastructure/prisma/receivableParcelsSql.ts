import { Prisma } from "@prisma/client";

/**
 * Parcelas de RECEIVABLE de clientes (documento filtrado por `docFilter`), com pago em centavos
 * (pagamentos ativos) e data de quitação (último pagamento ativo). Base comum de exposição e histórico.
 * Colunas: cid, id, due (date), amount_c, paid_c, remaining_c, last_paid (date|null),
 * counts_as_late (a parcela pode contar como atraso: `countsAsLate`) e is_notebook (dívida do caderninho).
 */
export function receivableParcelsCte(customerFilter: Prisma.Sql, docFilter: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT fd."partyId" AS cid, fp.id, fp."dueDate"::date AS due,
           (fp.amount * 100)::bigint AS amount_c,
           COALESCE(pay.paid_c, 0)::bigint AS paid_c,
           GREATEST((fp.amount * 100)::bigint - COALESCE(pay.paid_c, 0), 0)::bigint AS remaining_c,
           pay.last_paid,
           ${countsAsLate()} AS counts_as_late,
           ${notebookDebt("fd")} AS is_notebook
    FROM "FinancialDocument" fd
    JOIN "FinancialParcel" fp ON fp."financialDocumentId" = fd.id
    LEFT JOIN LATERAL (
      SELECT (SUM(p.amount) * 100)::bigint AS paid_c, MAX(p."paymentDate"::date) AS last_paid
      FROM "Payment" p
      WHERE p."parcelId" = fp.id AND p."reversedAt" IS NULL
    ) pay ON TRUE
    WHERE fd.type = 'RECEIVABLE' AND fd."partyType" = 'CUSTOMER' AND ${customerFilter} AND ${docFilter}`;
}

/** Dívida do caderninho: origem LEGACY com `noLateFees`. `alias` = alias do documento na consulta. */
function notebookDebt(alias: string): Prisma.Sql {
  const doc = Prisma.raw(alias);
  return Prisma.sql`(${doc}."noLateFees" AND ${doc}."originType" = 'LEGACY')`;
}

/**
 * Documentos que valem para pontuação/histórico: não cancelados e fora do caderninho. Dívida do caderninho
 * (origem LEGACY com `noLateFees`) nunca conta como atraso nem mexe em perfil/pontuação (spec §10).
 * `alias` é o alias do documento (`FinancialDocument`) na consulta.
 */
export function countsTowardCreditHistory(alias = "fd"): Prisma.Sql {
  const doc = Prisma.raw(alias);
  return Prisma.sql`(${doc}.status <> 'CANCELED' AND NOT ${notebookDebt(alias)})`;
}

/**
 * Parcela que pode contar como atraso (bloqueio do crediário, situação da ficha): nem "a combinar"
 * (`dueDateUnknown`) nem dívida do caderninho — essas contam só no saldo/limite (decisão de 2026-10-26).
 * `fd` = documento, `fp` = parcela na consulta.
 */
export function countsAsLate(): Prisma.Sql {
  return Prisma.sql`(NOT fp."dueDateUnknown" AND NOT ${notebookDebt("fd")})`;
}

/**
 * Histórico de crédito = só parcelas do crediário (decisão do dono, 2026-11-01): documento de venda com
 * `SaleFinancing` que vale para pontuação (`countsTowardCreditHistory`), sem a parcela paga no fechamento
 * (a entrada). Vendas à vista/PIX/cartão (documento pago `atCheckout`) e contas avulsas nunca contam.
 * `fd` = documento, `fp` = parcela na consulta.
 */
export function crediarioInstallmentForHistory(): Prisma.Sql {
  return Prisma.sql`(${countsTowardCreditHistory()}
    AND fd."originType" = 'SALE'
    AND EXISTS (SELECT 1 FROM "SaleFinancing" sf WHERE sf."saleId" = fd."originId")
    AND NOT EXISTS (SELECT 1 FROM "Payment" pc WHERE pc."parcelId" = fp.id AND pc."atCheckout"))`;
}
