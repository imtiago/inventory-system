import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { makeRunCreditReviewUseCase } from "@credit/infrastructure/factories/creditFactories";

const DAY = 86_400_000;
const today = todayInBusinessTz();
const at = (days: number) => new Date(Date.parse(`${today}T00:00:00.000Z`) + days * DAY);

describe("RunCreditReviewUseCase", () => {
  const customerIds: string[] = [];
  let releaseLock: () => Promise<void>;
  const useCase = makeRunCreditReviewUseCase();

  async function customer(opts: { profile?: "NEW" | "REGULAR" | "GOOD" | "EXCELLENT"; limit?: number; status?: "ACTIVE" | "BLOCKED" | "SUSPENDED" } = {}) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Customer" (id, name, code, "createdAt", "creditProfileCode", "creditLimit", "creditStatus")
      VALUES (${id}, ${`tx-test-rev-${id.slice(0, 8)}`}, ${`TX${id.slice(0, 12)}`},
              ((${today}::date - make_interval(months => 3))::timestamp + interval '15 hours'),
              ${opts.profile ?? "NEW"}::"CreditProfileCode", ${opts.limit ?? 300}, ${opts.status ?? "ACTIVE"}::"CreditStatus")`;
    customerIds.push(id);
    return id;
  }

  async function receivable(
    customerId: string,
    parcels: { amount: number; due: number; paidOn?: number }[],
    flags: { noLateFees?: boolean } = {},
  ) {
    const doc = await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "MANUAL",
        originId: randomUUID(),
        partyId: customerId,
        partyType: "CUSTOMER",
        status: "PARTIALLY_PAID",
        noLateFees: flags.noLateFees ?? false,
      },
    });
    for (const p of parcels) {
      const parcel = await prisma.financialParcel.create({
        data: { financialDocumentId: doc.id, amount: p.amount, dueDate: at(p.due) },
      });
      if (p.paidOn !== undefined) {
        await prisma.payment.create({ data: { parcelId: parcel.id, amount: p.amount, method: "CASH", paymentDate: at(p.paidOn) } });
      }
    }
  }

  /** n parcelas pagas em dia (vencimento e pagamento nos últimos 3 meses). */
  const onTime = (n: number) => Array.from({ length: n }, (_, i) => ({ amount: 50, due: -80 + i * 5, paidOn: -80 + i * 5 }));

  const dbState = async (id: string) => prisma.customer.findUniqueOrThrow({ where: { id } });

  before(async () => {
    releaseLock = await acquireCreditTestLock();
    await resetCreditDefaults();
  });

  after(async () => {
    try {
      await deleteFinancialDocuments({ where: { partyId: { in: customerIds } } });
      await prisma.creditLimitChange.deleteMany({ where: { customerId: { in: customerIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    } finally {
      await releaseLock?.();
      await prisma.$disconnect();
    }
  });

  test("sobe Novo → Regular (limite = max(atual, inicial do Regular)) com motivo e histórico AUTO_REVIEW; prévia não grava", async () => {
    const id = await customer();
    await receivable(id, onTime(9));

    const preview = await useCase.preview(today, [id]);
    assert.equal(preview.length, 1);
    const item = preview[0];
    assert.equal(item.customerId, id);
    assert.equal(item.action, "UP");
    assert.equal(item.fromProfile, "NEW");
    assert.equal(item.toProfile, "REGULAR");
    assert.equal(item.fromLimit, 300);
    assert.equal(item.toLimit, 800);
    assert.equal(item.fromStatus, "ACTIVE");
    assert.equal(item.toStatus, "ACTIVE");
    assert.equal(item.reason, "subiu para Regular: 9 parcelas em dia, 0 atrasos");
    assert.ok(item.score >= 40);
    assert.equal((await dbState(id)).creditProfileCode, "NEW");
    assert.equal(await prisma.creditLimitChange.count({ where: { customerId: id } }), 0);

    const applied = await useCase.apply({ today, customerIds: [id], userId: null });
    assert.equal(applied.length, 1);
    const state = await dbState(id);
    assert.equal(state.creditProfileCode, "REGULAR");
    assert.equal(Number(state.creditLimit), 800);
    const changes = await prisma.creditLimitChange.findMany({ where: { customerId: id } });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].source, "AUTO_REVIEW");
    assert.equal(changes[0].reason, "subiu para Regular: 9 parcelas em dia, 0 atrasos");
    assert.equal(changes[0].changedById, null);
  });

  test("UP mantém o limite se já é maior que o inicial do novo perfil", async () => {
    const id = await customer({ limit: 1500 });
    await receivable(id, onTime(9));
    const [item] = await useCase.preview(today, [id]);
    assert.equal(item.toProfile, "REGULAR");
    assert.equal(item.toLimit, 1500);
  });

  test("desce com atraso de 31 dias: perfil anterior, limite = min(atual, inicial do anterior); dívida intacta", async () => {
    const id = await customer({ profile: "GOOD", limit: 2500 });
    await receivable(id, [{ amount: 100, due: -50, paidOn: -19 }, ...onTime(2)]); // pagou 31 dias depois
    const [item] = await useCase.preview(today, [id]);
    assert.equal(item.action, "DOWN");
    assert.equal(item.toProfile, "REGULAR");
    assert.equal(item.fromLimit, 2500);
    assert.equal(item.toLimit, 800);
    assert.match(item.reason, /^desceu para Regular/);
    await useCase.apply({ today, customerIds: [id], userId: null });
    const state = await dbState(id);
    assert.equal(state.creditProfileCode, "REGULAR");
    assert.equal(Number(state.creditLimit), 800);
    // A dívida (parcelas) não foi tocada.
    assert.equal(await prisma.financialParcel.count({ where: { document: { partyId: id } } }), 3);
  });

  test("DOWN no perfil mais baixo não gera item; suspensão com parcela vencida há 61 dias (perfil e limite mantidos)", async () => {
    const low = await customer();
    await receivable(low, [{ amount: 100, due: -50, paidOn: -10 }]);
    assert.deepEqual(await useCase.preview(today, [low]), []);

    const id = await customer({ profile: "REGULAR", limit: 900 });
    await receivable(id, [{ amount: 100, due: -61 }]);
    const [item] = await useCase.preview(today, [id]);
    assert.equal(item.action, "SUSPEND");
    assert.equal(item.toStatus, "SUSPENDED");
    assert.equal(item.toProfile, "REGULAR");
    assert.equal(item.toLimit, 900);
    await useCase.apply({ today, customerIds: [id], userId: null });
    assert.equal((await dbState(id)).creditStatus, "SUSPENDED");
    // Já suspenso: não aparece de novo.
    assert.deepEqual(await useCase.preview(today, [id]), []);
  });

  test("BLOCKED manual e SUSPENDED não são tocados", async () => {
    const blocked = await customer({ status: "BLOCKED" });
    await receivable(blocked, onTime(9));
    const suspended = await customer({ status: "SUSPENDED" });
    await receivable(suspended, onTime(9));
    assert.deepEqual(await useCase.preview(today, [blocked, suspended]), []);
    assert.deepEqual(await useCase.apply({ today, customerIds: [blocked, suspended], userId: null }), []);
    assert.equal((await dbState(blocked)).creditProfileCode, "NEW");
  });

  test("aplicar só os selecionados", async () => {
    const a = await customer();
    const b = await customer();
    await receivable(a, onTime(9));
    await receivable(b, onTime(9));
    assert.equal((await useCase.preview(today, [a, b])).length, 2);
    const applied = await useCase.apply({ today, customerIds: [b], userId: null });
    assert.deepEqual(applied.map((i) => i.customerId), [b]);
    assert.equal((await dbState(a)).creditProfileCode, "NEW");
    assert.equal((await dbState(b)).creditProfileCode, "REGULAR");
  });

  test("rodar de novo no mesmo dia não muda nada na segunda vez", async () => {
    const id = await customer();
    await receivable(id, onTime(30)); // pontuação alta o bastante para subir mais de um degrau se repetisse
    const first = await useCase.apply({ today, customerIds: [id], userId: null });
    assert.equal(first.length, 1);
    assert.equal((await dbState(id)).creditProfileCode, "REGULAR");
    assert.deepEqual(await useCase.preview(today, [id]), []);
    assert.deepEqual(await useCase.apply({ today, customerIds: [id], userId: null }), []);
    assert.equal((await dbState(id)).creditProfileCode, "REGULAR");
    assert.equal(await prisma.creditLimitChange.count({ where: { customerId: id } }), 1);
  });

  test("dívida do caderninho (noLateFees) não conta na pontuação: documentos de outras origens continuam contando", async () => {
    const id = await customer();
    await receivable(id, onTime(9), { noLateFees: true }); // origem MANUAL: conta
    assert.equal((await useCase.preview(today, [id])).length, 1);
  });
});
