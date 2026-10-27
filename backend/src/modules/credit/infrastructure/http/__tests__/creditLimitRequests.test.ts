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

describe("Pedidos de aumento de limite (/credit/limit-requests)", () => {
  const users = {} as Record<"ADMIN" | "VENDEDOR" | "APPROVER" | "ESTOQUISTA", TestUser>;
  const customerIds: string[] = [];
  let releaseLock: () => Promise<void>;

  const call = (role: keyof typeof users, method: "GET" | "POST", url: string, payload?: unknown, key = newIdempotencyKey()) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: { authorization: `Bearer ${users[role].token}`, ...(method === "POST" ? { "idempotency-key": key } : {}) },
    });

  /** Cliente com perfil/limite e `paid` parcelas quitadas; `lateDays` > 0 faz a última quitar com esse atraso. */
  async function customer(opts: { profile?: "NEW" | "REGULAR" | "GOOD" | "EXCELLENT"; limit?: number; paid?: number; lateDays?: number; status?: "ACTIVE" | "BLOCKED" } = {}) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Customer" (id, name, code, "createdAt") VALUES (${id}, ${`tx-test-${id}`}, ${`TX${id.slice(0, 12)}`}, now())`;
    customerIds.push(id);
    await prisma.customer.update({
      where: { id },
      data: { creditProfileCode: opts.profile ?? "GOOD", creditLimit: opts.limit ?? 1000, creditStatus: opts.status ?? "ACTIVE" },
    });
    const paid = opts.paid ?? 6;
    if (paid > 0) {
      const doc = await prisma.financialDocument.create({
        data: { type: "RECEIVABLE", originType: "MANUAL", originId: randomUUID(), partyId: id, partyType: "CUSTOMER", status: "PAID" },
      });
      for (let i = 0; i < paid; i++) {
        const late = i === paid - 1 ? (opts.lateDays ?? 0) : 0;
        const parcel = await prisma.financialParcel.create({
          data: { financialDocumentId: doc.id, amount: 100, dueDate: at(-60 - i * 5) },
        });
        await prisma.payment.create({
          data: { parcelId: parcel.id, amount: 100, method: "CASH", paymentDate: at(-60 - i * 5 + late) },
        });
      }
    }
    return id;
  }

  const request = (role: keyof typeof users, customerId: string, requestedLimit: number, reason = "Cliente pediu mais limite") =>
    call(role, "POST", "/credit/limit-requests", { customerId, requestedLimit, reason });

  const creditOf = async (id: string) => {
    const c = await prisma.customer.findUniqueOrThrow({ where: { id } });
    return Number(c.creditLimit);
  };

  before(async () => {
    releaseLock = await acquireCreditTestLock();
    users.ADMIN = await createTestUser({ role: "ADMIN" });
    users.VENDEDOR = await createTestUser({ role: "VENDEDOR" });
    users.APPROVER = await createTestUser({ role: "VENDEDOR", canApproveCredit: true });
    users.ESTOQUISTA = await createTestUser({ role: "ESTOQUISTA" });
    await resetCreditDefaults();
  });

  after(async () => {
    try {
      await prisma.creditLimitRequest.deleteMany({ where: { customerId: { in: customerIds } } });
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

  test("auto-aprovação: Bom, 6 pagas em dia, ≤ 150% → APPROVED, limite muda e o histórico diz 'automaticamente'", async () => {
    const id = await customer();
    const res = await request("VENDEDOR", id, 1500);
    assert.equal(res.statusCode, 201);
    const { data } = res.json();
    assert.equal(data.status, "APPROVED");
    assert.equal(data.autoApproved, true);
    assert.equal(data.currentLimit, 1000);
    assert.equal(data.requestedLimit, 1500);
    assert.equal(data.approvedLimit, 1500);
    assert.equal(data.decidedBy, null);
    assert.deepEqual(data.requestedBy, { id: users.VENDEDOR.id, name: users.VENDEDOR.name });
    assert.equal(await creditOf(id), 1500);

    const changes = await prisma.creditLimitChange.findMany({ where: { customerId: id } });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].source, "REQUEST");
    assert.match(changes[0].reason, /automaticamente/i);
    assert.equal(Number(changes[0].fromLimit), 1000);
    assert.equal(Number(changes[0].toLimit), 1500);
  });

  test("não auto-aprova: Regular, > 150%, < 6 pagas, atraso > 5 dias, ficha bloqueada → PENDING e limite intacto", async () => {
    const cases: [string, string][] = [
      ["regular", await customer({ profile: "REGULAR" })],
      ["acima de 150%", await customer()],
      ["5 pagas", await customer({ paid: 5 })],
      ["atraso de 6 dias", await customer({ lateDays: 6 })],
      ["bloqueado", await customer({ status: "BLOCKED" })],
    ];
    for (const [label, id] of cases) {
      const res = await request("VENDEDOR", id, label === "acima de 150%" ? 1500.01 : 1500);
      assert.equal(res.statusCode, 201, label);
      assert.equal(res.json().data.status, "PENDING", label);
      assert.equal(res.json().data.autoApproved, false, label);
      assert.equal(res.json().data.approvedLimit, null, label);
      assert.equal(await creditOf(id), 1000, label);
    }
    // Atraso de 5 dias (dentro do tolerado) ainda auto-aprova.
    const ok = await customer({ lateDays: 5 });
    assert.equal((await request("VENDEDOR", ok, 1200)).json().data.status, "APPROVED");
  });

  test("segundo pedido pendente → 409; valor não maior → 422; validações; cliente inexistente → 404", async () => {
    const id = await customer({ profile: "REGULAR" });
    assert.equal((await request("VENDEDOR", id, 2000)).statusCode, 201);
    const again = await request("ADMIN", id, 3000);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, "CREDIT_REQUEST_ALREADY_PENDING");

    const other = await customer({ profile: "REGULAR" });
    const same = await request("VENDEDOR", other, 1000);
    assert.equal(same.statusCode, 422);
    assert.equal(same.json().code, "CREDIT_LIMIT_NOT_HIGHER");
    assert.equal((await call("VENDEDOR", "POST", "/credit/limit-requests", { customerId: other, requestedLimit: 2000 })).statusCode, 400);
    assert.equal((await call("VENDEDOR", "POST", "/credit/limit-requests", { customerId: other, requestedLimit: 2000, reason: "ab" })).statusCode, 400);
    assert.equal((await request("VENDEDOR", other, 10.001)).statusCode, 400);
    assert.equal((await request("VENDEDOR", other, 0)).statusCode, 400);
    assert.equal((await request("VENDEDOR", "not-a-uuid", 2000)).statusCode, 400);
    assert.equal((await request("VENDEDOR", randomUUID(), 2000)).statusCode, 404);
    assert.equal((await request("ESTOQUISTA", other, 2000)).statusCode, 403);
  });

  test("aprovar com valor ajustado: limite = ajustado, pedido APPROVED com decisor, histórico REQUEST; de novo → 409", async () => {
    const id = await customer({ profile: "REGULAR" });
    const created = (await request("VENDEDOR", id, 3000, "Quer comprar um sofá")).json().data;
    const res = await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/approve`, { approvedLimit: 1800, reason: "Valor menor por ora" });
    assert.equal(res.statusCode, 200);
    const { data } = res.json();
    assert.equal(data.status, "APPROVED");
    assert.equal(data.autoApproved, false);
    assert.equal(data.requestedLimit, 3000);
    assert.equal(data.approvedLimit, 1800);
    assert.equal(data.decisionReason, "Valor menor por ora");
    assert.deepEqual(data.decidedBy, { id: users.ADMIN.id, name: users.ADMIN.name });
    assert.equal(await creditOf(id), 1800);
    const [change] = await prisma.creditLimitChange.findMany({ where: { customerId: id } });
    assert.equal(change.source, "REQUEST");
    assert.equal(change.changedById, users.ADMIN.id);
    assert.match(change.reason, /Valor menor por ora/);

    const again = await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/approve`, {});
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, "CREDIT_REQUEST_NOT_PENDING");
    assert.equal((await call("ADMIN", "POST", `/credit/limit-requests/${randomUUID()}/approve`, {})).statusCode, 404);
  });

  test("aprovar sem valor usa o pedido; valor inválido → 400; replay com a mesma chave não repete a mudança", async () => {
    const id = await customer({ profile: "REGULAR" });
    const created = (await request("VENDEDOR", id, 2500)).json().data;
    assert.equal((await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/approve`, { approvedLimit: 0 })).statusCode, 400);
    assert.equal((await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/approve`, { approvedLimit: 10.005 })).statusCode, 400);
    const key = newIdempotencyKey();
    const first = await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/approve`, {}, key);
    const replay = await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/approve`, {}, key);
    assert.equal(first.statusCode, 200);
    assert.equal(replay.statusCode, 200);
    assert.deepEqual(replay.json(), first.json());
    assert.equal(first.json().data.approvedLimit, 2500);
    assert.equal(await creditOf(id), 2500);
    assert.equal(await prisma.creditLimitChange.count({ where: { customerId: id } }), 1);
  });

  test("recusar com motivo: REJECTED, limite intacto, nada no histórico de limite; sem motivo → 400; já decidido → 409", async () => {
    const id = await customer({ profile: "REGULAR" });
    const created = (await request("VENDEDOR", id, 2500)).json().data;
    assert.equal((await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/reject`, {})).statusCode, 400);
    const res = await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/reject`, { reason: "Tem parcelas atrasadas" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.status, "REJECTED");
    assert.equal(res.json().data.decisionReason, "Tem parcelas atrasadas");
    assert.equal(res.json().data.approvedLimit, null);
    assert.equal(await creditOf(id), 1000);
    assert.equal(await prisma.creditLimitChange.count({ where: { customerId: id } }), 0);
    assert.equal((await call("ADMIN", "POST", `/credit/limit-requests/${created.id}/reject`, { reason: "De novo" })).statusCode, 409);
    // Depois de decidido, o cliente pode pedir de novo.
    assert.equal((await request("VENDEDOR", id, 2000)).statusCode, 201);
  });

  test("VENDEDOR marcado (canApproveCredit) lista e aprova; sem marca → 403; ESTOQUISTA → 403", async () => {
    const id = await customer({ profile: "REGULAR" });
    const created = (await request("VENDEDOR", id, 1800)).json().data;
    for (const role of ["VENDEDOR", "ESTOQUISTA"] as const) {
      assert.equal((await call(role, "GET", "/credit/limit-requests")).statusCode, 403, role);
      assert.equal((await call(role, "GET", "/credit/limit-requests/count")).statusCode, 403, role);
      assert.equal((await call(role, "POST", `/credit/limit-requests/${created.id}/approve`, {})).statusCode, 403, role);
      assert.equal((await call(role, "POST", `/credit/limit-requests/${created.id}/reject`, { reason: "Não" })).statusCode, 403, role);
    }
    assert.equal((await call("APPROVER", "GET", "/credit/limit-requests")).statusCode, 200);
    const res = await call("APPROVER", "POST", `/credit/limit-requests/${created.id}/approve`, {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().data.decidedBy.id, users.APPROVER.id);
    assert.equal(await creditOf(id), 1800);
  });

  test("lista (filtro de status, mais recente primeiro, cliente e nomes) e contador de pendentes", async () => {
    const a = await customer({ profile: "REGULAR" });
    const b = await customer({ profile: "REGULAR" });
    const before = (await call("ADMIN", "GET", "/credit/limit-requests/count")).json().data.pending as number;
    const ra = (await request("VENDEDOR", a, 1200)).json().data;
    const rb = (await request("VENDEDOR", b, 1300)).json().data;
    assert.equal((await call("ADMIN", "GET", "/credit/limit-requests/count")).json().data.pending, before + 2);
    await call("ADMIN", "POST", `/credit/limit-requests/${rb.id}/reject`, { reason: "Sem histórico" });
    assert.equal((await call("ADMIN", "GET", "/credit/limit-requests/count")).json().data.pending, before + 1);

    const pending = (await call("ADMIN", "GET", "/credit/limit-requests?status=PENDING&limit=100")).json();
    const mine = pending.data.find((r: any) => r.id === ra.id);
    assert.ok(mine);
    assert.equal(mine.customer.id, a);
    assert.match(mine.customer.name, /^tx-test-/);
    assert.equal(pending.data.some((r: any) => r.id === rb.id), false);
    assert.ok(pending.data.every((r: any) => r.status === "PENDING"));
    assert.ok(pending.pagination);
    assert.deepEqual(keyShape(pending), keyShape(loadFixture("creditLimitRequests")), "fixture do front = resposta real");
    assert.deepEqual(keyShape((await call("ADMIN", "GET", "/credit/limit-requests/count")).json()), keyShape(loadFixture("creditLimitRequestCount")));
    const all = (await call("ADMIN", "GET", "/credit/limit-requests?limit=100")).json().data;
    assert.ok(all.findIndex((r: any) => r.id === rb.id) < all.findIndex((r: any) => r.id === ra.id), "mais recente primeiro");
    assert.equal((await call("ADMIN", "GET", "/credit/limit-requests?status=X")).statusCode, 400);
  });

  test("duas aprovações simultâneas do mesmo pedido → só uma aplica o limite; a outra 409", async () => {
    for (let round = 0; round < 3; round++) {
      const id = await customer({ profile: "REGULAR" });
      const created = (await request("VENDEDOR", id, 2200)).json().data;
      const [r1, r2] = await Promise.all([
        call("ADMIN", "POST", `/credit/limit-requests/${created.id}/approve`, {}),
        call("APPROVER", "POST", `/credit/limit-requests/${created.id}/approve`, { approvedLimit: 2100 }),
      ]);
      const codes = [r1.statusCode, r2.statusCode].sort();
      assert.deepEqual(codes, [200, 409], `rodada ${round}`);
      const loser = r1.statusCode === 409 ? r1 : r2;
      assert.equal(loser.json().code, "CREDIT_REQUEST_NOT_PENDING");
      const winner = r1.statusCode === 200 ? r1 : r2;
      assert.equal(await creditOf(id), winner.json().data.approvedLimit);
      assert.equal(await prisma.creditLimitChange.count({ where: { customerId: id } }), 1, "uma mudança só");
    }
  });

  test("dois pedidos simultâneos do mesmo cliente → um cria, o outro 409", async () => {
    const id = await customer({ profile: "REGULAR" });
    const [r1, r2] = await Promise.all([request("VENDEDOR", id, 1500), request("ADMIN", id, 1600)]);
    assert.deepEqual([r1.statusCode, r2.statusCode].sort(), [201, 409]);
    assert.equal(await prisma.creditLimitRequest.count({ where: { customerId: id } }), 1);
  });
});
