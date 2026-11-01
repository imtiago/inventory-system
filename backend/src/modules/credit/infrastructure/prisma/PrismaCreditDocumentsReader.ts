import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { toCents } from "@shared/domain/money";
import { toDateOnly } from "@finance/domain/services/receivableStatus";
import type { CarneInput, ReceiptInput } from "@credit/domain/carneContent";
import type { CreditDocumentsReader } from "@credit/application/contracts/CreditDocumentsReader";

const cents = (value: unknown) => toCents(Number(value));
const codeOf = (id: string) => id.slice(0, 8).toUpperCase();

interface ParcelRow {
  id: string;
  amount: unknown;
  dueDate: Date;
  payments: { atCheckout: boolean }[];
}

/**
 * Parcelas do plano em ordem de vencimento. A entrada do crediário é a parcela de hoje paga `atCheckout`
 * (não entra no carnê nem na numeração); só se desconta quando a venda teve entrada.
 */
function planParcels<T extends ParcelRow>(parcels: T[], hasDownPayment: boolean): { plan: T[]; down: T | null } {
  const ordered = [...parcels].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.id.localeCompare(b.id));
  const down = hasDownPayment ? (ordered.find((p) => p.payments.some((pay) => pay.atCheckout)) ?? null) : null;
  return { plan: ordered.filter((p) => p !== down), down };
}

/** Leitura (sem trava) dos dados do carnê e do recibo; devolve o que falta para o domínio montar o conteúdo. */
export class PrismaCreditDocumentsReader implements CreditDocumentsReader {
  async carneSale(saleId: string) {
    const db = getDb();
    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        financing: true,
        items: { select: { productName: true, quantity: true }, orderBy: [{ productName: "asc" }, { id: "asc" }] },
      },
    });
    if (!sale) return null;
    const financing = sale.financing;
    if (sale.paymentCondition !== "CREDIARIO" || !financing) return { kind: "NOT_CREDIARIO" as const };
    if (sale.status === "CANCELED") return { kind: "CANCELED" as const };

    const document = await db.financialDocument.findFirst({
      where: { type: "RECEIVABLE", originType: "SALE", originId: sale.id, status: { not: "CANCELED" } },
      include: { parcels: { include: { payments: { select: { atCheckout: true } } } } },
    });
    const { plan } = planParcels(document?.parcels ?? [], cents(financing.downPayment) > 0);

    const input: Omit<CarneInput, "store"> = {
      customer: { name: sale.customer.name, document: sale.customer.document, phone: sale.customer.phone, address: sale.customer.address },
      sale: {
        code: codeOf(sale.id),
        date: toDateOnly(sale.createdAt),
        items: sale.items.map((i) => ({ name: i.productName, quantity: i.quantity })),
      },
      financing: {
        cashPriceCents: cents(financing.cashPrice),
        downPaymentCents: cents(financing.downPayment),
        downPaymentMethod: financing.downPaymentMethod,
        financedCents: cents(financing.financedAmount),
        installments: financing.installments,
        monthlyRateBps: financing.monthlyRateBps,
        surchargeCents: cents(financing.surchargeAmount),
        totalCents: cents(financing.totalAmount),
      },
      parcels: plan.map((p) => ({ dueDate: toDateOnly(p.dueDate), amountCents: cents(p.amount) })),
      // Termos contratados na venda (não os atuais das configurações).
      rules: { fineBps: financing.fineBps, monthlyInterestBps: financing.monthlyInterestBps, graceDays: financing.graceDays },
    };
    return { kind: "OK" as const, input };
  }

  async receiptPayment(paymentId: string) {
    const db = getDb();
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        createdBy: { select: { name: true } },
        parcel: { include: { document: { include: { parcels: { include: { payments: { select: { atCheckout: true } } } } } } } },
      },
    });
    if (!payment || payment.parcel.document.type !== "RECEIVABLE") return null;
    if (payment.reversedAt) return { kind: "REVERSED" as const };

    const document = payment.parcel.document;
    const customer = await db.customer.findUnique({ where: { id: document.partyId } });
    if (!customer) return null;

    const saleId = document.originType === "SALE" ? document.originId : null;
    const financing = saleId ? await db.saleFinancing.findUnique({ where: { saleId }, select: { downPayment: true } }) : null;
    const { plan, down } = planParcels(document.parcels, !!financing && cents(financing.downPayment) > 0);
    const index = plan.findIndex((p) => p.id === payment.parcelId);

    const input: Omit<ReceiptInput, "store"> = {
      customer: { name: customer.name, document: customer.document, phone: customer.phone, address: customer.address },
      payment: {
        code: codeOf(payment.id),
        paymentDate: toDateOnly(payment.paymentDate),
        method: payment.method,
        reference: payment.reference,
        parcelNumber: down && down.id === payment.parcelId ? null : index + 1,
        parcelCount: plan.length,
        dueDate: toDateOnly(payment.parcel.dueDate),
        principalCents: cents(payment.amount),
        fineCents: cents(payment.fineAmount),
        interestCents: cents(payment.interestAmount),
        waivedCents: cents(payment.waivedAmount),
        waiverReason: payment.waiverReason,
        backdateReason: payment.backdateReason,
        receivedBy: payment.createdBy?.name ?? null,
        originLabel: saleId ? `Venda #${codeOf(saleId)}` : "Conta a receber",
      },
    };
    return { kind: "OK" as const, input };
  }
}
