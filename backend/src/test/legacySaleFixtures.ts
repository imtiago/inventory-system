import { prisma } from "@shared/prisma";
import { buildInstallments } from "@shared/domain/installments";
import { businessTodayAsUtcDate } from "@shared/domain/businessDate";

/**
 * O parcelado antigo (`paymentTerms`, sem crediário) saiu da API na Task 9, mas as vendas
 * `LEGACY_INSTALLMENTS` continuam no banco com parcelas em aberto. Para testar pagamento,
 * estorno e cancelamento dessas vendas: crie a venda à vista pela API (estoque de verdade) e
 * converta o financeiro dela no formato antigo (parcelas em aberto, sem pagamento no ato).
 */
export async function convertToLegacyInstallments(
  saleId: string,
  installments = 1,
  firstDueDate?: string,
): Promise<{ documentId: string; parcelIds: string[] }> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
    const doc = await tx.financialDocument.findFirstOrThrow({
      where: { originId: saleId, type: "RECEIVABLE", status: { not: "CANCELED" } },
      include: { parcels: true },
    });
    const parcelIds = doc.parcels.map((p) => p.id);
    await tx.payment.deleteMany({ where: { parcelId: { in: parcelIds } } });
    await tx.financialParcel.deleteMany({ where: { id: { in: parcelIds } } });

    const first = firstDueDate ? new Date(`${firstDueDate}T00:00:00.000Z`) : businessTodayAsUtcDate();
    const plan = buildInstallments(Math.round(Number(sale.totalAmount) * 100), installments, first);
    const created = [];
    for (const parcel of plan) {
      created.push(
        await tx.financialParcel.create({
          data: { financialDocumentId: doc.id, amount: parcel.amountCents / 100, dueDate: parcel.dueDate },
        }),
      );
    }
    await tx.financialDocument.update({ where: { id: doc.id }, data: { status: "OPEN" } });
    await tx.sale.update({
      where: { id: saleId },
      data: { paymentCondition: "LEGACY_INSTALLMENTS", cardFeePassedOn: false, cardInstallments: null, cardFeeBps: null },
    });
    return { documentId: doc.id, parcelIds: created.map((p) => p.id) };
  });
}
