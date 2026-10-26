import "dotenv/config";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../../test/cleanup";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../app";
import { createTestVariant } from "../../../../test/inventoryFixtures";
import { createTestUser, TestUser } from "../../../../test/authFixtures";
import { newIdempotencyKey } from "../../../../test/idempotency";
import { purgeIdempotencyRecords } from "../../../../scripts/purgeIdempotency";

app.log.level = "silent";

type Res = Awaited<ReturnType<typeof app.inject>>;

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const missing = randomUUID();

/** Todas as rotas cobertas (spec da fase 7 + POST de inventoryRoutes que mexem em saldo). */
const COVERED_ROUTES: string[] = [
  "/sales",
  `/sales/${missing}/cancel`,
  `/receivables/${missing}/parcels/${missing}/payments`,
  `/receivables/payments/${missing}/reverse`,
  `/payables/${missing}/parcels/${missing}/payments`,
  `/payables/payments/${missing}/reverse`,
  "/purchases",
  `/purchases/${missing}/receipts`,
  `/purchases/${missing}/cancel`,
  `/nfe-imports/${missing}/confirm`,
  "/inventory/receive",
  "/inventory/dispatch",
  "/inventory/adjust",
  "/inventory/reserve",
  "/inventory/release",
  "/inventory/initial-count",
  "/inventory/lots",
  `/inventory/boxes/${missing}/items`,
  `/inventory/boxes/${missing}/items/remove`,
];

