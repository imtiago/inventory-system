import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { InternalInvariantError } from "@shared/domain/errors";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

const addDaysUtc = (days: number) => {
  const d = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describe("POST /sales/:id/cancel", () => {
  let token: string;
  let userId: string;
  let customerId: string;
  const variants: { id: string; cleanup: () => Promise<void> }[] = [];

  const request = (method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: { authorization: `Bearer ${token}` },
    });

  const receiveLot = async (variantId: string, quantity: number, unitCost: number) => {
    const res = await request("POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity,
      unitCost,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
  };

  const createPricedVariant = async (salePrice: number, lots: [number, number][] = [[10, 5]]) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice } });
    for (const [quantity, unitCost] of lots) await receiveLot(variantId, quantity, unitCost);
    return variantId;
  };

  const createSale = async (
    items: { productVariantId: string; quantity: number }[],
    paymentTerms: { installments: number; firstDueDate?: string } = { installments: 1 },
  ) => {
    const res = await request("POST", "/sales", { customerId, items, paymentTerms });
    assert.equal(res.statusCode, 201, res.body);
    return res.json().data.id as string;
  };

  const inventoryQty = async (variantId: string) =>
    (await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: variantId } })).quantity;

  const lotsOf = (variantId: string) =>
    prisma.inventoryLot.findMany({ where: { productVariantId: variantId }, orderBy: { id: "asc" } });

  beforeEach(async () => {
    userId = await getTestUserId();
    token = signTestToken(userId);
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    const id = customerId;
    const toClean = variants.splice(0);
    try {
      try {
        await prisma.financialDocument.deleteMany({ where: { partyId: id } });
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
      await app.close();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("cancelar devolve a cada lote exatamente o que saiu dele (venda que consumiu 2 lotes)", async () => {
    const v1 = await createPricedVariant(10, [[3, 5], [5, 7]]);
    const lotsBefore = await lotsOf(v1);
    assert.equal(lotsBefore.length, 2);

    const saleId = await createSale([{ productVariantId: v1, quantity: 6 }]);
    const outs = await prisma.stockMovement.findMany({
      where: { productVariantId: v1, type: "OUT", originId: saleId },
    });
    assert.equal(outs.length, 2, "a venda deveria consumir os dois lotes");
    assert.equal(await inventoryQty(v1), 2);

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 200, res.body);

    const lotsAfter = await lotsOf(v1);
    assert.deepEqual(
      lotsAfter.map((l) => [l.id, l.remainingQuantity, l.initialQuantity]),
      lotsBefore.map((l) => [l.id, l.remainingQuantity, l.initialQuantity]),
    );
    assert.equal(await inventoryQty(v1), 8);

    const returns = await prisma.stockMovement.findMany({
      where: { productVariantId: v1, origin: "RETURN", originId: saleId },
    });
    const perLot = (ms: { inventoryLotId: string | null; quantity: number }[]) =>
      ms.map((m) => [m.inventoryLotId, m.quantity]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    assert.deepEqual(perLot(returns), perLot(outs));
  });

  test("cancelar gera movimentações IN origin RETURN com originId da venda e saldos encadeados", async () => {
    const v1 = await createPricedVariant(10, [[3, 5], [5, 7]]);
    const v2 = await createPricedVariant(4, [[10, 2]]);
    const saleId = await createSale([
      { productVariantId: v1, quantity: 6 },
      { productVariantId: v2, quantity: 4 },
    ]);

    const outs = await prisma.stockMovement.findMany({ where: { originId: saleId, type: "OUT" } });
    assert.equal(outs.length, 3);
    for (const m of outs) assert.equal(m.userId, userId, "OUT deve registrar o vendedor");

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 200, res.body);

    const returns = await prisma.stockMovement.findMany({
      where: { originId: saleId, origin: "RETURN" },
    });
    assert.equal(returns.length, 3);
    for (const m of returns) {
      assert.equal(m.type, "IN");
      assert.ok(m.inventoryLotId, "RETURN deve indicar o lote");
      assert.equal(m.userId, userId, "RETURN deve registrar o usuário autenticado");
    }

    const v1Returns = returns
      .filter((m) => m.productVariantId === v1)
      .sort((a, b) => a.previousQuantity! - b.previousQuantity!);
    assert.equal(v1Returns.length, 2);
    assert.equal(v1Returns[0].previousQuantity, 2);
    assert.equal(v1Returns[0].currentQuantity, 2 + v1Returns[0].quantity);
    assert.equal(v1Returns[1].previousQuantity, v1Returns[0].currentQuantity);
    assert.equal(v1Returns[1].currentQuantity, 8);

    const v2Returns = returns.filter((m) => m.productVariantId === v2);
    assert.deepEqual(
      v2Returns.map((m) => [m.quantity, m.previousQuantity, m.currentQuantity]),
      [[4, 6, 10]],
    );
    assert.equal(await inventoryQty(v2), 10);
  });

  test("cancelar marca o documento CANCELED e as parcelas aparecem CANCELED no detalhe", async () => {
    const v1 = await createPricedVariant(10);
    const saleId = await createSale([{ productVariantId: v1, quantity: 3 }], {
      installments: 3,
      firstDueDate: addDaysUtc(30),
    });

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 200, res.body);
    const data = res.json().data;
    assert.equal(data.id, saleId);
    assert.equal(data.status, "CANCELED");
    assert.equal(data.receivable.status, "CANCELED");
    assert.equal(data.receivable.parcels.length, 3);
    for (const p of data.receivable.parcels) assert.equal(p.status, "CANCELED");

    const doc = await prisma.financialDocument.findFirstOrThrow({ where: { originId: saleId } });
    assert.equal(doc.status, "CANCELED");
    const row = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(row.status, "CANCELED");

    const detail = await request("GET", `/sales/${saleId}`);
    assert.deepEqual(detail.json().data, data);
  });

  test("cancelar de novo → 409 SALE_ALREADY_CANCELED", async () => {
    const v1 = await createPricedVariant(10);
    const saleId = await createSale([{ productVariantId: v1, quantity: 2 }]);

    assert.equal((await request("POST", `/sales/${saleId}/cancel`)).statusCode, 200);
    const movementsAfterFirst = await prisma.stockMovement.count({ where: { productVariantId: v1 } });

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "SALE_ALREADY_CANCELED");
    assert.equal(await inventoryQty(v1), 10);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: v1 } }), movementsAfterFirst);
  });

  test("dois cancelamentos simultâneos → exatamente um 409; estoque devolvido uma vez", async () => {
    const v1 = await createPricedVariant(10, [[3, 5], [5, 7]]);
    const saleId = await createSale([{ productVariantId: v1, quantity: 6 }]);

    const results = await Promise.allSettled([
      request("POST", `/sales/${saleId}/cancel`),
      request("POST", `/sales/${saleId}/cancel`),
    ]);
    const codes = results.map((r) => {
      assert.equal(r.status, "fulfilled");
      return (r as PromiseFulfilledResult<Awaited<ReturnType<typeof request>>>).value;
    });
    assert.deepEqual(
      codes.map((r) => r.statusCode).sort(),
      [200, 409],
      codes.map((r) => r.body).join(" | "),
    );
    assert.equal(codes.find((r) => r.statusCode === 409)!.json().code, "SALE_ALREADY_CANCELED");

    assert.equal(await inventoryQty(v1), 8);
    const lots = await lotsOf(v1);
    assert.deepEqual(lots.map((l) => l.remainingQuantity).sort(), [3, 5]);
    assert.equal(
      await prisma.stockMovement.count({ where: { originId: saleId, origin: "RETURN" } }),
      2,
    );
  });

  test("venda com pagamento registrado → 409 SALE_HAS_PAYMENTS; nada alterado", async () => {
    const v1 = await createPricedVariant(10);
    const saleId = await createSale([{ productVariantId: v1, quantity: 2 }], {
      installments: 2,
      firstDueDate: addDaysUtc(30),
    });
    const doc = await prisma.financialDocument.findFirstOrThrow({
      where: { originId: saleId },
      include: { parcels: true },
    });
    await prisma.payment.create({
      data: { parcelId: doc.parcels[0].id, amount: 5, method: "PIX" },
    });
    const movementsBefore = await prisma.stockMovement.count({ where: { productVariantId: v1 } });
    const lotsBefore = await lotsOf(v1);

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "SALE_HAS_PAYMENTS");
    assert.equal(res.json().message, "Venda com pagamentos registrados não pode ser cancelada.");

    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status, "COMPLETED");
    assert.equal((await prisma.financialDocument.findUniqueOrThrow({ where: { id: doc.id } })).status, "OPEN");
    assert.equal(await inventoryQty(v1), 8);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: v1 } }), movementsBefore);
    assert.deepEqual(await lotsOf(v1), lotsBefore);
  });

  test("venda com itens sem saídas rastreadas → 500 e nada alterado (rollback)", async () => {
    const v1 = await createPricedVariant(10);
    const saleId = await createSale([{ productVariantId: v1, quantity: 2 }]);
    // Simula venda antiga / dado inconsistente: saídas sem originId.
    await prisma.stockMovement.updateMany({ where: { originId: saleId }, data: { originId: null } });
    const movementsBefore = await prisma.stockMovement.count({ where: { productVariantId: v1 } });

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 500, res.body);

    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status, "COMPLETED");
    const doc = await prisma.financialDocument.findFirstOrThrow({ where: { originId: saleId } });
    assert.equal(doc.status, "OPEN");
    assert.equal(await inventoryQty(v1), 8);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: v1 } }), movementsBefore);
  });

  test("cancela todos os documentos a receber da venda", async () => {
    const v1 = await createPricedVariant(10);
    const saleId = await createSale([{ productVariantId: v1, quantity: 1 }]);
    const extra = await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "SALE",
        originId: saleId,
        partyId: customerId,
        partyType: "CUSTOMER",
        parcels: { create: [{ amount: 1, dueDate: new Date() }] },
      },
    });

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 200, res.body);
    const docs = await prisma.financialDocument.findMany({ where: { originId: saleId } });
    assert.equal(docs.length, 2);
    assert.ok(docs.some((d) => d.id === extra.id));
    for (const d of docs) assert.equal(d.status, "CANCELED");
  });

  test("pagamento em qualquer documento da venda → 409 SALE_HAS_PAYMENTS", async () => {
    const v1 = await createPricedVariant(10);
    const saleId = await createSale([{ productVariantId: v1, quantity: 1 }]);
    await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "SALE",
        originId: saleId,
        partyId: customerId,
        partyType: "CUSTOMER",
        parcels: {
          create: [{ amount: 1, dueDate: new Date(), payments: { create: [{ amount: 1, method: "CASH" }] } }],
        },
      },
    });

    const res = await request("POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "SALE_HAS_PAYMENTS");
    const docs = await prisma.financialDocument.findMany({ where: { originId: saleId } });
    for (const d of docs) assert.equal(d.status, "OPEN");
  });

  test("lockByOrigin fora de transação → InternalInvariantError", async () => {
    await assert.rejects(
      new PrismaFinancialDocumentRepository().lockByOrigin(
        FinancialType.RECEIVABLE,
        FinancialOriginType.SALE,
        randomUUID(),
      ),
      (e: unknown) => e instanceof InternalInvariantError && e.code === "LOCK_OUTSIDE_TRANSACTION",
    );
  });

  test("venda inexistente → 404 SALE_NOT_FOUND", async () => {
    const res = await request("POST", `/sales/${randomUUID()}/cancel`);
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "SALE_NOT_FOUND");
  });

  test("id inválido → 400 VALIDATION_ERROR", async () => {
    const res = await request("POST", "/sales/nao-e-uuid/cancel");
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "VALIDATION_ERROR");
  });
});
