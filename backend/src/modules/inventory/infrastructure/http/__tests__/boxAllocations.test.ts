import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { newIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

/**
 * Spec §5: Σ alocações em caixas ≤ saldo do lote. Saída, venda e ajuste para
 * baixo abatem as alocações mais antigas primeiro; devolução não realoca.
 */
describe("Estoque em caixas consistente com o saldo do lote", () => {
  let token: string;
  let customerId: string;
  const variants: (() => Promise<void>)[] = [];
  const boxIds: string[] = [];
  const usedKeys: string[] = [];

  const key = () => {
    const k = newIdempotencyKey();
    usedKeys.push(k);
    return k;
  };

  const call = (method: "GET" | "POST", url: string, payload?: unknown, idemKey?: string) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: {
        authorization: `Bearer ${token}`,
        ...(method === "POST" ? { "idempotency-key": idemKey ?? key() } : {}),
      },
    });

  const variant = async (salePrice?: number) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push(cleanup);
    if (salePrice !== undefined) {
      await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice } });
    }
    return variantId;
  };

  const lot = async (productVariantId: string, quantity: number): Promise<string> => {
    const res = await call("POST", "/inventory/lots", {
      productVariantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity,
      unitCost: 2,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
    return res.json().data.id;
  };

  const box = async (): Promise<string> => {
    const created = await prisma.inventoryBox.create({ data: { code: `tx-test-${randomUUID()}` } });
    boxIds.push(created.id);
    return created.id;
  };

  /** Aloca pela rota e fixa o createdAt (ordem determinística das alocações). */
  const allocate = async (inventoryLotId: string, boxId: string, quantity: number, day: number) => {
    const res = await call("POST", `/inventory/boxes/${boxId}/items`, { inventoryLotId, quantity });
    assert.equal(res.statusCode, 200, res.body);
    await prisma.inventoryBoxStock.update({
      where: { inventoryLotId_boxId: { inventoryLotId, boxId } },
      data: { createdAt: new Date(Date.UTC(2020, 0, day)) },
    });
  };

  const allocations = async (inventoryLotId: string) =>
    (
      await prisma.inventoryBoxStock.findMany({
        where: { inventoryLotId },
        orderBy: { createdAt: "asc" },
      })
    ).map((a) => [a.boxId, a.quantity]);

  const remaining = async (lotId: string) =>
    (await prisma.inventoryLot.findUniqueOrThrow({ where: { id: lotId } })).remainingQuantity;

  const assertInvariant = async (lotId: string) => {
    const sum = (await allocations(lotId)).reduce((t, [, q]) => t + (q as number), 0);
    assert.ok(sum <= (await remaining(lotId)), `Σ alocado ${sum} > saldo ${await remaining(lotId)}`);
  };

  beforeEach(async () => {
    token = signTestToken(await getTestUserId());
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    const id = customerId;
    const cleanups = variants.splice(0);
    const boxes = boxIds.splice(0);
    try {
      try {
        await prisma.financialDocument.deleteMany({ where: { partyId: id } });
      } finally {
        await prisma.sale.deleteMany({ where: { customerId: id } });
      }
    } finally {
      try {
        for (const cleanup of cleanups) await cleanup();
      } finally {
        try {
          await prisma.inventoryBoxStock.deleteMany({ where: { boxId: { in: boxes } } });
          await prisma.inventoryBox.deleteMany({ where: { id: { in: boxes } } });
        } finally {
          await prisma.customer.deleteMany({ where: { id } });
        }
      }
    }
  });

  after(async () => {
    try {
      await prisma.idempotencyRecord.deleteMany({ where: { key: { in: usedKeys } } });
      await app.close();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("saída manual reduz as alocações mais antigas primeiro e apaga as que zeram", async () => {
    const v = await variant();
    const l = await lot(v, 10);
    const [older, newer] = [await box(), await box()];
    await allocate(l, newer, 5, 2);
    await allocate(l, older, 4, 1);

    const res = await call("POST", "/inventory/dispatch", { productVariantId: v, quantity: 6, origin: "MANUAL" });
    assert.equal(res.statusCode, 200, res.body);

    // saldo 4, Σ 9 → excesso 5: a mais antiga (4) some, a nova cai de 5 para 4
    assert.deepEqual(await allocations(l), [[newer, 4]]);
    await assertInvariant(l);
  });

  test("saída que não estoura a invariante deixa as alocações intactas", async () => {
    const v = await variant();
    const l = await lot(v, 10);
    const [a, b] = [await box(), await box()];
    await allocate(l, a, 3, 1);
    await allocate(l, b, 2, 2);
    const before = await prisma.inventoryBoxStock.findMany({ where: { inventoryLotId: l }, orderBy: { id: "asc" } });

    const res = await call("POST", "/inventory/dispatch", { productVariantId: v, quantity: 5, origin: "MANUAL" });
    assert.equal(res.statusCode, 200, res.body);

    const afterRows = await prisma.inventoryBoxStock.findMany({ where: { inventoryLotId: l }, orderBy: { id: "asc" } });
    assert.deepEqual(afterRows, before);
  });

  test("ajuste para baixo reduz as alocações mais antigas primeiro", async () => {
    const v = await variant();
    const l = await lot(v, 10);
    const [older, newer] = [await box(), await box()];
    await allocate(l, older, 6, 1);
    await allocate(l, newer, 4, 2);

    const res = await call("POST", "/inventory/adjust", { productVariantId: v, countedQuantity: 7 });
    assert.equal(res.statusCode, 200, res.body);

    assert.deepEqual(await allocations(l), [
      [older, 3],
      [newer, 4],
    ]);
    await assertInvariant(l);
  });

  test("venda reduz as alocações; o cancelamento devolve o saldo sem realocar em caixa", async () => {
    const v = await variant(10);
    const l = await lot(v, 10);
    const b = await box();
    await allocate(l, b, 8, 1);

    const sale = await call("POST", "/sales", {
      customerId,
      items: [{ productVariantId: v, quantity: 5 }],
      paymentTerms: { installments: 1 },
    });
    assert.equal(sale.statusCode, 201, sale.body);
    assert.deepEqual(await allocations(l), [[b, 5]]);
    await assertInvariant(l);

    const cancel = await call("POST", `/sales/${sale.json().data.id}/cancel`, {});
    assert.equal(cancel.statusCode, 200, cancel.body);
    assert.equal(await remaining(l), 10);
    assert.deepEqual(await allocations(l), [[b, 5]]);
  });

  describe("POST /inventory/boxes/:boxId/items/remove", () => {
    const remove = (boxId: string, body: unknown, idemKey?: string) =>
      call("POST", `/inventory/boxes/${boxId}/items/remove`, body, idemKey);

    test("retira da caixa sem mexer no saldo; retirar tudo apaga a alocação", async () => {
      const v = await variant();
      const l = await lot(v, 10);
      const b = await box();
      await allocate(l, b, 6, 1);

      const res = await remove(b, { inventoryLotId: l, quantity: 2 });
      assert.equal(res.statusCode, 200, res.body);
      assert.deepEqual(
        { ...res.json().data, id: undefined },
        { id: undefined, boxId: b, inventoryLotId: l, quantity: 4 },
      );
      assert.deepEqual(await allocations(l), [[b, 4]]);
      assert.equal(await remaining(l), 10);

      const all = await remove(b, { inventoryLotId: l, quantity: 4 });
      assert.equal(all.statusCode, 200, all.body);
      assert.equal(all.json().data.quantity, 0);
      assert.deepEqual(await allocations(l), []);
    });

    test("mesma chave → retira uma vez só e repete a resposta", async () => {
      const v = await variant();
      const l = await lot(v, 10);
      const b = await box();
      await allocate(l, b, 6, 1);
      const k = key();

      const first = await remove(b, { inventoryLotId: l, quantity: 2 }, k);
      assert.equal(first.statusCode, 200, first.body);
      const second = await remove(b, { inventoryLotId: l, quantity: 2 }, k);
      assert.equal(second.statusCode, 200, second.body);
      assert.equal(second.headers["idempotent-replayed"], "true");
      assert.deepEqual(second.json(), first.json());
      assert.deepEqual(await allocations(l), [[b, 4]]);
    });

    test("acima do alocado nesta caixa → 422 BOX_STOCK_INSUFFICIENT sem gravar", async () => {
      const v = await variant();
      const l = await lot(v, 10);
      const [b, empty] = [await box(), await box()];
      await allocate(l, b, 3, 1);

      for (const [boxId, quantity] of [
        [b, 4],
        [empty, 1],
      ] as const) {
        const res = await remove(boxId, { inventoryLotId: l, quantity });
        assert.equal(res.statusCode, 422, res.body);
        assert.deepEqual(res.json(), {
          message: "Quantidade maior que a alocada nesta caixa.",
          code: "BOX_STOCK_INSUFFICIENT",
        });
      }
      assert.deepEqual(await allocations(l), [[b, 3]]);
    });

    test("caixa ou lote inexistente → 404; corpo inválido → 400", async () => {
      const v = await variant();
      const l = await lot(v, 10);
      const b = await box();

      const noBox = await remove(randomUUID(), { inventoryLotId: l, quantity: 1 });
      assert.equal(noBox.statusCode, 404, noBox.body);
      assert.equal(noBox.json().code, "BOX_NOT_FOUND");

      const noLot = await remove(b, { inventoryLotId: randomUUID(), quantity: 1 });
      assert.equal(noLot.statusCode, 404, noLot.body);
      assert.equal(noLot.json().code, "LOT_NOT_FOUND");

      for (const body of [
        { inventoryLotId: "x", quantity: 1 },
        { inventoryLotId: l, quantity: 0 },
        { inventoryLotId: l, quantity: 1.5 },
        { inventoryLotId: l, quantity: 1_000_001 },
      ]) {
        const res = await remove(b, body);
        assert.equal(res.statusCode, 400, `${JSON.stringify(body)} → ${res.body}`);
      }
      const badBox = await remove("x", { inventoryLotId: l, quantity: 1 });
      assert.equal(badBox.statusCode, 400, badBox.body);
    });
  });
});