describe("Idempotency-Key nas operações de dinheiro e estoque", () => {
  let admin: TestUser;
  let other: TestUser;
  let customerId: string;
  const variants: { id: string; cleanup: () => Promise<void> }[] = [];
  const usedKeys: string[] = [];

  const key = () => {
    const k = newIdempotencyKey();
    usedKeys.push(k);
    return k;
  };

  const post = (url: string, payload: unknown, opts: { key?: string | null; user?: TestUser } = {}) => {
    const headers: Record<string, string> = { authorization: `Bearer ${(opts.user ?? admin).token}` };
    if (opts.key !== null) headers["idempotency-key"] = opts.key ?? key();
    return app.inject({ method: "POST", url, payload: payload as any, headers });
  };

  /** Variante com preço e 50 unidades em estoque. */
  const stockedVariant = async (quantity = 50) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 50 } });
    if (quantity > 0) {
      const res = await post("/inventory/lots", {
        productVariantId: variantId,
        batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
        quantity,
        unitCost: 1,
        expirationDate: "2030-06-30T00:00:00.000Z",
      });
      assert.equal(res.statusCode, 200, res.body);
    }
    return variantId;
  };

  /** Venda a prazo de 2 × 50,00 → conta a receber com uma parcela de 100,00. */
  const receivableParcel = async () => {
    const variantId = await stockedVariant();
    const res = await post("/sales", {
      customerId,
      items: [{ productVariantId: variantId, quantity: 2 }],
      paymentTerms: { installments: 1, firstDueDate: addDays(30) },
    });
    assert.equal(res.statusCode, 201, res.body);
    const doc = await prisma.financialDocument.findFirstOrThrow({
      where: { originId: res.json().data.id },
      include: { parcels: true },
    });
    return { documentId: doc.id, parcelId: doc.parcels[0].id };
  };

  const paymentsOf = (parcelId: string) => prisma.payment.count({ where: { parcelId } });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    other = await createTestUser({ role: "ADMIN" });
  });

  beforeEach(async () => {
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    const id = customerId;
    const toClean = variants.splice(0);
    try {
      try {
        await deleteFinancialDocuments({ where: { partyId: id } });
      } finally {
        await prisma.sale.deleteMany({ where: { customerId: id } });
      }
    } finally {
      try {
        for (const v of toClean) await v.cleanup();
      } finally {
        await prisma.customer.deleteMany({ where: { id } });
      }
    }
  });

  after(async () => {
    try {
      await prisma.idempotencyRecord.deleteMany({ where: { key: { in: usedKeys } } });
      await admin?.cleanup();
      await other?.cleanup();
    } finally {
      try {
        await app.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  test("rota coberta sem Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED (tabela com todas as rotas)", async () => {
    const failures: string[] = [];
    for (const url of COVERED_ROUTES) {
      const res = await post(url, {}, { key: null });
      const body = res.statusCode === 400 ? res.json() : null;
      if (
        res.statusCode !== 400 ||
        body.code !== "IDEMPOTENCY_KEY_REQUIRED" ||
        body.message !== "Cabeçalho Idempotency-Key é obrigatório."
      ) {
        failures.push(`POST ${url}: ${res.statusCode} ${res.body.slice(0, 120)}`);
      }
    }
    assert.deepEqual(failures, []);
  });

  test("mesma chave e corpo → 1 pagamento; segunda resposta igual (201) com Idempotent-Replayed", async () => {
    const { documentId, parcelId } = await receivableParcel();
    const k = key();
    const url = `/receivables/${documentId}/parcels/${parcelId}/payments`;
    const body = { amount: 10, method: "PIX" };

    const first = await post(url, body, { key: k });
    assert.equal(first.statusCode, 201, first.body);
    assert.equal(first.headers["idempotent-replayed"], undefined);

    const second = await post(url, body, { key: k });
    assert.equal(second.statusCode, 201, second.body);
    assert.equal(second.headers["idempotent-replayed"], "true");
    assert.equal(second.body, first.body);
    assert.match(String(second.headers["content-type"]), /application\/json/);

    assert.equal(await paymentsOf(parcelId), 1);
  });

  test("duas requisições simultâneas com a mesma chave → 1 efeito, respostas iguais", async () => {
    const { documentId, parcelId } = await receivableParcel();
    const k = key();
    const url = `/receivables/${documentId}/parcels/${parcelId}/payments`;
    const body = { amount: 15, method: "CASH" };

    const [a, b] = await Promise.all([post(url, body, { key: k }), post(url, body, { key: k })]);
    assert.equal(a.statusCode, 201, a.body);
    assert.equal(b.statusCode, 201, b.body);
    assert.equal(a.body, b.body);
    const replayed = [a, b].filter((r: Res) => r.headers["idempotent-replayed"] === "true");
    assert.equal(replayed.length, 1);
    assert.equal(await paymentsOf(parcelId), 1);
  });

  test("mesma chave, corpo diferente → 422 IDEMPOTENCY_KEY_REUSED", async () => {
    const { documentId, parcelId } = await receivableParcel();
    const k = key();
    const url = `/receivables/${documentId}/parcels/${parcelId}/payments`;

    const first = await post(url, { amount: 10, method: "PIX" }, { key: k });
    assert.equal(first.statusCode, 201, first.body);

    const reused = await post(url, { amount: 11, method: "PIX" }, { key: k });
    assert.equal(reused.statusCode, 422, reused.body);
    assert.deepEqual(reused.json(), {
      message: "Esta chave já foi usada em outra operação.",
      code: "IDEMPOTENCY_KEY_REUSED",
    });

    // A rota faz parte do escopo: em outra rota a mesma chave é nova e executa normalmente.
    const otherRoute = await post(
      "/inventory/dispatch",
      { productVariantId: randomUUID(), quantity: 1, origin: "MANUAL" },
      { key: k },
    );
    assert.notEqual(otherRoute.json().code, "IDEMPOTENCY_KEY_REUSED");

    assert.equal(await paymentsOf(parcelId), 1);
  });

  test("operação que falha não grava a chave: mesma chave e mesmo corpo executa de novo", async () => {
    const variantId = await stockedVariant(5);
    const k = key();
    const body = { productVariantId: variantId, quantity: 8, origin: "MANUAL" };

    const failed = await post("/inventory/dispatch", body, { key: k });
    assert.equal(failed.statusCode, 422, failed.body);
    assert.equal(failed.json().code, "INSUFFICIENT_STOCK");
    assert.equal(await prisma.idempotencyRecord.count({ where: { key: k } }), 0);

    // Chega mais estoque; a nova tentativa com a mesma chave executa (não fica "presa" no erro).
    const lot = await post("/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity: 10,
      unitCost: 1,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(lot.statusCode, 200, lot.body);

    const retried = await post("/inventory/dispatch", body, { key: k });
    assert.equal(retried.statusCode, 200, retried.body);
    assert.equal(retried.headers["idempotent-replayed"], undefined);

    const replay = await post("/inventory/dispatch", body, { key: k });
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(replay.headers["idempotent-replayed"], "true");
    assert.equal(replay.body, retried.body);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: variantId } });
    assert.equal(inventory.quantity, 15 - 8);
  });

  test("outro usuário com a mesma chave → executa (sem replay)", async () => {
    const { documentId, parcelId } = await receivableParcel();
    const k = key();
    const url = `/receivables/${documentId}/parcels/${parcelId}/payments`;
    const body = { amount: 5, method: "PIX" };

    const mine = await post(url, body, { key: k });
    assert.equal(mine.statusCode, 201, mine.body);
    const theirs = await post(url, body, { key: k, user: other });
    assert.equal(theirs.statusCode, 201, theirs.body);
    assert.equal(theirs.headers["idempotent-replayed"], undefined);

    assert.equal(await paymentsOf(parcelId), 2);
  });

  test("chave com formato inválido → 400; purge remove registros com mais de 24 h", async () => {
    for (const bad of ["curta", "x".repeat(101), "chave com espaço", "chave/barra!"]) {
      const res = await post("/inventory/dispatch", {}, { key: bad });
      assert.equal(res.statusCode, 400, res.body);
      const body = res.json();
      assert.equal(body.code, "VALIDATION_ERROR", bad);
      assert.equal(body.errors[0].field, "Idempotency-Key", bad);
    }
    // Limites aceitos: 8 e 100 caracteres (o corpo vazio falha depois, na validação da rota).
    for (const ok of ["a".repeat(8), `${"b".repeat(99)}_`]) {
      const res = await post("/inventory/dispatch", {}, { key: ok });
      assert.equal(res.statusCode, 400, res.body);
      assert.notEqual(res.json().errors?.[0]?.field, "Idempotency-Key");
    }

    const base = { userId: admin.id, method: "POST", route: "/tx-test/purge", requestHash: "x" };
    const oldKey = key();
    const freshKey = key();
    await prisma.idempotencyRecord.create({
      data: { ...base, key: oldKey, statusCode: 200, createdAt: new Date(Date.now() - 25 * 3600_000) },
    });
    await prisma.idempotencyRecord.create({ data: { ...base, key: freshKey, statusCode: 200 } });

    const removed = await purgeIdempotencyRecords();
    assert.ok(removed >= 1);
    assert.equal(await prisma.idempotencyRecord.count({ where: { key: oldKey } }), 0);
    assert.equal(await prisma.idempotencyRecord.count({ where: { key: freshKey } }), 1);
  });
});
