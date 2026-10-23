import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { makeCustomerService } from "@customer/infrastructure/http/factories/CustomerService";
import { makeInventoryService } from "@inventory/infrastructure/http/factories/InventoryServiceFactory";
import { FinancialService } from "@finance/application/services/FinacialService";
import { CreateSaleUseCase } from "@sales/application/useCases/commands/CreateSaleUseCase";
import { PrismaSaleRepository } from "@sales/infrastructure/prisma/repositories/PrismaSaleRepository";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/sales/", import.meta.url);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));
}

app.log.level = "silent";

const todayUtc = () => new Date().toISOString().slice(0, 10);
const addDaysUtc = (days: number) => {
  const d = new Date(`${todayUtc()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describe("HTTP de vendas", () => {
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

  // Variante com preço e estoque recebido (lote manual).
  const createPricedVariant = async (salePrice: number, stock = 10) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice } });
    if (stock > 0) {
      const res = await request("POST", "/inventory/lots", {
        productVariantId: variantId,
        batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
        quantity: stock,
        unitCost: 5,
        expirationDate: "2030-06-30T00:00:00.000Z",
      });
      assert.equal(res.statusCode, 200, res.body);
    }
    return variantId;
  };

  const inventoryQty = async (variantId: string) =>
    (await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: variantId } })).quantity;

  beforeEach(async () => {
    userId = await getTestUserId();
    token = jwt.sign({ sub: userId, role: "admin" }, process.env.JWT_SECRET!);
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

  test("POST /sales cria venda com total = Σ preço×qtd, sellerId do token, status COMPLETED", async () => {
    const v1 = await createPricedVariant(19.9);
    const v2 = await createPricedVariant(0.1);

    const res = await request("POST", "/sales", {
      customerId,
      items: [
        { productVariantId: v1, quantity: 3 },
        { productVariantId: v2, quantity: 3 },
      ],
      paymentTerms: { installments: 1 },
    });

    assert.equal(res.statusCode, 201, res.body);
    const sale = res.json().data;
    assert.equal(sale.totalAmount, 60);
    assert.equal(sale.status, "COMPLETED");
    assert.equal(sale.customer.id, customerId);
    assert.equal(sale.seller.id, userId);
    assert.equal(sale.seller.name, "tx-test-inventory");
    assert.equal(sale.items.length, 2);
    const item1 = sale.items.find((i: any) => i.productVariant.id === v1);
    assert.equal(item1.unitPrice, 19.9);
    assert.equal(item1.quantity, 3);
    assert.equal(item1.totalPrice, 59.7);

    const row = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    assert.equal(row.sellerId, userId);
    assert.equal(Number(row.totalAmount), 60);
    assert.equal(row.status, "COMPLETED");
    assert.equal(await inventoryQty(v1), 7);
  });

  test("POST /sales gera contas a receber com parcelas que somam o total", async () => {
    const v1 = await createPricedVariant(33.33);
    const first = addDaysUtc(30);

    const res = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: v1, quantity: 3 }],
      paymentTerms: { installments: 3, firstDueDate: first },
    });

    assert.equal(res.statusCode, 201, res.body);
    const sale = res.json().data;
    assert.equal(sale.totalAmount, 99.99);
    assert.equal(sale.receivable.status, "OPEN");
    assert.deepEqual(
      sale.receivable.parcels.map((p: any) => p.amount),
      [33.33, 33.33, 33.33],
    );
    assert.equal(sale.receivable.parcels[0].dueDate, first);
    assert.equal(sale.receivable.parcels[0].status, "OPEN");
    assert.equal(sale.receivable.parcels[0].paidAmount, 0);
    assert.equal(sale.receivable.parcels[0].remainingAmount, 33.33);

    const doc = await prisma.financialDocument.findFirstOrThrow({
      where: { originId: sale.id },
      include: { parcels: true },
    });
    assert.equal(doc.type, "RECEIVABLE");
    assert.equal(doc.originType, "SALE");
    assert.equal(doc.partyId, customerId);
    assert.equal(doc.partyType, "CUSTOMER");
    const sumCents = doc.parcels.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
    assert.equal(sumCents, 9999);
  });

  test("POST /sales 1x sem firstDueDate → vencimento hoje", async () => {
    const v1 = await createPricedVariant(10);
    const res = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: v1, quantity: 1 }],
      paymentTerms: { installments: 1 },
    });
    assert.equal(res.statusCode, 201, res.body);
    const parcels = res.json().data.receivable.parcels;
    assert.equal(parcels.length, 1);
    assert.equal(parcels[0].amount, 10);
    assert.equal(parcels[0].dueDate, todayUtc());
  });

  test("POST /sales variante com preço 0 → 422 VARIANT_WITHOUT_PRICE; nada gravado", async () => {
    const priced = await createPricedVariant(10);
    const free = await createPricedVariant(0);
    const movementsBefore = await prisma.stockMovement.count({
      where: { productVariantId: { in: [priced, free] } },
    });

    const res = await request("POST", "/sales", {
      customerId,
      items: [
        { productVariantId: priced, quantity: 1 },
        { productVariantId: free, quantity: 1 },
      ],
      paymentTerms: { installments: 1 },
    });

    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "VARIANT_WITHOUT_PRICE");
    assert.equal(await prisma.sale.count({ where: { customerId } }), 0);
    assert.equal(await prisma.financialDocument.count({ where: { partyId: customerId } }), 0);
    assert.equal(await inventoryQty(priced), 10);
    assert.equal(await inventoryQty(free), 10);
    assert.equal(
      await prisma.stockMovement.count({ where: { productVariantId: { in: [priced, free] } } }),
      movementsBefore,
    );
  });

  test("POST /sales 3x sem firstDueDate → 400 VALIDATION_ERROR field paymentTerms.firstDueDate", async () => {
    const res = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: randomUUID(), quantity: 1 }],
      paymentTerms: { installments: 3 },
    });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "VALIDATION_ERROR");
    assert.ok(
      res.json().errors.some((e: any) => e.field === "paymentTerms.firstDueDate"),
      res.body,
    );
  });

  test("POST /sales firstDueDate no passado → 400", async () => {
    const res = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: randomUUID(), quantity: 1 }],
      paymentTerms: { installments: 2, firstDueDate: addDaysUtc(-1) },
    });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "VALIDATION_ERROR");
    assert.ok(
      res.json().errors.some((e: any) => e.field === "paymentTerms.firstDueDate"),
      res.body,
    );
  });

  test("POST /sales installments fora de 1..12 ou data inválida → 400", async () => {
    for (const paymentTerms of [
      { installments: 0 },
      { installments: 13, firstDueDate: addDaysUtc(1) },
      { installments: 2, firstDueDate: "2026-02-30" },
      { installments: 2, firstDueDate: "30/11/2026" },
    ]) {
      const res = await request("POST", "/sales", {
        customerId,
        items: [{ productVariantId: randomUUID(), quantity: 1 }],
        paymentTerms,
      });
      assert.equal(res.statusCode, 400, `${JSON.stringify(paymentTerms)} → ${res.body}`);
    }
  });

  test("falha ao criar o financeiro desfaz venda e estoque", async () => {
    const v1 = await createPricedVariant(10);
    const movementsBefore = await prisma.stockMovement.count({ where: { productVariantId: v1 } });
    const failingFinance: FinancialService = {
      createSaleReceivable: async () => {
        throw new Error("financeiro indisponível");
      },
      cancelSaleReceivable: async () => {},
    };
    const useCase = new CreateSaleUseCase(
      new PrismaSaleRepository(),
      new PrismaTransactionManager(),
      makeCustomerService(),
      makeCatalogService(),
      makeInventoryService(),
      failingFinance,
    );

    await assert.rejects(
      useCase.execute({
        customerId,
        sellerId: userId,
        items: [{ productVariantId: v1, quantity: 4 }],
        paymentTerms: { installments: 1 },
      }),
      /financeiro indisponível/,
    );

    assert.equal(await prisma.sale.count({ where: { customerId } }), 0);
    assert.equal(await inventoryQty(v1), 10);
    assert.equal(await prisma.stockMovement.count({ where: { productVariantId: v1 } }), movementsBefore);
    const lots = await prisma.inventoryLot.findMany({ where: { productVariantId: v1 } });
    assert.equal(lots.reduce((s, l) => s + l.remainingQuantity, 0), 10);
  });

  test("movimentações OUT da venda têm originId = sale.id", async () => {
    const v1 = await createPricedVariant(10);
    const res = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: v1, quantity: 2 }],
      paymentTerms: { installments: 1 },
    });
    assert.equal(res.statusCode, 201, res.body);
    const saleId = res.json().data.id;

    const outs = await prisma.stockMovement.findMany({
      where: { productVariantId: v1, type: "OUT" },
    });
    assert.equal(outs.length, 1);
    assert.equal(outs[0].origin, "SALE");
    assert.equal(outs[0].originId, saleId);
    assert.equal(outs[0].quantity, 2);
  });

  test("GET /sales/:id → { data } com chaves iguais à fixture saleDetail.json", async () => {
    const v1 = await createPricedVariant(12.5);
    const created = await request("POST", "/sales", {
      customerId,
      items: [{ productVariantId: v1, quantity: 2 }],
      paymentTerms: { installments: 2, firstDueDate: addDaysUtc(30) },
    });
    assert.equal(created.statusCode, 201, created.body);
    const id = created.json().data.id;

    const res = await request("GET", `/sales/${id}`);
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.equal(body.data.id, id);
    assert.deepEqual(body.data, created.json().data);
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: v1 } });
    assert.deepEqual(body.data.items[0].productVariant, {
      id: v1,
      name: variant.name,
      code: variant.code,
      barcode: variant.barcode,
    });
    assert.deepEqual(keyShape(body), keyShape(loadFixture("saleDetail")), "chaves diferem de saleDetail.json");
    assert.deepEqual(keyShape(created.json()), keyShape(loadFixture("saleDetail")), "POST /sales difere de saleDetail.json");
  });

  test("GET /sales → { data, pagination } com itens iguais à fixture saleList.json", async () => {
    const v1 = await createPricedVariant(7);
    const v2 = await createPricedVariant(3);
    const created = await request("POST", "/sales", {
      customerId,
      items: [
        { productVariantId: v1, quantity: 1 },
        { productVariantId: v2, quantity: 2 },
      ],
      paymentTerms: { installments: 1 },
    });
    assert.equal(created.statusCode, 201, created.body);
    const id = created.json().data.id;

    const res = await request("GET", "/sales?page=1&limit=100");
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    const mine = body.data.find((s: any) => s.id === id);
    assert.ok(mine, "venda criada não aparece na lista");
    assert.equal(mine.itemsCount, 2);
    assert.equal(mine.totalAmount, 13);
    assert.deepEqual(mine.customer, { id: customerId, name: mine.customer.name });
    assert.deepEqual(keyShape({ ...body, data: [mine] }), keyShape(loadFixture("saleList")), "chaves diferem de saleList.json");
  });
});
