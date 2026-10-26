import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { BOUNDARY, multipart, newNote, Note, noteXml } from "./nfeTestNotes";
import { newIdempotencyKey, withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

/*
 * Spec §4 (onda 7): POST /nfe-imports/:id/revert desfaz uma importação recebida quando nada foi usado.
 * Nota base (nfe-completa.xml) vinculada a três variantes existentes:
 *  item 1 → a, 6 un/CX: 12 un em dois lotes (L001 6, L002 6), custo 247,05 → 20,59/un
 *  item 2 → b, 2 un/KG: 21 un sem lote; item 3 → c: 1 un sem lote. Número da nota 12345.
 */

const SOLD = { message: "Itens desta nota já foram vendidos/baixados", code: "NFE_REVERT_BLOCKED" };
const PAID = { message: "Há pagamento registrado nesta conta", code: "NFE_REVERT_BLOCKED" };

describe("Desfazer importação de NF-e (POST /nfe-imports/:id/revert)", () => {
  let admin: TestUser;
  let vendedor: TestUser;
  let estoquista: TestUser;
  let customerId: string;
  const importKeys: string[] = [];
  const supplierDocuments: string[] = [];
  const variantIds: string[] = [];
  const variantCleanups: (() => Promise<void>)[] = [];
  const boxIds: string[] = [];

  const call = (method: "GET" | "POST", url: string, payload?: object, user = admin, idempotencyKey?: string) =>
    app.inject({
      method,
      url,
      payload,
      headers:
        idempotencyKey !== undefined
          ? { authorization: `Bearer ${user.token}`, "idempotency-key": idempotencyKey }
          : withIdempotencyKey(method, { authorization: `Bearer ${user.token}` }),
    });

  const upload = (note: Note) =>
    app.inject({
      method: "POST",
      url: "/nfe-imports",
      headers: { authorization: `Bearer ${admin.token}`, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart([{ name: "file", filename: "nota.xml", contentType: "application/xml", content: noteXml(note) }]),
    });

  const variant = async (salePrice = 50) => {
    const { variantId, cleanup } = await createTestVariant();
    variantCleanups.push(cleanup);
    variantIds.push(variantId);
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice } });
    return variantId;
  };

  /** Nota confirmada com entrada no estoque; devolve ids da importação, do pedido e das variantes. */
  const importReceived = async (before?: (variants: { a: string; b: string; c: string }) => Promise<void>) => {
    const note = newNote();
    importKeys.push(note.key);
    supplierDocuments.push(note.cnpj);
    const supplier = await prisma.supplier.create({ data: { name: `tx-test-${randomUUID()}`, document: note.cnpj } });
    const draftRes = await upload(note);
    assert.equal(draftRes.statusCode, 201, draftRes.body);
    const importId: string = draftRes.json().data.id;
    const variants = { a: await variant(), b: await variant(), c: await variant() };
    if (before) await before(variants);
    const res = await call("POST", `/nfe-imports/${importId}/confirm`, {
      supplier: { id: supplier.id },
      items: [
        { index: 1, link: { productVariantId: variants.a, unitsPerPackage: 6 } },
        { index: 2, link: { productVariantId: variants.b, unitsPerPackage: 2 } },
        { index: 3, link: { productVariantId: variants.c } },
      ],
      receive: true,
    });
    assert.equal(res.statusCode, 201, res.body);
    return { note, importId, purchaseId: res.json().data.purchaseId as string, ...variants };
  };

  const revert = (importId: string, user = admin, idempotencyKey?: string) =>
    call("POST", `/nfe-imports/${importId}/revert`, undefined, user, idempotencyKey);

  const inventoryOf = (productVariantId: string) => prisma.inventory.findUniqueOrThrow({ where: { productVariantId } });

  const sell = (productVariantId: string, quantity: number) =>
    call("POST", "/sales", { customerId, items: [{ productVariantId, quantity }], paymentTerms: { installments: 1 } });

  /** Estado que um bloqueio não pode alterar. */
  const snapshot = async (importId: string, purchaseId: string, variants: string[]) => ({
    import: (await prisma.nfeImport.findUniqueOrThrow({ where: { id: importId } })).status,
    purchase: (await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status,
    payable: (await prisma.financialDocument.findFirstOrThrow({ where: { originType: "PURCHASE", originId: purchaseId } })).status,
    stock: await Promise.all(variants.map(async (id) => (await inventoryOf(id)).quantity)),
    outs: await prisma.stockMovement.count({ where: { originId: purchaseId, type: "OUT" } }),
  });

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    vendedor = await createTestUser({ role: "VENDEDOR" });
    estoquista = await createTestUser({ role: "ESTOQUISTA" });
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  after(async () => {
    try {
      await prisma.financialDocument.deleteMany({ where: { partyId: customerId } });
      await prisma.sale.deleteMany({ where: { customerId } });
      const suppliers = await prisma.supplier.findMany({ where: { document: { in: supplierDocuments } } });
      const supplierIds = suppliers.map((s) => s.id);
      const purchaseIds = (await prisma.purchase.findMany({ where: { supplierId: { in: supplierIds } } })).map((p) => p.id);
      const documents = { originType: "PURCHASE" as const, originId: { in: purchaseIds } };
      await prisma.payment.deleteMany({ where: { parcel: { document: documents } } });
      await prisma.financialParcel.deleteMany({ where: { document: documents } });
      await prisma.financialDocument.deleteMany({ where: documents });
      await prisma.inventoryBoxStock.deleteMany({ where: { boxId: { in: boxIds } } });
      await prisma.inventoryBox.deleteMany({ where: { id: { in: boxIds } } });
      await prisma.stockMovement.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.inventoryLot.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
      await prisma.nfeImport.deleteMany({ where: { accessKey: { in: importKeys } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.supplierProductMapping.deleteMany({ where: { supplierId: { in: supplierIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
      for (const cleanup of variantCleanups) await cleanup();
      await prisma.customer.deleteMany({ where: { id: customerId } });
    } finally {
      await admin.cleanup();
      await vendedor.cleanup();
      await estoquista.cleanup();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("estorno: lotes zerados com saída PURCHASE, caixas liberadas, custo médio recalculado, conta e pedido cancelados, REVERTED e chave reimportável", async () => {
    let boxId = "";
    const imported = await importReceived(async ({ a }) => {
      // Estoque anterior de `a`: 10 un a R$ 5,00 (custo médio 5).
      const lot = await call("POST", "/inventory/lots", {
        productVariantId: a,
        batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
        quantity: 10,
        unitCost: 5,
        expirationDate: "2030-06-30T00:00:00.000Z",
      });
      assert.equal(lot.statusCode, 200, lot.body);
    });
    const { importId, purchaseId, a, b, c, note } = imported;

    // Parte do lote L001 da nota guardada numa caixa.
    const l001 = await prisma.inventoryLot.findFirstOrThrow({ where: { productVariantId: a, sourceId: purchaseId, batchNumber: "L001" } });
    boxId = (await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } })).id;
    boxIds.push(boxId);
    const allocated = await call("POST", `/inventory/boxes/${boxId}/items`, { inventoryLotId: l001.id, quantity: 4 });
    assert.equal(allocated.statusCode, 200, allocated.body);

    assert.equal((await inventoryOf(a)).quantity, 22);
    assert.notEqual((await inventoryOf(a)).averageCost.toNumber(), 5);

    const res = await revert(importId);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.id, importId);
    assert.equal(res.json().data.status, "REVERTED");

    // Estoque: só o que já existia; custo médio volta ao do estoque restante (sem estoque → 0).
    const [ia, ib, ic] = [await inventoryOf(a), await inventoryOf(b), await inventoryOf(c)];
    assert.deepEqual([ia.quantity, ib.quantity, ic.quantity], [10, 0, 0]);
    assert.deepEqual([ia.averageCost.toNumber(), ib.averageCost.toNumber(), ic.averageCost.toNumber()], [5, 0, 0]);

    // Lotes da nota mantidos (histórico) com saldo zero; alocação em caixa removida.
    const lots = await prisma.inventoryLot.findMany({ where: { sourceType: "PURCHASE", sourceId: purchaseId } });
    assert.equal(lots.length, 4);
    assert.ok(lots.every((l) => l.remainingQuantity === 0));
    assert.equal(await prisma.inventoryBoxStock.count({ where: { inventoryLotId: l001.id } }), 0);

    // Uma saída por lote, origem PURCHASE, com a nota.
    const outs = await prisma.stockMovement.findMany({ where: { originId: purchaseId, type: "OUT" }, orderBy: { quantity: "asc" } });
    assert.deepEqual(
      outs.map((m) => [m.origin, m.quantity, m.notes, m.userId]),
      [
        ["PURCHASE", 1, "Estorno da NF-e 12345", admin.id],
        ["PURCHASE", 6, "Estorno da NF-e 12345", admin.id],
        ["PURCHASE", 6, "Estorno da NF-e 12345", admin.id],
        ["PURCHASE", 21, "Estorno da NF-e 12345", admin.id],
      ],
    );

    // Contas a pagar e pedido cancelados; recebido zerado.
    const payable = await prisma.financialDocument.findFirstOrThrow({ where: { originType: "PURCHASE", originId: purchaseId } });
    assert.equal(payable.status, "CANCELED");
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { items: true } });
    assert.equal(purchase.status, "CANCELED");
    assert.equal(purchase.cancelReason, "Estorno da NF-e 12345");
    assert.equal(purchase.canceledById, admin.id);
    assert.ok(purchase.items.every((i) => i.receivedQuantity === 0));

    const stored = await prisma.nfeImport.findUniqueOrThrow({ where: { id: importId } });
    assert.equal(stored.status, "REVERTED");

    // Lista filtra por REVERTED.
    const list = await call("GET", "/nfe-imports?status=REVERTED&limit=100");
    assert.equal(list.statusCode, 200, list.body);
    assert.ok(list.json().data.some((row: { id: string }) => row.id === importId));

    // Desfazer de novo (outra chave) → 409.
    const again = await revert(importId);
    assert.equal(again.statusCode, 409, again.body);
    assert.equal(again.json().code, "NFE_REVERT_BLOCKED");

    // A chave volta a poder ser importada: reenviar a nota reabre a mesma importação como rascunho.
    const reupload = await upload(note);
    assert.equal(reupload.statusCode, 200, reupload.body);
    assert.equal(reupload.json().data.id, importId);
    assert.equal(reupload.json().data.status, "DRAFT");
  });

  test("lote da nota vendido → 409 NFE_REVERT_BLOCKED e nada muda", async () => {
    const { importId, purchaseId, a, b, c } = await importReceived();
    const sale = await sell(c, 1);
    assert.equal(sale.statusCode, 201, sale.body);
    const before = await snapshot(importId, purchaseId, [a, b, c]);

    const res = await revert(importId);
    assert.equal(res.statusCode, 409, res.body);
    assert.deepEqual(res.json(), SOLD);
    assert.deepEqual(await snapshot(importId, purchaseId, [a, b, c]), before);
  });

  test("pagamento ativo no contas a pagar → 409 NFE_REVERT_BLOCKED; estornado o pagamento, desfaz", async () => {
    const { importId, purchaseId, a, b, c } = await importReceived();
    const payable = await prisma.financialDocument.findFirstOrThrow({
      where: { originType: "PURCHASE", originId: purchaseId },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });
    const paid = await call("POST", `/payables/${payable.id}/parcels/${payable.parcels[0].id}/payments`, { amount: 10, method: "PIX" });
    assert.equal(paid.statusCode, 201, paid.body);
    const before = await snapshot(importId, purchaseId, [a, b, c]);

    const res = await revert(importId);
    assert.equal(res.statusCode, 409, res.body);
    assert.deepEqual(res.json(), PAID);
    assert.deepEqual(await snapshot(importId, purchaseId, [a, b, c]), before);

    const payment = await prisma.payment.findFirstOrThrow({ where: { parcel: { financialDocumentId: payable.id } } });
    const reversed = await call("POST", `/payables/payments/${payment.id}/reverse`, { reason: "Lançado errado" });
    assert.equal(reversed.statusCode, 200, reversed.body);
    const ok = await revert(importId);
    assert.equal(ok.statusCode, 200, ok.body);
  });

  test("só ADMIN (purchases.revert); rascunho não pode ser desfeito; importação inexistente → 404", async () => {
    const { importId } = await importReceived();
    for (const user of [vendedor, estoquista]) {
      const res = await revert(importId, user);
      assert.equal(res.statusCode, 403, res.body);
    }
    assert.equal((await prisma.nfeImport.findUniqueOrThrow({ where: { id: importId } })).status, "CONFIRMED");

    const note = newNote();
    importKeys.push(note.key);
    supplierDocuments.push(note.cnpj);
    const draft = await upload(note);
    assert.equal(draft.statusCode, 201, draft.body);
    const res = await revert(draft.json().data.id);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "NFE_REVERT_BLOCKED");

    const missing = await revert(randomUUID());
    assert.equal(missing.statusCode, 404, missing.body);
    assert.equal(missing.json().code, "NFE_IMPORT_NOT_FOUND");
  });

  test("idempotente: a mesma Idempotency-Key repete a resposta sem desfazer de novo; sem a chave → 400", async () => {
    const { importId, purchaseId } = await importReceived();
    const noKey = await app.inject({ method: "POST", url: `/nfe-imports/${importId}/revert`, headers: { authorization: `Bearer ${admin.token}` } });
    assert.equal(noKey.statusCode, 400, noKey.body);
    assert.equal(noKey.json().code, "IDEMPOTENCY_KEY_REQUIRED");

    const key = newIdempotencyKey();
    const first = await revert(importId, admin, key);
    assert.equal(first.statusCode, 200, first.body);
    const second = await revert(importId, admin, key);
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(second.headers["idempotent-replayed"], "true");
    assert.deepEqual(second.json(), first.json());
    assert.equal(await prisma.stockMovement.count({ where: { originId: purchaseId, type: "OUT" } }), 4);
  });

  test("corrida venda × estorno no mesmo lote: exatamente uma vence e o estoque fecha", async () => {
    for (let round = 0; round < 3; round++) {
      const { importId, purchaseId, c } = await importReceived();
      const [sale, rev] = await Promise.all([sell(c, 1), revert(importId)]);
      const saleWon = sale.statusCode === 201;
      const revertWon = rev.statusCode === 200;
      assert.ok(saleWon !== revertWon, `venda ${sale.statusCode} ${sale.body} × estorno ${rev.statusCode} ${rev.body}`);
      if (saleWon) {
        assert.deepEqual(rev.json(), SOLD);
        assert.equal((await prisma.nfeImport.findUniqueOrThrow({ where: { id: importId } })).status, "CONFIRMED");
      } else {
        assert.equal(sale.statusCode, 422, sale.body);
        assert.equal(sale.json().code, "INSUFFICIENT_STOCK");
        assert.equal(await prisma.stockMovement.count({ where: { originId: purchaseId, type: "OUT" } }), 4);
      }
      const inventory = await inventoryOf(c);
      const lots = await prisma.inventoryLot.findMany({ where: { productVariantId: c } });
      assert.equal(inventory.quantity, 0);
      assert.equal(lots.reduce((sum, l) => sum + l.remainingQuantity, 0), 0);
    }
  });
});
