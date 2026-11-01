import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import {
  createCashSaleOrigin,
  createCrediarioSaleOrigin,
  deleteCustomerSales,
  resetCreditDefaults,
} from "../../../../../test/creditFixtures";
import { PrismaCreditHistoryReader } from "@credit/infrastructure/prisma/PrismaCreditHistoryReader";
import { PrismaCreditExposureReader } from "@credit/infrastructure/prisma/PrismaCreditExposureReader";
import { countsTowardCreditHistory } from "@credit/infrastructure/prisma/receivableParcelsSql";
import { PrismaCreditSettingsRepository } from "@credit/infrastructure/prisma/PrismaCreditSettingsRepository";

const DAY = 86_400_000;
const today = todayInBusinessTz();
const at = (days: number) => new Date(Date.parse(`${today}T00:00:00.000Z`) + days * DAY);

describe("PrismaCreditHistoryReader (janela de 12 meses)", () => {
  const customerIds: string[] = [];
  let releaseLock: () => Promise<void>;

  async function customer(monthsAgo: number): Promise<string> {
    const id = randomUUID();
    // 15h UTC = meio-dia em São Paulo: a data de negócio é a mesma.
    await prisma.$executeRaw`
      INSERT INTO "Customer" (id, name, code, "createdAt")
      VALUES (${id}, ${`tx-test-${id}`}, ${`TX${id.slice(0, 12)}`},
              ((${today}::date - make_interval(months => ${monthsAgo}::int))::timestamp + interval '15 hours'))`;
    customerIds.push(id);
    return id;
  }

  type Origin = "CREDIARIO" | "CASH_SALE" | "MANUAL";

  /**
   * Parcelas de um documento RECEIVABLE; `payments` = [dias relativos a hoje, valor, estornado?, atCheckout?].
   * Origem padrão: venda no crediário (só ela conta no histórico).
   */
  async function receivable(
    customerId: string,
    parcels: { amount: number; due: number; payments?: [number, number, boolean?, boolean?][] }[],
    status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELED" = "PARTIALLY_PAID",
    origin: Origin = "CREDIARIO",
  ) {
    const originId =
      origin === "CREDIARIO"
        ? await createCrediarioSaleOrigin(customerId)
        : origin === "CASH_SALE"
          ? await createCashSaleOrigin(customerId)
          : randomUUID();
    const doc = await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: origin === "MANUAL" ? "MANUAL" : "SALE",
        originId,
        partyId: customerId,
        partyType: "CUSTOMER",
        status,
      },
    });
    for (const p of parcels) {
      const parcel = await prisma.financialParcel.create({
        data: { financialDocumentId: doc.id, amount: p.amount, dueDate: at(p.due) },
      });
      for (const [day, amount, reversed, atCheckout] of p.payments ?? []) {
        await prisma.payment.create({
          data: {
            parcelId: parcel.id,
            amount,
            method: "CASH",
            paymentDate: at(day),
            reversedAt: reversed ? new Date() : null,
            atCheckout: atCheckout ?? false,
          },
        });
      }
    }
  }

  before(async () => {
    releaseLock = await acquireCreditTestLock(); // carência (3 dias) vem das configurações
    await resetCreditDefaults();
  });

  after(async () => {
    try {
      await deleteFinancialDocuments({ where: { partyId: { in: customerIds } } });
      await deleteCustomerSales(customerIds);
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    } finally {
      await releaseLock?.();
      await prisma.$disconnect();
    }
  });

  test("pagas e pagas em dia contam na MESMA janela; atrasos, máximos, total pago e relacionamento", async () => {
    const id = await customer(14);
    const quiet = await customer(2);
    await receivable(id, [
      { amount: 100, due: -100, payments: [[-98, 100]] }, // em dia (2 dias ≤ carência 3)
      { amount: 100, due: -60, payments: [[-55, 40], [-50, 60], [-52, 30, true]] }, // quitada 10 dias depois
      { amount: 100, due: -200, payments: [[-160, 100]] }, // 40 dias de atraso
      { amount: 100, due: -500, payments: [[-480, 100]] }, // fora da janela: não conta em nada
      { amount: 100, due: -7, payments: [[-3, 30]] }, // vencida há 7, em aberto
      { amount: 100, due: 20 }, // a vencer
    ]);
    // Documento cancelado não entra.
    await receivable(id, [{ amount: 100, due: -90, payments: [[-10, 100]] }], "CANCELED");

    const reader = new PrismaCreditHistoryReader(new PrismaCreditSettingsRepository());
    const map = await reader.forCustomers([id, quiet, randomUUID()], today, 12);
    assert.deepEqual(map.get(id), {
      paidInstallments: 3,
      paidOnTime: 1,
      paidLate30Plus: 1,
      totalDaysLate: 50,
      relationshipMonths: 14,
      totalPaidCents: 33000,
      renegotiations: 0,
      maxDaysLateInPeriod: 40,
      currentMaxOverdueDays: 7,
    });
    assert.deepEqual(map.get(quiet), {
      paidInstallments: 0,
      paidOnTime: 0,
      paidLate30Plus: 0,
      totalDaysLate: 0,
      relationshipMonths: 2,
      totalPaidCents: 0,
      renegotiations: 0,
      maxDaysLateInPeriod: 0,
      currentMaxOverdueDays: 0,
    });
    assert.equal(map.size, 2);
    assert.deepEqual(await reader.forCustomers([], today, 12), new Map());

    // A exposição usa o mesmo cálculo de saldo: 70 (vencida) + 100 (a vencer).
    const exposure = await new PrismaCreditExposureReader().forCustomer(id, today);
    assert.deepEqual(exposure, { openBalanceCents: 17000, currentMaxOverdueDays: 7 });
  });

  test("só parcelas do crediário contam: vendas à vista/PIX/cartão (pagas no ato), a entrada e documentos avulsos ficam fora", async () => {
    const id = await customer(6);
    // 6 vendas à vista: documento PAID com a parcela de hoje (ou de dias atrás) paga no ato.
    for (let i = 0; i < 6; i++) {
      await receivable(id, [{ amount: 100, due: -10 * i, payments: [[-10 * i, 100, false, true]] }], "PAID", "CASH_SALE");
    }
    // Conta a receber avulsa quitada em dia: não é crediário.
    await receivable(id, [{ amount: 100, due: -20, payments: [[-20, 100]] }], "PAID", "MANUAL");
    // Crediário: entrada paga no ato (fora) + 1 parcela quitada em dia + 1 a vencer.
    await receivable(id, [
      { amount: 30, due: -40, payments: [[-40, 30, false, true]] },
      { amount: 70, due: -10, payments: [[-11, 70]] },
      { amount: 70, due: 20 },
    ]);

    const reader = new PrismaCreditHistoryReader(new PrismaCreditSettingsRepository());
    const h = (await reader.forCustomers([id], today, 12)).get(id)!;
    assert.equal(h.paidInstallments, 1);
    assert.equal(h.paidOnTime, 1);
    assert.equal(h.totalPaidCents, 7000);
    assert.equal(h.maxDaysLateInPeriod, 0);

    // Só à vista: nada no histórico (4 compras não sobem Novo → Regular; 6 não liberam auto-aprovação).
    const cashOnly = await customer(6);
    for (let i = 0; i < 6; i++) {
      await receivable(cashOnly, [{ amount: 100, due: -5 * i, payments: [[-5 * i, 100, false, true]] }], "PAID", "CASH_SALE");
    }
    const c = (await reader.forCustomers([cashOnly], today, 12)).get(cashOnly)!;
    assert.equal(c.paidInstallments, 0);
    assert.equal(c.paidOnTime, 0);
    assert.equal(c.totalPaidCents, 0);
  });

  test("predicado do histórico: caderninho (LEGACY + noLateFees) e cancelados ficam fora; noLateFees de outra origem conta", async () => {
    const rows = await prisma.$queryRaw<{ k: string }[]>`
      SELECT k FROM (VALUES
        ('legacy-nolatefees', 'OPEN', 'LEGACY', true),
        ('legacy-comum', 'OPEN', 'LEGACY', false),
        ('manual-nolatefees', 'OPEN', 'MANUAL', true),
        ('venda', 'PAID', 'SALE', false),
        ('cancelado', 'CANCELED', 'SALE', false)
      ) AS fd(k, status, "originType", "noLateFees")
      WHERE ${countsTowardCreditHistory()}
      ORDER BY k`;
    assert.deepEqual(rows.map((r) => r.k), ["legacy-comum", "manual-nolatefees", "venda"]);
  });
});
