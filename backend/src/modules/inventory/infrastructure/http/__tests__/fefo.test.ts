import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

const addDays = (days: number) => {
  const d = new Date(`${todayInBusinessTz()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

describe("FEFO e lote vencido", () => {
  let token: string;
  let customerId: string;
  const variants: { id: string; cleanup: () => Promise<void> }[] = [];

  const request = (method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: withIdempotencyKey(method, { authorization: `Bearer ${token}` }),
    });

  const newVariant = async (name?: string) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { salePrice: 10, ...(name ? { name } : {}) },
    });
    return variantId;
  };

  const addLot = async (variantId: string, quantity: number, expiresInDays?: number, batch?: string) => {
    const res = await request("POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: batch ?? `tx-test-${randomUUID().slice(0, 8)}`,
      quantity,
      unitCost: 5,
      expirationDate: addDays(expiresInDays ?? 1),
    });
    assert.equal(res.statusCode, 200, res.body);
    const id = res.json().data.id as string;
    // O endpoint exige validade; lote sem validade (ex.: contagem) vem do banco.
    if (expiresInDays === undefined) {
      await prisma.inventoryLot.update({ where: { id }, data: { expirationDate: null } });
    }
    return id;
  };

  const remaining = async (lotId: string) =>
    (await prisma.inventoryLot.findUniqueOrThrow({ where: { id: lotId } })).remainingQuantity;

  const sell = (items: { productVariantId: string; quantity: number }[]) =>
    request("POST", "/sales", { customerId, items, paymentTerms: { installments: 1 } });

  beforeEach(async () => {
    token = signTestToken(await getTestUserId());
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    const toClean = variants.splice(0);
    try {
      try {
        await prisma.financialDocument.deleteMany({ where: { partyId: customerId } });
      } finally {
        await prisma.sale.deleteMany({ where: { customerId } });
      }
    } finally {
      try {
        for (const v of toClean) await v.cleanup();
      } finally {
        await prisma.customer.deleteMany({ where: { id: customerId } });
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

  test("venda consome B (vence dia 5), depois A (dia 10), depois C (sem validade)", async () => {
    const v = await newVariant();
    const c = await addLot(v, 2); // sem validade, criado primeiro
    const a = await addLot(v, 2, 10);
    const b = await addLot(v, 2, 5);

    assert.equal((await sell([{ productVariantId: v, quantity: 3 }])).statusCode, 201);
    assert.equal(await remaining(b), 0);
    assert.equal(await remaining(a), 1);
    assert.equal(await remaining(c), 2);

    assert.equal((await sell([{ productVariantId: v, quantity: 3 }])).statusCode, 201);
    assert.equal(await remaining(a), 0);
    assert.equal(await remaining(c), 0);
  });

  test("lote vencido ontem não é vendido; vence hoje é vendido", async () => {
    const v = await newVariant();
    const yesterday = await addLot(v, 1, -1);
    const today = await addLot(v, 1, 0);

    assert.equal((await sell([{ productVariantId: v, quantity: 1 }])).statusCode, 201);
    assert.equal(await remaining(today), 0);
    assert.equal(await remaining(yesterday), 1);
  });

  test("saldo vencido cobre a falta → 409 EXPIRED_STOCK_ONLY com a mensagem e o item; venda de 2 passa", async () => {
    const v = await newVariant("Camiseta Teste");
    await addLot(v, 5, -3);
    await addLot(v, 2, 30);

    const res = await sell([{ productVariantId: v, quantity: 3 }]);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "EXPIRED_STOCK_ONLY");
    assert.equal(
      res.json().message,
      "Estoque insuficiente para Camiseta Teste: 2 disponível(is) dentro da validade; 5 vencida(s) — dê baixa manual dos vencidos.",
    );
    assert.equal(res.json().details.productVariantId, v);

    assert.equal((await sell([{ productVariantId: v, quantity: 2 }])).statusCode, 201);
  });

  test("sem vencidos suficientes → 422 INSUFFICIENT_STOCK sem a parte de vencidos", async () => {
    const v = await newVariant("Camiseta Teste");
    await addLot(v, 2, 30);
    const res = await sell([{ productVariantId: v, quantity: 3 }]);
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "INSUFFICIENT_STOCK");
    assert.equal(
      res.json().message,
      "Estoque insuficiente para Camiseta Teste: 2 disponível(is) dentro da validade.",
    );
    assert.equal(res.json().details.productVariantId, v);
  });

  test("venda multi-item é atômica: segundo item recusado não baixa o primeiro", async () => {
    const ok = await newVariant();
    const bad = await newVariant();
    const okLot = await addLot(ok, 5, 30);
    await addLot(bad, 5, -2);

    const res = await sell([
      { productVariantId: ok, quantity: 2 },
      { productVariantId: bad, quantity: 1 },
    ]);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().details.productVariantId, bad);
    assert.equal(await remaining(okLot), 5);
  });

  test("cancelar venda devolve aos lotes consumidos", async () => {
    const v = await newVariant();
    const b = await addLot(v, 2, 5);
    const a = await addLot(v, 2, 10);
    const sale = (await sell([{ productVariantId: v, quantity: 3 }])).json().data;
    assert.equal(await remaining(b), 0);
    const cancel = await request("POST", `/sales/${sale.id}/cancel`);
    assert.equal(cancel.statusCode, 200, cancel.body);
    assert.equal(await remaining(b), 2);
    assert.equal(await remaining(a), 2);
  });

  test("saída manual com inventoryLotId baixa o lote vencido escolhido", async () => {
    const v = await newVariant();
    const expired = await addLot(v, 3, -5);
    const valid = await addLot(v, 3, 30);
    const res = await request("POST", "/inventory/dispatch", {
      productVariantId: v,
      quantity: 2,
      origin: "MANUAL",
      inventoryLotId: expired,
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(await remaining(expired), 1);
    assert.equal(await remaining(valid), 3);
    assert.equal(res.json().data[0].inventoryLotId, expired);
  });

  test("saída manual sem lote usa FEFO incluindo vencidos (vencido sai primeiro)", async () => {
    const v = await newVariant();
    const valid = await addLot(v, 3, 30);
    const expired = await addLot(v, 3, -5);
    const res = await request("POST", "/inventory/dispatch", { productVariantId: v, quantity: 4, origin: "MANUAL" });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(await remaining(expired), 0);
    assert.equal(await remaining(valid), 2);
  });

  test("saída manual com lote de outro inventário → 404 LOT_NOT_FOUND; acima do saldo do lote → 422", async () => {
    const v = await newVariant();
    const other = await newVariant();
    await addLot(v, 3, 30);
    const foreign = await addLot(other, 3, 30);
    const own = await addLot(v, 1, 30);

    const r1 = await request("POST", "/inventory/dispatch", {
      productVariantId: v, quantity: 1, origin: "MANUAL", inventoryLotId: foreign,
    });
    assert.equal(r1.statusCode, 404, r1.body);
    assert.equal(r1.json().code, "LOT_NOT_FOUND");

    const r2 = await request("POST", "/inventory/dispatch", {
      productVariantId: v, quantity: 2, origin: "MANUAL", inventoryLotId: own,
    });
    assert.equal(r2.statusCode, 422, r2.body);
    assert.equal(r2.json().code, "INSUFFICIENT_STOCK");
    assert.equal(await remaining(own), 1);
  });

  test("detalhe e saldos em lote informam expired", async () => {
    const v = await newVariant();
    await addLot(v, 4, -1);
    await addLot(v, 6, 30);
    await addLot(v, 2);
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: v } });

    const detail = await request("GET", `/inventory/${inv.id}`);
    assert.equal(detail.json().data.expired, 4);
    assert.equal(detail.json().data.availableQuantity, 12);

    const balances = await request("GET", `/inventory?productVariantIds=${v}`);
    assert.equal(balances.json().data[0].expired, 4);
    assert.equal(balances.json().data[0].available, 12);
  });
});
