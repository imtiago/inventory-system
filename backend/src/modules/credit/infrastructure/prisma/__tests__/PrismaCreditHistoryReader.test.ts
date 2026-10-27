import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { PrismaCreditHistoryReader } from "@credit/infrastructure/prisma/PrismaCreditHistoryReader";
import { PrismaCreditExposureReader } from "@credit/infrastructure/prisma/PrismaCreditExposureReader";
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

  /** Parcelas de um documento RECEIVABLE; `payments` = [dias relativos a hoje, valor, estornado?]. */
  async function receivable(
    customerId: string,
    parcels: { amount: number; due: number; payments?: [number, number, boolean?][] }[],
    status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELED" = "PARTIALLY_PAID",
  ) {
    const doc = await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "MANUAL",
        originId: randomUUID(),
        partyId: customerId,
        partyType: "CUSTOMER",
        status,
      },
    });
    for (const p of parcels) {
      const parcel = await prisma.financialParcel.create({
        data: { financialDocumentId: doc.id, amount: p.amount, dueDate: at(p.due) },
      });
      for (const [day, amount, reversed] of p.payments ?? []) {
        await prisma.payment.create({
          data: { parcelId: parcel.id, amount, method: "CASH", paymentDate: at(day), reversedAt: reversed ? new Date() : null },
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
});
