import type { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";
import { DEFAULT_CREDIT_RULES } from "@credit/domain/creditRules";
import { DEFAULT_CREDIT_PROFILES } from "@credit/domain/CreditProfileCode";

/** Volta configurações e perfis de crédito aos valores iniciais (segure `acquireCreditTestLock()`). */
export async function resetCreditDefaults(): Promise<void> {
  await prisma.creditSettings.update({
    where: { id: "default" },
    data: {
      crediarioEnabled: false,
      rules: DEFAULT_CREDIT_RULES as unknown as Prisma.InputJsonValue,
      enabledAt: null,
      enabledById: null,
      updatedById: null,
    },
  });
  for (const p of DEFAULT_CREDIT_PROFILES) {
    await prisma.creditProfile.update({
      where: { code: p.code },
      data: {
        name: p.name,
        initialLimit: p.initialLimitCents / 100,
        minDownPaymentBps: p.minDownPaymentBps,
        maxInstallments: p.maxInstallments,
      },
    });
  }
}

/**
 * Venda no crediário só para montar histórico de crédito (sem itens nem estoque): grava `Sale` +
 * `SaleFinancing`. Use o id como `originId` (originType SALE) do documento a receber. Apague com
 * `deleteCustomerSales` (depois dos documentos, antes do cliente).
 */
export async function createCrediarioSaleOrigin(customerId: string): Promise<string> {
  const sale = await prisma.sale.create({
    data: { customerId, status: "COMPLETED", paymentCondition: "CREDIARIO", totalAmount: 100 },
  });
  await prisma.saleFinancing.create({
    data: {
      saleId: sale.id,
      cashPrice: 100,
      downPayment: 0,
      financedAmount: 100,
      installments: 1,
      monthlyRateBps: 0,
      surchargeAmount: 0,
      totalAmount: 100,
      firstDueDate: new Date(),
    },
  });
  return sale.id;
}

/** Venda à vista (sem itens) do cliente, para o documento PAID com pagamento `atCheckout` do fechamento. */
export async function createCashSaleOrigin(customerId: string): Promise<string> {
  const sale = await prisma.sale.create({
    data: { customerId, status: "COMPLETED", paymentCondition: "CASH", totalAmount: 100 },
  });
  return sale.id;
}

/** Apaga as vendas dos clientes (o `SaleFinancing` sai em cascata). */
export async function deleteCustomerSales(customerIds: string[]): Promise<void> {
  const sales = await prisma.sale.findMany({ where: { customerId: { in: customerIds } }, select: { id: true } });
  const saleIds = sales.map((s) => s.id);
  await prisma.saleCancelRequest.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
}
