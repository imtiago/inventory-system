import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { keyShape } from "../../../../../test/keyShape";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { PrismaCustomerCreditRepository } from "@credit/infrastructure/prisma/PrismaCustomerCreditRepository";
import { makeCustomerCreditService } from "@credit/infrastructure/factories/creditFactories";
import { CreditChangeSource, CreditStatus } from "@credit/domain/customerCredit";
import { CreditProfileCode } from "@credit/domain/CreditProfileCode";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/credit/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const DAY = 86_400_000;
const dateOffset = (days: number) => new Date(Date.parse(`${todayInBusinessTz()}T00:00:00.000Z`) + days * DAY);
const sleep = (ms: number) => new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms));

describe("Ficha de crédito do cliente (/customers/:id/credit)", () => {
  const users = {} as Record<"ADMIN" | "VENDEDOR", TestUser>;
  const customerIds: string[] = [];
  let releaseLock: () => Promise<void>;

  const call = (role: keyof typeof users, method: "GET" | "PUT", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${users[role].token}` } });

  /** Cliente gravado direto no banco, sem colunas de crédito: como um cliente que já existia antes da migration. */
  async function existingCustomer(): Promise<string> {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Customer" (id, name, code, "createdAt") VALUES (${id}, ${`tx-test-${id}`}, ${`TX${id.slice(0, 12)}`}, now())`;
    customerIds.push(id);
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

  test("cliente existente nasce Novo, limite 300,00, ACTIVE", async () => {
    const id = await existingCustomer();
    const res = await call("VENDEDOR", "GET", `/customers/${id}/credit`);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, {
      profileCode: "NEW",
      profileName: "Novo",
      limit: 300,
      openBalance: 0,
      available: 300,
      status: "ACTIVE",
      currentMaxOverdueDays: 0,
      history: [],
    });
  });

  test("PUT /customers/:id/credit para Bom com limite 2.000 e motivo → histórico 'de Novo/300 para Bom/2.000', changedBy", async () => {
    const id = await existingCustomer();
    const res = await call("ADMIN", "PUT", `/customers/${id}/credit`, {
      profileCode: "GOOD",
      limit: 2000,
      reason: "Cliente antiga, sempre pagou em dia",
    });
    assert.equal(res.statusCode, 200);
    const { data } = res.json();
    assert.equal(data.profileCode, "GOOD");
    assert.equal(data.profileName, "Bom");
    assert.equal(data.limit, 2000);
    assert.equal(data.available, 2000);
    assert.equal(data.history.length, 1);
    const [h] = data.history;
    assert.equal(h.fromProfile, "NEW");
    assert.equal(h.toProfile, "GOOD");
    assert.equal(h.fromLimit, 300);
    assert.equal(h.toLimit, 2000);
    assert.equal(h.fromStatus, "ACTIVE");
    assert.equal(h.toStatus, "ACTIVE");
    assert.equal(h.reason, "Cliente antiga, sempre pagou em dia");
    assert.equal(h.source, "MANUAL");
    assert.deepEqual(h.changedBy, { id: users.ADMIN.id, name: users.ADMIN.name });
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("customerCredit")));

    const got = await call("VENDEDOR", "GET", `/customers/${id}/credit`);
    assert.deepEqual(got.json(), res.json());
  });

  test("perfil sem limite mantém o limite; status muda; sem mudança não grava histórico; validações", async () => {
    const id = await existingCustomer();
    const profileOnly = await call("ADMIN", "PUT", `/customers/${id}/credit`, { profileCode: "REGULAR", reason: "Subiu de perfil" });
    assert.equal(profileOnly.statusCode, 200);
    assert.equal(profileOnly.json().data.profileCode, "REGULAR");
    assert.equal(profileOnly.json().data.limit, 300);

    const blocked = await call("ADMIN", "PUT", `/customers/${id}/credit`, { status: "BLOCKED", reason: "Cheque devolvido" });
    assert.equal(blocked.json().data.status, "BLOCKED");
    assert.equal(blocked.json().data.history.length, 2);
    assert.equal(blocked.json().data.history[0].reason, "Cheque devolvido", "mais recente primeiro");

    const same = await call("ADMIN", "PUT", `/customers/${id}/credit`, { status: "BLOCKED", limit: 300, reason: "Nada muda" });
    assert.equal(same.statusCode, 200);
    assert.equal(same.json().data.history.length, 2);

    assert.equal((await call("ADMIN", "PUT", `/customers/${id}/credit`, { limit: 500 })).statusCode, 400, "sem motivo");
    assert.equal((await call("ADMIN", "PUT", `/customers/${id}/credit`, { reason: "Só motivo" })).statusCode, 400);
    assert.equal((await call("ADMIN", "PUT", `/customers/${id}/credit`, { limit: -1, reason: "Negativo" })).statusCode, 400);
    assert.equal((await call("ADMIN", "PUT", `/customers/${id}/credit`, { limit: 10.001, reason: "Casas" })).statusCode, 400);
    assert.equal((await call("ADMIN", "PUT", `/customers/${id}/credit`, { status: "X", reason: "Status" })).statusCode, 400);
    assert.equal((await call("ADMIN", "PUT", `/customers/${randomUUID()}/credit`, { limit: 1, reason: "Sumiu" })).statusCode, 404);
    assert.equal((await call("ADMIN", "GET", `/customers/${randomUUID()}/credit`)).statusCode, 404);
  });

  test("disponível = limite − saldo aberto de contas a receber (venda a prazo antiga de 120,00 → 180,00)", async () => {
    const id = await existingCustomer();
    // Documento aberto: 60 vencida há 5 dias + 80 a vencer com 20 pagos (e um estorno ignorado) → saldo 120.
    const open = await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "MANUAL",
        originId: randomUUID(),
        partyId: id,
        partyType: "CUSTOMER",
        status: "PARTIALLY_PAID",
        parcels: { create: [{ amount: 60, dueDate: dateOffset(-5) }, { amount: 80, dueDate: dateOffset(25) }] },
      },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });
    await prisma.payment.create({ data: { parcelId: open.parcels[1].id, amount: 20, method: "CASH", paymentDate: dateOffset(-1) } });
    await prisma.payment.create({
      data: { parcelId: open.parcels[0].id, amount: 50, method: "CASH", paymentDate: dateOffset(-1), reversedAt: new Date() },
    });
    // Cancelado e quitado não contam.
    for (const status of ["CANCELED", "PAID"] as const) {
      await prisma.financialDocument.create({
        data: {
          type: "RECEIVABLE",
          originType: "MANUAL",
          originId: randomUUID(),
          partyId: id,
          partyType: "CUSTOMER",
          status,
          parcels: { create: [{ amount: 500, dueDate: dateOffset(-40) }] },
        },
      });
    }

    const res = await call("VENDEDOR", "GET", `/customers/${id}/credit`);
    assert.equal(res.statusCode, 200);
    const { data } = res.json();
    assert.equal(data.limit, 300);
    assert.equal(data.openBalance, 120);
    assert.equal(data.available, 180);
    assert.equal(data.currentMaxOverdueDays, 5);

    // Limite abaixo do saldo: disponível nunca fica negativo.
    const lowered = await call("ADMIN", "PUT", `/customers/${id}/credit`, { limit: 100, reason: "Reduzido" });
    assert.equal(lowered.json().data.available, 0);
    assert.equal(lowered.json().data.openBalance, 120);
  });

  test("VENDEDOR: GET ficha 200, PUT 403", async () => {
    const id = await existingCustomer();
    assert.equal((await call("VENDEDOR", "GET", `/customers/${id}/credit`)).statusCode, 200);
    const put = await call("VENDEDOR", "PUT", `/customers/${id}/credit`, { limit: 5000, reason: "Quero mais" });
    assert.equal(put.statusCode, 403);
    const row = await prisma.customer.findUniqueOrThrow({ where: { id } });
    assert.equal(Number(row.creditLimit), 300);
  });

  test("trava da ficha: ajuste concorrente espera a trava; o histórico encadeia sem perder atualização", async () => {
    const id = await existingCustomer();
    const tm = new PrismaTransactionManager();
    const service = makeCustomerCreditService();
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const isLocked = new Promise<void>((r) => (locked = r));

    const holder = tm.execute(async () => {
      await service.applyChange({
        customerId: id,
        limitCents: 50000,
        reason: "Primeiro ajuste",
        source: CreditChangeSource.MANUAL,
        userId: users.ADMIN.id,
      });
      locked();
      await hold;
    });
    await isLocked;

    const concurrent = call("ADMIN", "PUT", `/customers/${id}/credit`, { limit: 700, reason: "Segundo ajuste" });
    assert.equal(await Promise.race([concurrent.then(() => "done" as const), sleep(400)]), "timeout", "PUT esperou a trava");
    release();
    await holder;
    const res = await concurrent;
    assert.equal(res.statusCode, 200);

    const changes = await prisma.creditLimitChange.findMany({ where: { customerId: id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(
      changes.map((c) => [Number(c.fromLimit), Number(c.toLimit), c.reason]),
      [
        [300, 500, "Primeiro ajuste"],
        [500, 700, "Segundo ajuste"],
      ],
    );
  });

  test("lockMany: trava em ORDER BY id, ignora inexistentes; lock é reentrante na transação", async () => {
    const a = await existingCustomer();
    const b = await existingCustomer();
    const [low, high] = [a, b].sort();
    const tm = new PrismaTransactionManager();
    const repo = new PrismaCustomerCreditRepository();
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const isLocked = new Promise<void>((r) => (locked = r));

    const holder = tm.execute(async () => {
      const got = await repo.lockMany([high, randomUUID(), low, high]);
      assert.deepEqual(
        got.map((c) => c.customerId),
        [low, high],
      );
      assert.deepEqual(got[0], {
        customerId: low,
        profileCode: CreditProfileCode.NEW,
        limitCents: 30000,
        status: CreditStatus.ACTIVE,
      });
      assert.ok(await repo.lock(low), "reentrante");
      locked();
      await hold;
    });
    await isLocked;

    const other = tm.execute(() => repo.lock(high));
    assert.equal(await Promise.race([other.then(() => "done" as const), sleep(300)]), "timeout", "segunda transação esperou");
    release();
    await holder;
    assert.equal((await other)?.customerId, high);
    assert.deepEqual(await tm.execute(() => repo.lockMany([])), []);
  });
});
