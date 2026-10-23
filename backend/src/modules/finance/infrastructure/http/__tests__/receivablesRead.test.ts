import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { getTestUserId } from "../../../../../test/inventoryFixtures";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/finance/", import.meta.url);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

interface PaymentSeed {
  amount: number;
  reversed?: boolean;
  createdAt?: Date;
}
interface ParcelSeed {
  amount: number;
  dueDate: string;
  payments?: PaymentSeed[];
}

describe("Leitura de contas a receber (GET /receivables)", () => {
  let token: string;
  let userId: string;
  const customers: Record<"a" | "b", { id: string; name: string }> = {} as never;
  const docs: Record<string, string> = {};

  const get = (url: string) =>
    app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });

  const createDoc = async (
    customerId: string,
    status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELED",
    parcels: ParcelSeed[],
    createdAt: Date,
  ) => {
    const doc = await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "SALE",
        originId: randomUUID(),
        partyId: customerId,
        partyType: "CUSTOMER",
        status,
        createdAt,
      },
    });
    // Parcelas em sequência para ids/createdAt previsíveis; inseridas na ordem dada.
    for (const p of parcels) {
      await prisma.financialParcel.create({
        data: {
          financialDocumentId: doc.id,
          amount: p.amount,
          dueDate: asDate(p.dueDate),
          payments: {
            create: (p.payments ?? []).map((pay) => ({
              amount: pay.amount,
              method: "PIX" as const,
              paymentDate: asDate(TODAY),
              createdById: userId,
              createdAt: pay.createdAt,
              ...(pay.reversed
                ? { reversedAt: new Date(), reversedById: userId, reversalReason: "tx-test estorno" }
                : {}),
            })),
          },
        },
      });
    }
    return doc.id;
  };

  before(async () => {
    userId = await getTestUserId();
    token = jwt.sign({ sub: userId, role: "admin" }, process.env.JWT_SECRET!);
    for (const key of ["a", "b"] as const) {
      const tag = `tx-test-${randomUUID()}`;
      const c = await prisma.customer.create({ data: { name: tag, code: tag } });
      customers[key] = { id: c.id, name: c.name };
    }
    const a = customers.a.id;
    const base = Date.now() - 60_000;
    const at = (i: number) => new Date(base + i * 1000);

    // OPEN, próximo vencimento em +10.
    docs.open = await createDoc(a, "OPEN", [
      { amount: 100, dueDate: addDays(10) },
      { amount: 100, dueDate: addDays(40) },
    ], at(1));
    // OPEN com parcela vencida (inserida fora de ordem para testar `number`).
    docs.overdue = await createDoc(a, "OPEN", [
      { amount: 50, dueDate: addDays(25) },
      { amount: 50, dueDate: addDays(-5) },
    ], at(2));
    // PARTIALLY_PAID, vence hoje: pagamento estornado (primeiro) + ativo.
    docs.partial = await createDoc(a, "PARTIALLY_PAID", [
      {
        amount: 80,
        dueDate: TODAY,
        payments: [
          { amount: 20, reversed: true, createdAt: at(3) },
          { amount: 30, createdAt: at(4) },
        ],
      },
    ], at(3));
    docs.paid = await createDoc(a, "PAID", [
      { amount: 40, dueDate: addDays(-20), payments: [{ amount: 40 }] },
    ], at(4));
    docs.canceled = await createDoc(a, "CANCELED", [{ amount: 70, dueDate: addDays(-3) }], at(5));
    // Cliente B: parcela vencendo hoje sem pagamento (Review Focus 1).
    docs.other = await createDoc(customers.b.id, "OPEN", [
      { amount: 12.34, dueDate: addDays(1) },
      { amount: 10, dueDate: TODAY },
    ], at(6));
  });

  after(async () => {
    try {
      try {
        await prisma.financialDocument.deleteMany({
          where: { partyId: { in: Object.values(customers).map((c) => c.id) } },
        });
      } finally {
        await prisma.customer.deleteMany({ where: { id: { in: Object.values(customers).map((c) => c.id) } } });
      }
    } finally {
      try {
        await app.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  const listIds = async (query: string) => {
    const res = await get(`/receivables?limit=100&${query}`);
    assert.equal(res.statusCode, 200, res.body);
    return res.json().data.map((d: any) => d.id) as string[];
  };

  test("GET /receivables filtra por status (incl. OVERDUE), customerId, dueFrom/dueTo", async () => {
    const a = `customerId=${customers.a.id}`;
    assert.deepEqual(await listIds(`${a}&status=OVERDUE`), [docs.overdue]);
    assert.deepEqual(await listIds(`${a}&status=OPEN`), [docs.open]);
    assert.deepEqual(await listIds(`${a}&status=PARTIALLY_PAID`), [docs.partial]);
    assert.deepEqual(await listIds(`${a}&status=PAID`), [docs.paid]);
    assert.deepEqual(await listIds(`${a}&status=CANCELED`), [docs.canceled]);

    assert.deepEqual(await listIds(`customerId=${customers.b.id}`), [docs.other]);

    assert.deepEqual(await listIds(`${a}&dueFrom=${addDays(30)}&dueTo=${addDays(45)}`), [docs.open]);
    assert.deepEqual(await listIds(`${a}&dueFrom=${TODAY}&dueTo=${TODAY}`), [docs.partial]);
    assert.deepEqual(await listIds(`${a}&dueTo=${addDays(-4)}`), [docs.overdue, docs.paid]);
    assert.deepEqual(await listIds(`${a}&dueFrom=${addDays(41)}`), []);
  });

  test("GET /receivables ordena por próximo vencimento em aberto; pagos/cancelados por último", async () => {
    assert.deepEqual(await listIds(`customerId=${customers.a.id}`), [
      docs.overdue, // -5
      docs.partial, // hoje
      docs.open, // +10
      docs.paid,
      docs.canceled,
    ]);

    const res = await get(`/receivables?customerId=${customers.a.id}&page=2&limit=2`);
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.deepEqual(body.data.map((d: any) => d.id), [docs.open, docs.paid]);
    assert.deepEqual(body.pagination, { page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  test("GET /receivables item: valores em centavos, cliente, próximo vencimento, displayStatus", async () => {
    const res = await get(`/receivables?customerId=${customers.a.id}&limit=100`);
    const items = res.json().data as any[];
    const partial = items.find((d) => d.id === docs.partial);
    assert.deepEqual(partial.customer, customers.a);
    assert.equal(partial.status, "PARTIALLY_PAID");
    assert.equal(partial.displayStatus, "PARTIALLY_PAID");
    assert.equal(partial.originType, "SALE");
    assert.equal(partial.totalAmount, 80);
    assert.equal(partial.paidAmount, 30);
    assert.equal(partial.remainingAmount, 50);
    assert.equal(partial.nextDueDate, TODAY);
    assert.equal(partial.parcelsCount, 1);

    const overdue = items.find((d) => d.id === docs.overdue);
    assert.equal(overdue.status, "OPEN");
    assert.equal(overdue.displayStatus, "OVERDUE");
    assert.equal(overdue.nextDueDate, addDays(-5));
    assert.equal(overdue.parcelsCount, 2);

    const paid = items.find((d) => d.id === docs.paid);
    assert.equal(paid.nextDueDate, null);
    assert.equal(paid.remainingAmount, 0);
    const canceled = items.find((d) => d.id === docs.canceled);
    assert.equal(canceled.displayStatus, "CANCELED");
    assert.equal(canceled.nextDueDate, null);
  });

  test("GET /receivables summary { openAmount, overdueAmount, receivedAmount } sobre o filtro", async () => {
    const res = await get(`/receivables?customerId=${customers.a.id}&limit=1`);
    assert.equal(res.statusCode, 200, res.body);
    // open = a vencer (não cancelado): 200 + 50 + 50 (vence hoje); overdue: 50 (cancelado fora);
    // received = pagamentos ativos: 30 + 40 (estorno de 20 não conta).
    assert.deepEqual(res.json().summary, { openAmount: 300, overdueAmount: 50, receivedAmount: 70 });

    const overdueOnly = await get(`/receivables?customerId=${customers.a.id}&status=OVERDUE`);
    assert.deepEqual(overdueOnly.json().summary, { openAmount: 50, overdueAmount: 50, receivedAmount: 0 });

    const other = await get(`/receivables?customerId=${customers.b.id}`);
    assert.deepEqual(other.json().summary, { openAmount: 22.34, overdueAmount: 0, receivedAmount: 0 });
  });

  test("GET /receivables query inválida → 400 VALIDATION_ERROR", async () => {
    for (const query of ["status=FOO", "dueFrom=2026-13-01", "dueTo=ontem", "customerId=abc", "limit=101"]) {
      const res = await get(`/receivables?${query}`);
      assert.equal(res.statusCode, 400, `${query}: ${res.body}`);
      assert.equal(res.json().code, "VALIDATION_ERROR");
    }
  });

  test("GET /receivables → chaves iguais à fixture receivableList", async () => {
    const res = await get(`/receivables?customerId=${customers.a.id}`);
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("receivableList")));
  });

  test("GET /receivables/:id → chaves iguais à fixture; inexistente → 404 FINANCIAL_DOCUMENT_NOT_FOUND", async () => {
    const res = await get(`/receivables/${docs.partial}`);
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.deepEqual(keyShape(body), keyShape(loadFixture("receivableDetail")));

    const d = body.data;
    assert.deepEqual(d.customer, customers.a);
    assert.equal(d.totalAmount, 80);
    assert.equal(d.paidAmount, 30);
    assert.equal(d.remainingAmount, 50);
    const [parcel] = d.parcels;
    assert.equal(parcel.number, 1);
    assert.equal(parcel.dueDate, TODAY);
    assert.equal(parcel.status, "PARTIALLY_PAID");
    assert.equal(parcel.paidAmount, 30);
    assert.equal(parcel.payments.length, 2);
    const [reversed, active] = parcel.payments;
    assert.equal(reversed.amount, 20);
    assert.ok(reversed.reversedAt);
    assert.deepEqual(reversed.reversedBy, { id: userId, name: "tx-test-inventory" });
    assert.equal(reversed.reversalReason, "tx-test estorno");
    assert.equal(active.reversedAt, null);
    assert.equal(active.reversedBy, null);
    assert.deepEqual(active.createdBy, { id: userId, name: "tx-test-inventory" });
    assert.equal(active.paymentDate, TODAY);
    assert.equal(active.method, "PIX");

    const missing = await get(`/receivables/${randomUUID()}`);
    assert.equal(missing.statusCode, 404, missing.body);
    assert.equal(missing.json().code, "FINANCIAL_DOCUMENT_NOT_FOUND");

    const invalid = await get(`/receivables/abc`);
    assert.equal(invalid.statusCode, 400, invalid.body);
  });

  test("GET /receivables/:id parcelas numeradas por vencimento; vencida ontem → OVERDUE, hoje → OPEN", async () => {
    const res = await get(`/receivables/${docs.overdue}`);
    assert.equal(res.statusCode, 200, res.body);
    const d = res.json().data;
    assert.equal(d.displayStatus, "OVERDUE");
    assert.deepEqual(
      d.parcels.map((p: any) => [p.number, p.dueDate, p.status]),
      [
        [1, addDays(-5), "OVERDUE"],
        [2, addDays(25), "OPEN"],
      ],
    );

    const canceled = (await get(`/receivables/${docs.canceled}`)).json().data;
    assert.equal(canceled.displayStatus, "CANCELED");
    assert.equal(canceled.parcels[0].status, "CANCELED");

    const today = (await get(`/receivables/${docs.other}`)).json().data;
    assert.equal(today.displayStatus, "OPEN");
    assert.deepEqual(
      today.parcels.map((p: any) => [p.number, p.dueDate, p.status]),
      [
        [1, TODAY, "OPEN"],
        [2, addDays(1), "OPEN"],
      ],
    );
  });
});
