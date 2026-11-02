import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { createTestUser, signTestToken, TestUser } from "../../../../../test/authFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";
import { CreateFinancialDocumentUseCase } from "@finance/application/useCases/commands/CreateFinancialDocumentUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaFinancialParcelRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialParcelRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describe("parcelar saldo a combinar", () => {
  let adminToken: string;
  let seller: TestUser;
  let customerId: string;

  const call = (token: string, method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: withIdempotencyKey(method, { authorization: `Bearer ${token}` }),
    });

  const createDebt = async (amountCents: number, opts: { unknown?: boolean } = {}) => {
    const doc = await new CreateFinancialDocumentUseCase(
      new PrismaFinancialDocumentRepository(),
      new PrismaFinancialParcelRepository(),
      new PrismaTransactionManager(),
    ).execute({
      type: FinancialType.RECEIVABLE,
      originType: FinancialOriginType.LEGACY,
      originId: randomUUID(),
      partyType: FinancialPartyType.CUSTOMER,
      partyId: customerId,
      noLateFees: true,
      parcels: [
        {
          amountCents,
          dueDate: new Date(`${addDays(-30)}T00:00:00.000Z`),
          dueDateUnknown: opts.unknown ?? true,
        },
      ],
    });
    const parcel = await prisma.financialParcel.findFirstOrThrow({ where: { financialDocumentId: doc.id } });
    return { documentId: doc.id, parcelId: parcel.id };
  };

  const parts = (n: number, amount: number) =>
    Array.from({ length: n }, (_, i) => ({ dueDate: addDays(30 * (i + 1)), amount }));

  before(async () => {
    adminToken = signTestToken(await getTestUserId());
    seller = await createTestUser({ role: "VENDEDOR" });
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  after(async () => {
    try {
      try {
        await deleteFinancialDocuments({ where: { partyId: customerId } });
      } finally {
        await prisma.customer.deleteMany({ where: { id: customerId } });
        await seller.cleanup();
      }
    } finally {
      await app.close();
    }
  });

  test("300,00 a combinar vira 3 x 100,00 mensais; pagar e estornar funcionam nas novas", async () => {
    const { documentId, parcelId } = await createDebt(30000);
    const res = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${parcelId}/split`, {
      parcels: parts(3, 100),
    });
    assert.equal(res.statusCode, 200, res.body);
    const d = res.json().data;
    assert.equal(d.parcels.length, 3);
    assert.equal(d.noLateFees, true);
    assert.equal(d.status, "OPEN");
    assert.deepEqual(d.parcels.map((p: any) => p.amount), [100, 100, 100]);
    assert.deepEqual(d.parcels.map((p: any) => p.dueDateUnknown), [false, false, false]);
    assert.deepEqual(d.parcels.map((p: any) => p.dueDate.slice(0, 10)), parts(3, 100).map((p) => p.dueDate));
    assert.equal(await prisma.financialParcel.count({ where: { id: parcelId } }), 0);

    const pid = d.parcels[0].id;
    const pay = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${pid}/payments`, {
      amount: 100,
      method: "CASH",
    });
    assert.equal(pay.statusCode, 201, pay.body);
    assert.equal(pay.json().data.status, "PARTIALLY_PAID");
    const paymentId = pay.json().data.parcels[0].payments[0].id;
    const rev = await call(adminToken, "POST", `/receivables/payments/${paymentId}/reverse`, { reason: "teste" });
    assert.equal(rev.statusCode, 200, rev.body);
    assert.equal(rev.json().data.status, "OPEN");
  });

  test("com 50,00 já pago: a parcela antiga fecha em 50,00 e as novas somam 250,00", async () => {
    const { documentId, parcelId } = await createDebt(30000);
    const pay = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${parcelId}/payments`, {
      amount: 50,
      method: "PIX",
    });
    assert.equal(pay.statusCode, 201, pay.body);

    const res = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${parcelId}/split`, {
      parcels: [
        { dueDate: addDays(10), amount: 125 },
        { dueDate: addDays(40), amount: 125 },
      ],
    });
    assert.equal(res.statusCode, 200, res.body);
    const d = res.json().data;
    assert.equal(d.parcels.length, 3);
    const old = d.parcels.find((p: any) => p.id === parcelId);
    assert.equal(old.amount, 50);
    assert.equal(old.paidAmount, 50);
    assert.equal(old.status, "PAID");
    assert.equal(old.dueDateUnknown, false);
    assert.equal(old.dueDate.slice(0, 10), TODAY);
    const novas = d.parcels.filter((p: any) => p.id !== parcelId);
    assert.equal(novas.reduce((s: number, p: any) => s + p.amount, 0), 250);
    assert.equal(d.status, "PARTIALLY_PAID");
  });

  test("pagamento estornado não impede: a parcela vira a primeira das novas", async () => {
    const { documentId, parcelId } = await createDebt(20000);
    const pay = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${parcelId}/payments`, {
      amount: 50,
      method: "PIX",
    });
    const paymentId = pay.json().data.parcels[0].payments[0].id;
    await call(adminToken, "POST", `/receivables/payments/${paymentId}/reverse`, { reason: "teste" });
    const res = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${parcelId}/split`, {
      parcels: parts(2, 100),
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.parcels.length, 2);
    assert.equal(res.json().data.parcels.reduce((s: number, p: any) => s + p.amount, 0), 200);
  });

  test("soma diferente do saldo → 422 SPLIT_TOTAL_MISMATCH e nada muda", async () => {
    const { documentId, parcelId } = await createDebt(30000);
    const res = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${parcelId}/split`, {
      parcels: parts(3, 99.99),
    });
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "SPLIT_TOTAL_MISMATCH");
    assert.match(res.json().message, /R\$\s?300,00/);
    const stored = await prisma.financialParcel.findUniqueOrThrow({ where: { id: parcelId } });
    assert.equal(stored.dueDateUnknown, true);
  });

  test("parcela comum (não a combinar) → 422 PARCEL_NOT_TO_BE_AGREED", async () => {
    const { documentId, parcelId } = await createDebt(30000, { unknown: false });
    const res = await call(adminToken, "POST", `/receivables/${documentId}/parcels/${parcelId}/split`, {
      parcels: parts(3, 100),
    });
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "PARCEL_NOT_TO_BE_AGREED");
  });

  test("data passada ou fora de ordem → 422; mais de 24 → 400; parcela inexistente → 404", async () => {
    const { documentId, parcelId } = await createDebt(20000);
    const url = `/receivables/${documentId}/parcels/${parcelId}/split`;
    const past = await call(adminToken, "POST", url, {
      parcels: [
        { dueDate: addDays(-1), amount: 100 },
        { dueDate: addDays(30), amount: 100 },
      ],
    });
    assert.equal(past.statusCode, 422, past.body);
    const unordered = await call(adminToken, "POST", url, {
      parcels: [
        { dueDate: addDays(30), amount: 100 },
        { dueDate: addDays(10), amount: 100 },
      ],
    });
    assert.equal(unordered.statusCode, 422, unordered.body);
    const many = await call(adminToken, "POST", url, { parcels: parts(25, 8) });
    assert.equal(many.statusCode, 400, many.body);
    const none = await call(adminToken, "POST", url, { parcels: [] });
    assert.equal(none.statusCode, 400, none.body);
    const missing = await call(
      adminToken,
      "POST",
      `/receivables/${documentId}/parcels/${randomUUID()}/split`,
      { parcels: parts(2, 100) },
    );
    assert.equal(missing.statusCode, 404, missing.body);
  });

  test("VENDEDOR → 403", async () => {
    const { documentId, parcelId } = await createDebt(10000);
    const res = await call(seller.token, "POST", `/receivables/${documentId}/parcels/${parcelId}/split`, {
      parcels: parts(1, 100),
    });
    assert.equal(res.statusCode, 403, res.body);
  });

  test("contas a pagar não têm a rota", async () => {
    const res = await call(adminToken, "POST", `/payables/${randomUUID()}/parcels/${randomUUID()}/split`, {
      parcels: parts(1, 100),
    });
    assert.equal(res.statusCode, 404, res.body);
  });
});
