import "dotenv/config";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { acquirePricingTestLock } from "../../../../../test/pricingTestLock";
import { keyShape } from "../../../../../test/keyShape";
import { withIdempotencyKey } from "../../../../../test/idempotency";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { randomCpf } from "../../../../../test/documentFixtures";
import {
  BOUNDARY,
  multipart,
  newNote,
  noteXml,
} from "../../../../nfe-import/infrastructure/http/__tests__/nfeTestNotes";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/pricing/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const credit = () => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 0]));
const settingsBody = (over: Record<string, unknown> = {}) => ({
  defaultMarginPercent: 40,
  roundingStrategy: "STORE_TABLE",
  alertThresholdPercent: 2,
  cardFees: { debitPercent: 0, creditPercent: credit() },
  ...over,
});

describe("Preços para revisar (/pricing/reviews e gatilhos)", () => {
  const users = {} as Record<"ADMIN" | "VENDEDOR", TestUser>;
  const cleanups: (() => Promise<void>)[] = [];
  const variants: string[] = [];
  const purchaseIds: string[] = [];
  const supplierIds: string[] = [];
  const importKeys: string[] = [];
  let categoryId: string;
  let releaseLock: () => Promise<void>;

  const call = (role: keyof typeof users, method: "GET" | "PUT" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: withIdempotencyKey(method, { authorization: `Bearer ${users[role].token}` }),
    });
  const admin = (method: "GET" | "PUT" | "POST", url: string, payload?: unknown) => call("ADMIN", method, url, payload);

  /** Variante nova na categoria compartilhada, com preço e (opcional) custo médio gravados direto no banco (sem gatilho). */
  const freshVariant = async (salePrice: number, stock?: { quantity: number; averageCost: number }) => {
    const { variantId, cleanup } = await createTestVariant();
    cleanups.push(cleanup);
    variants.push(variantId);
    const v = await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice }, include: { product: true } });
    await prisma.product.update({ where: { id: v.productId }, data: { categoryId } });
    if (stock) await prisma.inventory.create({ data: { productVariantId: variantId, ...stock } });
    return variantId;
  };

  const reviewsOf = (variantId: string) =>
    prisma.priceReview.findMany({ where: { productVariantId: variantId }, orderBy: { createdAt: "asc" } });
  const pendingOf = async (variantId: string) => (await reviewsOf(variantId)).filter((r) => r.status === "PENDING");

  const receive = (variantId: string, quantity: number, unitCost: number, extra: Record<string, unknown> = {}) =>
    admin("POST", "/inventory/receive", { productVariantId: variantId, quantity, unitCost, origin: "MANUAL", ...extra });

  before(async () => {
    releaseLock = await acquirePricingTestLock();
    for (const role of ["ADMIN", "VENDEDOR"] as const) users[role] = await createTestUser({ role });
    categoryId = (await prisma.category.create({ data: { name: `tx-test-${randomUUID()}` } })).id;
    const s = await prisma.supplier.create({ data: { name: `tx-test-${randomUUID()}`, document: randomCpf() } });
    supplierIds.push(s.id);
  });

  beforeEach(async () => {
    await prisma.pricingExpense.deleteMany({});
    await prisma.pricingSettings.deleteMany({});
    await prisma.category.update({ where: { id: categoryId }, data: { targetMarginBps: null } });
    // Escritas de configuração esperam as transações de estoque de outros arquivos de teste (trava compartilhada);
    // sob carga a espera pode virar 409 CONCURRENT_UPDATE (timeout/deadlock): repete.
    const retry409 = async (call: () => ReturnType<typeof admin>, expected: number) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await call();
        if (res.statusCode !== 409) return assert.equal(res.statusCode, expected);
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.fail("configuração de preço continuou em 409 após 5 tentativas");
    };
    await retry409(() => admin("PUT", "/pricing/settings", settingsBody()), 200);
    await retry409(() => admin("POST", "/pricing/expenses", { name: "Despesas", percent: 20 }), 201);
    await retry409(() => admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 30 }), 200);
  });

  after(async () => {
    try {
      await prisma.pricingExpense.deleteMany({});
      await prisma.pricingSettings.deleteMany({});
      const sIds = supplierIds;
      const pIds = purchaseIds;
      const documents = { originType: "PURCHASE" as const, originId: { in: pIds } };
      await prisma.payment.deleteMany({ where: { parcel: { document: documents } } });
      await prisma.financialParcel.deleteMany({ where: { document: documents } });
      await deleteFinancialDocuments({ where: documents });
      await prisma.stockMovement.deleteMany({ where: { productVariantId: { in: variants } } });
      await prisma.inventoryLot.deleteMany({ where: { productVariantId: { in: variants } } });
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: pIds } } });
      await prisma.nfeImport.deleteMany({ where: { accessKey: { in: importKeys } } });
      await prisma.purchase.deleteMany({ where: { id: { in: pIds } } });
      await prisma.supplierProductMapping.deleteMany({ where: { supplierId: { in: sIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: sIds } } });
      for (const cleanup of cleanups) await cleanup();
      await prisma.category.deleteMany({ where: { id: categoryId } });
      for (const u of Object.values(users)) await u?.cleanup();
    } finally {
      await releaseLock?.();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("entrada de estoque que muda o custo médio cria revisão COST_CHANGED com sugerido recalculado", async () => {
    const v = await freshVariant(30);
    const res = await receive(v, 3, 12);
    assert.equal(res.statusCode, 200, res.body);
    const [review] = await pendingOf(v);
    assert.ok(review, "esperava uma revisão pendente");
    // 12 / (1 − 0,20 − 0,30) = 24,00 → tabela da loja 24,90; margem real a 30,00 = 40% (acima do alvo)
    assert.equal(review.reason, "COST_CHANGED");
    assert.equal(Number(review.currentPrice), 30);
    assert.equal(Number(review.suggestedPrice), 24.9);

    const list = await admin("GET", "/pricing/reviews?status=PENDING&limit=100");
    assert.equal(list.statusCode, 200, list.body);
    const item = list.json().data.find((r: any) => r.productVariantId === v);
    assert.ok(item);
    assert.deepEqual(
      [item.id, item.currentPrice, item.suggestedPrice, item.difference, item.reason],
      [review.id, 30, 24.9, -5.1, "COST_CHANGED"],
    );
    assert.match(item.label, / — /);
    assert.equal(typeof list.json().pagination.total, "number");

    const count = await admin("GET", "/pricing/reviews/count");
    assert.equal(count.statusCode, 200, count.body);
    assert.ok(count.json().data.pending >= 1);
  });

  test("entrada com o mesmo custo médio não cria revisão", async () => {
    const v = await freshVariant(30, { quantity: 5, averageCost: 12 });
    assert.equal((await receive(v, 2, 12)).statusCode, 200);
    assert.equal((await reviewsOf(v)).length, 0);
  });

  test("recebimento de compra e confirmação de NF-e disparam o gatilho (mesma transação: rollback da entrada → sem revisão)", async () => {
    // Compra recebida → revisão.
    const a = await freshVariant(30);
    const created = await admin("POST", "/purchases", {
      supplierId: supplierIds[0],
      items: [{ productVariantId: a, quantity: 2, unitPrice: 12 }],
      paymentTerms: { installments: 1 },
    });
    assert.equal(created.statusCode, 201, created.body);
    const purchase = created.json().data;
    purchaseIds.push(purchase.id);
    const ok = await admin("POST", `/purchases/${purchase.id}/receipts`, {
      items: [{ purchaseItemId: purchase.items[0].id, quantity: 2 }],
    });
    assert.equal(ok.statusCode, 201, ok.body);
    assert.equal((await pendingOf(a))[0]?.reason, "COST_CHANGED");

    // Rollback: o primeiro item (menor variante, recebido antes) dispara o gatilho; o segundo falha → nada fica.
    const x = await freshVariant(30);
    const y = await freshVariant(30);
    const [first, second] = x < y ? [x, y] : [y, x];
    const batch = `tx-${randomUUID().slice(0, 8)}`;
    assert.equal((await receive(second, 1, 12, { batchNumber: batch })).statusCode, 200);
    await prisma.priceReview.deleteMany({ where: { productVariantId: second } });
    const p2 = await admin("POST", "/purchases", {
      supplierId: supplierIds[0],
      items: [
        { productVariantId: first, quantity: 1, unitPrice: 12 },
        { productVariantId: second, quantity: 1, unitPrice: 12 },
      ],
      paymentTerms: { installments: 1 },
    });
    assert.equal(p2.statusCode, 201, p2.body);
    purchaseIds.push(p2.json().data.id);
    const fail = await admin("POST", `/purchases/${p2.json().data.id}/receipts`, {
      items: p2.json().data.items.map((i: any) => ({ purchaseItemId: i.id, quantity: 1, batchNumber: batch })),
    });
    assert.equal(fail.statusCode, 409, fail.body);
    assert.equal((await prisma.inventory.findUnique({ where: { productVariantId: first } }))?.quantity ?? 0, 0);
    assert.equal((await reviewsOf(first)).length, 0);

    // NF-e confirmada com recebimento → revisão para as variantes vinculadas; desfazer volta o custo a 0 → pendente sai.
    const note = newNote();
    importKeys.push(note.key);
    const up = await app.inject({
      method: "POST",
      url: "/nfe-imports",
      headers: { authorization: `Bearer ${users.ADMIN.token}`, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart([{ name: "file", filename: "nota.xml", contentType: "application/xml", content: noteXml(note) }]),
    });
    assert.ok([200, 201].includes(up.statusCode), up.body);
    const linked = [await freshVariant(1), await freshVariant(1), await freshVariant(1)];
    const confirm = await admin("POST", `/nfe-imports/${up.json().data.id}/confirm`, {
      supplier: { create: { name: `tx-test-${randomUUID()}` } },
      items: linked.map((productVariantId, i) => ({ index: i + 1, link: { productVariantId, unitsPerPackage: i === 1 ? 2 : 1 } })),
      receive: true,
    });
    assert.equal(confirm.statusCode, 201, confirm.body);
    const nfePurchase = await prisma.purchase.findUniqueOrThrow({ where: { id: confirm.json().data.purchaseId } });
    purchaseIds.push(nfePurchase.id);
    supplierIds.push(nfePurchase.supplierId);
    for (const v of linked) assert.equal((await pendingOf(v)).length, 1, `variante ${v} sem revisão`);

    const reverted = await admin("POST", `/nfe-imports/${up.json().data.id}/revert`, {});
    assert.equal(reverted.statusCode, 200, reverted.body);
    for (const v of linked) assert.equal((await pendingOf(v)).length, 0, "custo 0 depois do estorno: sem sugestão, sem pendente");
  });

  test("mudar margem da categoria cria MARGIN_CHANGED só para variantes dela cujo sugerido ≠ preço", async () => {
    const atSuggested = await freshVariant(24.9, { quantity: 1, averageCost: 12 }); // sugerido a 30% = 24,90
    const differs = await freshVariant(30, { quantity: 1, averageCost: 12 });
    const { variantId: other, cleanup } = await createTestVariant(); // outra categoria
    cleanups.push(cleanup);
    variants.push(other);
    await prisma.productVariant.update({ where: { id: other }, data: { salePrice: 30 } });
    await prisma.inventory.create({ data: { productVariantId: other, quantity: 1, averageCost: 12 } });
    await prisma.priceReview.deleteMany({ where: { productVariantId: { in: [atSuggested, differs, other] } } });

    // 30% → 25%: sugerido 12 / 0,55 = 21,82 → 21,90
    const res = await admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 25 });
    assert.equal(res.statusCode, 200, res.body);
    const [r] = await pendingOf(differs);
    assert.equal(r?.reason, "MARGIN_CHANGED");
    assert.equal(Number(r.suggestedPrice), 21.9);
    assert.equal((await pendingOf(atSuggested)).length, 1, "24,90 ≠ 21,90 também entra");
    assert.equal((await reviewsOf(other)).length, 0);

    // Volta a 30%: quem está no sugerido (24,90) sai da lista; quem não está continua.
    await admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 30 });
    assert.equal((await pendingOf(atSuggested)).length, 0);
    assert.equal((await pendingOf(differs)).length, 1);
  });

  test("margem real 5 pontos abaixo da desejada com alerta 2 → MARGIN_BELOW_TARGET", async () => {
    // custo 10, despesas 20%, alvo 30%; a 18,18: 1818 − 1000 − 364 = 454 → 24,97%
    const v = await freshVariant(18.18, { quantity: 1, averageCost: 10 });
    await prisma.priceReview.deleteMany({ where: { productVariantId: v } });
    await admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 30 });
    const [r] = await pendingOf(v);
    assert.equal(r?.reason, "MARGIN_BELOW_TARGET");
    assert.equal(Number(r.suggestedPrice), 20.9);

    // Com alerta de 6 pontos a margem (24,97%) não alerta: motivo do gatilho.
    await admin("PUT", "/pricing/settings", settingsBody({ alertThresholdPercent: 6 }));
    assert.equal((await pendingOf(v))[0]?.reason, "SETTINGS_CHANGED");
  });

  test("duas entradas simultâneas da mesma variante → uma única revisão PENDING, nenhuma 500", async () => {
    for (let round = 0; round < 2; round++) {
      const v = await freshVariant(30);
      const results = await Promise.all([receive(v, 2, 12), receive(v, 3, 15)]);
      for (const res of results) assert.equal(res.statusCode, 200, res.body);
      assert.equal((await pendingOf(v)).length, 1);
    }
  });

  test("taxas de cartão inválidas no banco não derrubam a entrada de estoque (revisão não usa taxas) → 200, revisão gravada", async () => {
    const v = await freshVariant(30);
    await prisma.pricingSettings.update({ where: { id: "default" }, data: { cardFees: { debitBps: "x" } } });
    const res = await receive(v, 3, 12);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal((await pendingOf(v))[0]?.reason, "COST_CHANGED");
  });

  test("estresse: compras cruzadas, entradas manuais e escritas de configuração/despesa em paralelo → todas concluem, nenhum 409/500", async () => {
    const vs = (await Promise.all(Array.from({ length: 6 }, () => freshVariant(30)))).sort();
    const expense = (await admin("GET", "/pricing/expenses")).json().data[0] as { id: string };
    for (let round = 0; round < 2; round++) {
      const purchases = [];
      for (let k = 0; k < 4; k++) {
        const ids = [vs[k], vs[k + 1], vs[k + 2]];
        const res = await admin("POST", "/purchases", {
          supplierId: supplierIds[0],
          items: ids.map((productVariantId, i) => ({ productVariantId, quantity: 1, unitPrice: 10 + round + i })),
          paymentTerms: { installments: 1 },
        });
        assert.equal(res.statusCode, 201, res.body);
        purchaseIds.push(res.json().data.id);
        purchases.push(res.json().data as { id: string; items: { id: string }[] });
      }
      const results = await Promise.all([
        ...purchases.map((p) =>
          admin("POST", `/purchases/${p.id}/receipts`, { items: p.items.map((i) => ({ purchaseItemId: i.id, quantity: 1 })) }),
        ),
        ...vs.map((v, i) => receive(v, 1, 11 + i)),
        admin("PUT", "/pricing/settings", settingsBody({ alertThresholdPercent: 3 + round })),
        admin("PUT", `/pricing/expenses/${expense.id}`, { name: "Despesas", percent: 20 - round, active: true }),
        admin("PUT", `/pricing/target-margins/category/${categoryId}`, { targetMarginPercent: 30 + round }),
      ]);
      const bad = results.filter((r) => r.statusCode >= 300);
      assert.deepEqual(bad.map((r) => `${r.statusCode} ${r.body}`), []);
      for (const v of vs) assert.ok((await pendingOf(v)).length <= 1);
    }
  });

  test("configuração recalculando tudo × exclusão simultânea de variante → 200 (variante excluída fica fora, sem violar FK)", async () => {
    const v = await freshVariant(30, { quantity: 1, averageCost: 12 });
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let deleterPid!: number;
    let deleted!: () => void;
    const isDeleted = new Promise<void>((r) => (deleted = r));
    // D exclui a variante e segura o commit; a configuração lê a variante como candidata (D ainda não confirmou)
    // e só grava a revisão depois do commit de D.
    const deleter = prisma.$transaction(
      async (db) => {
        await db.inventory.deleteMany({ where: { productVariantId: v } });
        await db.productVariant.delete({ where: { id: v } });
        deleterPid = (await db.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid;
        deleted();
        await held;
      },
      { timeout: 20_000 },
    );
    try {
      await isDeleted;
      const x = admin("PUT", "/pricing/settings", settingsBody({ alertThresholdPercent: 4 }));
      const deadline = Date.now() + 5000;
      for (;;) {
        const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(*) AS n FROM pg_stat_activity WHERE ${deleterPid}::int = ANY(pg_blocking_pids(pid))`;
        if (Number(n) > 0) break;
        if (Date.now() > deadline) assert.fail("configuração não chegou a esperar a exclusão da variante");
        await new Promise((r) => setTimeout(r, 20));
      }
      release();
      await deleter;
      const res = await x;
      assert.equal(res.statusCode, 200, res.body);
      assert.equal((await reviewsOf(v)).length, 0);
    } finally {
      release();
      await deleter.catch(() => {});
    }
  });

  test("configuração salva enquanto recebimentos cruzados esperam travas de inventário → todos concluem (sem deadlock, nenhum 409/500)", async () => {
    // Ciclo que existia: compra A (s0,s1,s2) segura inventário s0 + trava compartilhada e espera s1;
    // a escrita de configuração X entra na fila da exclusiva; compra B (s2) trava o inventário s2 e pede a
    // compartilhada (fila atrás de X); A pega s1 e espera s2 de B → A→B→X→A (40P01).
    // Com a compartilhada pedida antes de qualquer trava de inventário, B espera sem segurar nada.
    const s = [await freshVariant(30), await freshVariant(30), await freshVariant(30)].sort();
    for (const v of s) await prisma.inventory.create({ data: { productVariantId: v, quantity: 0, averageCost: 0 } });
    const newPurchase = async (ids: string[]) => {
      const res = await admin("POST", "/purchases", {
        supplierId: supplierIds[0],
        items: ids.map((productVariantId) => ({ productVariantId, quantity: 2, unitPrice: 12 })),
        paymentTerms: { installments: 1 },
      });
      assert.equal(res.statusCode, 201, res.body);
      purchaseIds.push(res.json().data.id);
      return res.json().data as { id: string; items: { id: string }[] };
    };
    const receiveAll = (p: { id: string; items: { id: string }[] }) =>
      admin("POST", `/purchases/${p.id}/receipts`, { items: p.items.map((i) => ({ purchaseItemId: i.id, quantity: 2 })) });
    const pa = await newPurchase(s);
    const pb = await newPurchase([s[2]]);

    const settingsKey = Number(BigInt.asUintN(32, BigInt((await prisma.$queryRaw<{ k: number }[]>`SELECT hashtext('pricing_settings') AS k`)[0].k)));
    const waiters = async (mode: "ExclusiveLock" | "ShareLock") =>
      Number(
        (
          await prisma.$queryRaw<{ n: bigint }[]>`
            SELECT count(*) AS n FROM pg_locks
            WHERE locktype = 'advisory' AND NOT granted AND mode = ${mode} AND objid::bigint = ${settingsKey}`
        )[0].n,
      );
    const until = async (label: string, check: () => Promise<boolean>) => {
      const deadline = Date.now() + 5000;
      while (!(await check())) {
        if (Date.now() > deadline) assert.fail(`tempo esgotado esperando: ${label}`);
        await new Promise((r) => setTimeout(r, 20));
      }
    };

    // H segura o inventário s1 (como uma venda em andamento).
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let holderPid!: number;
    let locked!: () => void;
    const isLocked = new Promise<void>((r) => (locked = r));
    const holder = prisma.$transaction(
      async (db) => {
        await db.$queryRaw`SELECT id FROM "Inventory" WHERE "productVariantId" = ${s[1]} FOR UPDATE`;
        holderPid = (await db.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid;
        locked();
        await held;
      },
      { timeout: 20_000 },
    );
    try {
      await isLocked;
      const a = receiveAll(pa);
      await until("compra A bloqueada pelo inventário s1", async () =>
        Number(
          (
            await prisma.$queryRaw<{ n: bigint }[]>`
              SELECT count(*) AS n FROM pg_stat_activity WHERE ${holderPid}::int = ANY(pg_blocking_pids(pid))`
          )[0].n,
        ) > 0,
      );
      const x = admin("PUT", "/pricing/settings", settingsBody({ alertThresholdPercent: 3 }));
      await until("configuração na fila da trava exclusiva", async () => (await waiters("ExclusiveLock")) > 0);
      const sharedBefore = await waiters("ShareLock");
      const b = receiveAll(pb);
      await until("compra B na fila da trava compartilhada", async () => (await waiters("ShareLock")) > sharedBefore);
      // B espera a compartilhada SEM segurar o inventário s2 (antes segurava: ciclo resolvido só pelo detector
      // de deadlock do Postgres após deadlock_timeout, ou 40P01).
      await prisma.$transaction((db) => db.$queryRaw`SELECT id FROM "Inventory" WHERE "productVariantId" = ${s[2]} FOR UPDATE NOWAIT`);
      release();
      await holder;
      const [ra, rb, rx] = await Promise.all([a, b, x]);
      assert.deepEqual(
        [ra.statusCode, rb.statusCode, rx.statusCode],
        [201, 201, 200],
        [ra.body, rb.body, rx.body].join(" | "),
      );
      const stock = await prisma.inventory.findMany({ where: { productVariantId: { in: s } }, orderBy: { productVariantId: "asc" } });
      assert.deepEqual(stock.map((i) => i.quantity), [2, 2, 4]);
    } finally {
      release();
      await holder.catch(() => {});
    }
  });

  test("aplicar em lote 2 revisões → salePrice = sugerido, status APPLIED, resolvedById", async () => {
    const a = await freshVariant(30);
    const b = await freshVariant(30);
    await receive(a, 1, 12);
    await receive(b, 1, 12);
    const ids = [(await pendingOf(a))[0].id, (await pendingOf(b))[0].id];
    // Recalculado na hora: o custo de b mudou depois da revisão (sem gatilho).
    await prisma.inventory.update({ where: { productVariantId: b }, data: { averageCost: 10 } });

    const res = await admin("POST", "/pricing/reviews/apply", { ids });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual([...res.json().data.applied].sort(), [...ids].sort());
    assert.deepEqual(res.json().data.skipped, []);
    // keyShape trata [] como forma vazia: compara as chaves (as duas listas são de ids).
    assert.deepEqual(Object.keys(res.json().data).sort(), Object.keys((loadFixture("priceReviewApply") as any).data).sort());
    assert.deepEqual(res.json().data.skippedDetails, []);

    const rows = await prisma.productVariant.findMany({ where: { id: { in: [a, b] } } });
    assert.equal(Number(rows.find((r) => r.id === a)!.salePrice), 24.9);
    assert.equal(Number(rows.find((r) => r.id === b)!.salePrice), 20.9);
    for (const id of ids) {
      const r = await prisma.priceReview.findUniqueOrThrow({ where: { id } });
      assert.equal(r.status, "APPLIED");
      assert.equal(r.resolvedById, users.ADMIN.id);
      assert.ok(r.resolvedAt);
    }

    // Já aplicada → ignorada (com motivo); corpo inválido → 400.
    const again = await admin("POST", "/pricing/reviews/apply", { ids: [ids[0]] });
    assert.deepEqual(again.json().data, {
      applied: [],
      skipped: [ids[0]],
      skippedDetails: [{ id: ids[0], reason: "NOT_PENDING" }],
    });
    for (const body of [{ ids: [] }, { ids: ["x"] }, { ids: Array.from({ length: 101 }, () => randomUUID()) }, {}]) {
      assert.equal((await admin("POST", "/pricing/reviews/apply", body)).statusCode, 400);
    }
  });

  test("aplicar em lote: id que sumiu (apagado por gatilho) vai para skipped com motivo, sem 404; o resto é aplicado", async () => {
    const a = await freshVariant(30);
    const b = await freshVariant(30);
    await receive(a, 1, 12);
    await receive(b, 1, 12);
    const idA = (await pendingOf(a))[0].id;
    const idB = (await pendingOf(b))[0].id;
    await prisma.priceReview.delete({ where: { id: idB } }); // gatilho concorrente apagou a pendente
    const unknown = randomUUID();

    const res = await admin("POST", "/pricing/reviews/apply", { ids: [idA, idB, unknown] });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json().data.applied, [idA]);
    assert.deepEqual([...res.json().data.skipped].sort(), [idB, unknown].sort());
    assert.deepEqual(
      [...res.json().data.skippedDetails].sort((x: any, y: any) => (x.id < y.id ? -1 : 1)),
      [idB, unknown].sort().map((id) => ({ id, reason: "NOT_FOUND" })),
    );
    assert.equal(Number((await prisma.productVariant.findUniqueOrThrow({ where: { id: a } })).salePrice), 24.9);

    // Todos desconhecidos: 200 com tudo em skipped.
    const none = await admin("POST", "/pricing/reviews/apply", { ids: [unknown] });
    assert.equal(none.statusCode, 200, none.body);
    assert.deepEqual(none.json().data.applied, []);
    assert.deepEqual(none.json().data.skipped, [unknown]);
  });

  test("aplicar em lote não lê as taxas de cartão: JSON de taxas inválido não derruba o lote", async () => {
    const v = await freshVariant(30);
    await receive(v, 1, 12);
    const id = (await pendingOf(v))[0].id;
    const before = (await prisma.pricingSettings.findUniqueOrThrow({ where: { id: "default" } })).cardFees;
    await prisma.pricingSettings.update({ where: { id: "default" }, data: { cardFees: { broken: true } } });
    try {
      const res = await admin("POST", "/pricing/reviews/apply", { ids: [id] });
      assert.equal(res.statusCode, 200, res.body);
      assert.deepEqual(res.json().data.applied, [id]);
    } finally {
      await prisma.pricingSettings.update({ where: { id: "default" }, data: { cardFees: before as any } });
    }
  });

  test("manter → DISMISSED; novo gatilho cria outra pendente", async () => {
    const v = await freshVariant(30);
    await receive(v, 1, 12);
    const [r] = await pendingOf(v);
    const res = await admin("POST", `/pricing/reviews/${r.id}/dismiss`);
    assert.equal(res.statusCode, 200, res.body);
    const row = await prisma.priceReview.findUniqueOrThrow({ where: { id: r.id } });
    assert.deepEqual([row.status, row.resolvedById], ["DISMISSED", users.ADMIN.id]);
    assert.equal((await pendingOf(v)).length, 0);

    const again = await admin("POST", `/pricing/reviews/${r.id}/dismiss`);
    assert.equal(again.statusCode, 409, again.body);
    assert.equal(again.json().code, "PRICE_REVIEW_ALREADY_RESOLVED");
    assert.equal((await admin("POST", `/pricing/reviews/${randomUUID()}/dismiss`)).statusCode, 404);

    await receive(v, 1, 20);
    const all = await reviewsOf(v);
    assert.deepEqual(all.map((x) => x.status).sort(), ["DISMISSED", "PENDING"]);

    const dismissed = await admin("GET", "/pricing/reviews?status=DISMISSED&limit=100");
    assert.ok(dismissed.json().data.some((x: any) => x.id === r.id));
  });

  test("editar o preço pela tela da variante resolve a pendente como APPLIED", async () => {
    const v = await freshVariant(30);
    await receive(v, 1, 12);
    const [r] = await pendingOf(v);
    const res = await admin("PUT", `/variants/${v}`, { salePrice: 26.5 });
    assert.equal(res.statusCode, 200, res.body);
    const row = await prisma.priceReview.findUniqueOrThrow({ where: { id: r.id } });
    assert.deepEqual([row.status, row.resolvedById], ["APPLIED", users.ADMIN.id]);
    assert.equal((await pendingOf(v)).length, 0);
  });

  test("VENDEDOR → 403 nas rotas de revisão", async () => {
    const id = randomUUID();
    assert.equal((await call("VENDEDOR", "GET", "/pricing/reviews")).statusCode, 403);
    assert.equal((await call("VENDEDOR", "GET", "/pricing/reviews/count")).statusCode, 403);
    assert.equal((await call("VENDEDOR", "POST", "/pricing/reviews/apply", { ids: [id] })).statusCode, 403);
    assert.equal((await call("VENDEDOR", "POST", `/pricing/reviews/${id}/dismiss`)).statusCode, 403);
  });

  test("forma dos DTOs = fixtures priceReviews.json e priceReviewCount.json (keyShape); filtro inválido → 400", async () => {
    const v = await freshVariant(30);
    await receive(v, 1, 12);
    const list = await admin("GET", "/pricing/reviews?limit=100");
    assert.equal(list.statusCode, 200, list.body);
    assert.deepEqual(keyShape(list.json()), keyShape(loadFixture("priceReviews")));
    assert.deepEqual(keyShape((await admin("GET", "/pricing/reviews/count")).json()), keyShape(loadFixture("priceReviewCount")));
    assert.equal((await admin("GET", "/pricing/reviews?status=X")).statusCode, 400);
    assert.equal((await admin("GET", "/pricing/reviews?limit=101")).statusCode, 400);
  });
});
