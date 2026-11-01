import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { keyShape } from "../../../../../test/keyShape";
import { newIdempotencyKey } from "../../../../../test/idempotency";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/credit/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));
const DAY = 86_400_000;
const today = todayInBusinessTz();
const at = (days: number) => new Date(Date.parse(`${today}T00:00:00.000Z`) + days * DAY);

describe("Revisão periódica (/credit/review)", () => {
  const users = {} as Record<"ADMIN" | "VENDEDOR", TestUser>;
  const customerIds: string[] = [];
  let releaseLock: () => Promise<void>;

  const call = (role: keyof typeof users, method: "GET" | "POST", url: string, payload?: unknown, key = newIdempotencyKey()) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: { authorization: `Bearer ${users[role].token}`, ...(method === "POST" ? { "idempotency-key": key } : {}) },
    });

  async function customer(): Promise<string> {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Customer" (id, name, code, "createdAt")
      VALUES (${id}, ${`tx-test-rev-${id.slice(0, 8)}`}, ${`TX${id.slice(0, 12)}`},
              ((${today}::date - make_interval(months => 3))::timestamp + interval '15 hours'))`;
    customerIds.push(id);
    const doc = await prisma.financialDocument.create({
      data: { type: "RECEIVABLE", originType: "MANUAL", originId: randomUUID(), partyId: id, partyType: "CUSTOMER", status: "PAID" },
    });
    for (let i = 0; i < 9; i++) {
      const parcel = await prisma.financialParcel.create({
        data: { financialDocumentId: doc.id, amount: 50, dueDate: at(-80 + i * 5) },
      });
      await prisma.payment.create({ data: { parcelId: parcel.id, amount: 50, method: "CASH", paymentDate: at(-80 + i * 5) } });
    }
    return id;
  }

  before(async () => {
    releaseLock = await acquireCreditTestLock();
    for (const role of ["ADMIN", "VENDEDOR"] as const) users[role] = await createTestUser({ role });
    await resetCreditDefaults();
  });

  after(async () => {
    try {
      await deleteFinancialDocuments({ where: { partyId: { in: customerIds } } });
      await prisma.creditLimitChange.deleteMany({ where: { customerId: { in: customerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
      for (const u of Object.values(users)) await u?.cleanup();
    } finally {
      await releaseLock?.();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("só ADMIN (credit.manage) vê a prévia e aplica", async () => {
    assert.equal((await call("VENDEDOR", "GET", "/credit/review/preview")).statusCode, 403);
    assert.equal((await call("VENDEDOR", "POST", "/credit/review/apply", { customerIds: [randomUUID()] })).statusCode, 403);
  });

  test("prévia lista a mudança sem gravar; contrato igual à fixture do front", async () => {
    const id = await customer();
    const res = await call("ADMIN", "GET", "/credit/review/preview");
    assert.equal(res.statusCode, 200);
    const mine = res.json().data.find((i: { customerId: string }) => i.customerId === id);
    assert.equal(mine.toProfile, "REGULAR");
    assert.equal(mine.reason, "subiu para Regular: 9 parcelas em dia, 0 atrasos");
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("creditReviewItems")));
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id } })).creditProfileCode, "NEW");
  });

  test("aplicar: corpo inválido → 400; chave obrigatória; só os selecionados; replay não repete", async () => {
    const a = await customer();
    const b = await customer();
    assert.equal((await call("ADMIN", "POST", "/credit/review/apply", {})).statusCode, 400);
    assert.equal((await call("ADMIN", "POST", "/credit/review/apply", { customerIds: [] })).statusCode, 400);
    const noKey = await app.inject({
      method: "POST",
      url: "/credit/review/apply",
      payload: { customerIds: [a] },
      headers: { authorization: `Bearer ${users.ADMIN.token}` },
    });
    assert.equal(noKey.statusCode, 400);

    const key = newIdempotencyKey();
    const first = await call("ADMIN", "POST", "/credit/review/apply", { customerIds: [a] }, key);
    const replay = await call("ADMIN", "POST", "/credit/review/apply", { customerIds: [a] }, key);
    assert.equal(first.statusCode, 200);
    assert.deepEqual(replay.json(), first.json());
    assert.deepEqual(first.json().data.map((i: { customerId: string }) => i.customerId), [a]);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: a } })).creditProfileCode, "REGULAR");
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: b } })).creditProfileCode, "NEW");
    const change = await prisma.creditLimitChange.findFirstOrThrow({ where: { customerId: a } });
    assert.equal(change.source, "AUTO_REVIEW");
    assert.equal(change.changedById, users.ADMIN.id);
    // Nova chamada no mesmo dia: já revisado, nada muda.
    const again = await call("ADMIN", "POST", "/credit/review/apply", { customerIds: [a] });
    assert.deepEqual(again.json().data, []);
  });
});
