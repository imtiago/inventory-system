import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { BusinessRuleError, NotFoundError } from "@shared/domain/errors";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { makeReceiveInventory } from "@inventory/infrastructure/http/factories/ReceiveInventoryFactory";
import { makeDispatchInventory } from "@inventory/infrastructure/http/factories/DispatchInventoryFactory";
import { makeAddProductToBoxUseCase } from "@inventory/infrastructure/http/factories/AddProductToBoxFactory";
import { InventoryApplicationService } from "@inventory/application/services/InventoryApplicationService";
import { InventoryService } from "@inventory/application/services/InventoryService";
import { DispatchInventoryUseCase } from "@inventory/application/useCases/commands/DispatchInventoryUseCase";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { ReserveInventoryUseCase } from "@inventory/application/useCases/commands/ReserveInventoryUseCase";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { CreateSaleUseCase } from "@sales/application/useCases/commands/CreateSaleUseCase";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";
import { Sale } from "@sales/domain/entities/Sale";
import { CustomerService } from "@customer/application/services/CustomerService";
import { FinancialService } from "@finance/application/services/FinacialService";
import { FakeCatalogService, makeVariant } from "../../__tests__/fakes";
import { createTestVariant, getTestUserId } from "../../../../../test/inventoryFixtures";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isBusiness = (code: string) => (r: PromiseSettledResult<unknown>) =>
  r.status === "rejected" &&
  r.reason instanceof BusinessRuleError &&
  r.reason.code === code;

describe("concorrência de estoque (use cases reais + Postgres)", () => {
  const cleanups: Array<() => Promise<unknown>> = [];
  const receive = makeReceiveInventory();
  const dispatch = makeDispatchInventory();
  const addToBox = makeAddProductToBoxUseCase();
  const reserve = new ReserveInventoryUseCase(
    new PrismaInventoryRepository(),
    new PrismaStockMovementRepository(),
    new PrismaTransactionManager(),
  );
  let userId: string;

  async function newVariant() {
    const v = await createTestVariant();
    cleanups.push(v.cleanup);
    return v.variantId;
  }

  async function newBox() {
    const box = await prisma.inventoryBox.create({
      data: { code: `tx-test-box-${randomUUID()}` },
    });
    // Caixas são removidas depois das variantes (cuja limpeza apaga os InventoryBoxStock).
    cleanups.push(() => prisma.inventoryBox.deleteMany({ where: { id: box.id } }));
    return box.id;
  }

  const receiveInput = (productVariantId: string, quantity: number, batchNumber?: string) => ({
    productVariantId,
    quantity,
    unitCost: 2,
    batchNumber,
    origin: StockMovementOrigin.PURCHASE,
    sourceType: InventoryLotSource.PURCHASE,
    userId,
  });

  const dispatchInput = (productVariantId: string, quantity: number) => ({
    productVariantId,
    quantity,
    origin: StockMovementOrigin.SALE,
    userId,
  });

  async function state(variantId: string) {
    const inventories = await prisma.inventory.findMany({ where: { productVariantId: variantId } });
    const lots = await prisma.inventoryLot.findMany({ where: { productVariantId: variantId } });
    const movements = await prisma.stockMovement.findMany({ where: { productVariantId: variantId } });
    return {
      inventories,
      inventory: inventories[0],
      lots,
      lotSum: lots.reduce((s, l) => s + l.remainingQuantity, 0),
      movements,
    };
  }

  after(async () => {
    try {
      // Na ordem de registro: cada caixa é registrada depois da variante cujos
      // InventoryBoxStock a limpeza da variante apaga. Cada limpeza é independente.
      for (const c of cleanups) {
        try {
          await c();
        } catch (e) {
          console.error("cleanup falhou", e);
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("setup: usuário de teste", async () => {
    userId = await getTestUserId();
  });

  test("dois dispatch de 4 com saldo 5 → exatamente um INSUFFICIENT_STOCK; saldo 1; soma lotes = saldo", async () => {
    const variantId = await newVariant();
    await receive.execute(receiveInput(variantId, 5));

    const results = await Promise.allSettled([
      dispatch.execute(dispatchInput(variantId, 4)),
      dispatch.execute(dispatchInput(variantId, 4)),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));
    assert.equal(results.filter(isBusiness("INSUFFICIENT_STOCK")).length, 1);
    const s = await state(variantId);
    assert.equal(s.inventory.quantity, 1);
    assert.equal(s.lotSum, s.inventory.quantity);
  });

  test("5 receives simultâneos de 3 no mesmo batch → 1 lote com 15, saldo 15, movimentações encadeadas", async () => {
    const variantId = await newVariant();
    const batch = `tx-test-batch-${randomUUID()}`;

    // 1º recebimento sozinho (cria inventário e lote); os outros 4 disputam o mesmo lote.
    await receive.execute(receiveInput(variantId, 3, batch));
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => receive.execute(receiveInput(variantId, 3, batch))),
    );

    assert.deepEqual(
      results.map((r) => (r.status === "rejected" ? String(r.reason) : "ok")),
      ["ok", "ok", "ok", "ok"],
    );
    const s = await state(variantId);
    assert.equal(s.inventories.length, 1);
    assert.equal(s.inventory.quantity, 15);
    assert.equal(s.lots.length, 1);
    assert.equal(s.lots[0].remainingQuantity, 15);
    assert.equal(s.lots[0].initialQuantity, 15);
    const chain = s.movements
      .map((m) => [m.previousQuantity, m.currentQuantity])
      .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
    assert.deepEqual(chain, [[0, 3], [3, 6], [6, 9], [9, 12], [12, 15]]);
  });

  test("primeiro receive simultâneo de variante nova → 1 inventário", async () => {
    const variantId = await newVariant();

    const results = await Promise.allSettled([
      receive.execute(receiveInput(variantId, 2)),
      receive.execute(receiveInput(variantId, 3)),
      receive.execute(receiveInput(variantId, 4)),
    ]);

    assert.deepEqual(
      results.map((r) => (r.status === "rejected" ? String(r.reason) : "ok")),
      ["ok", "ok", "ok"],
    );
    const s = await state(variantId);
    assert.equal(s.inventories.length, 1);
    assert.equal(s.inventory.quantity, 9);
    assert.equal(s.lotSum, 9);
  });

  test("dois AddProductToBox que juntos excedem o lote → exatamente um BOX_LIMIT_EXCEEDED; alocado ≤ restante", async () => {
    const variantId = await newVariant();
    const { lot } = await receive.execute(receiveInput(variantId, 10));
    const boxA = await newBox();
    const boxB = await newBox();

    const results = await Promise.allSettled([
      addToBox.execute({ inventoryLotId: lot.id, boxId: boxA, quantity: 6 }),
      addToBox.execute({ inventoryLotId: lot.id, boxId: boxB, quantity: 6 }),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));
    assert.equal(results.filter(isBusiness("BOX_LIMIT_EXCEEDED")).length, 1);
    const allocated = await prisma.inventoryBoxStock.aggregate({
      where: { inventoryLotId: lot.id },
      _sum: { quantity: true },
    });
    const dbLot = await prisma.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
    assert.ok((allocated._sum.quantity ?? 0) <= dbLot.remainingQuantity);
  });

  test("reserve concorrente acima do disponível → um recusado; reservado ≤ saldo", async () => {
    const variantId = await newVariant();
    await receive.execute(receiveInput(variantId, 5));

    const results = await Promise.allSettled([
      reserve.execute({ productVariantId: variantId, quantity: 4, userId }),
      reserve.execute({ productVariantId: variantId, quantity: 4, userId }),
    ]);

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));
    assert.equal(results.filter(isBusiness("INSUFFICIENT_STOCK")).length, 1);
    const s = await state(variantId);
    assert.equal(s.inventory.reservedQuantity, 4);
    assert.ok(s.inventory.reservedQuantity <= s.inventory.quantity);
  });

  test("erro de negócio libera a trava: após um dispatch recusado, outro dispatch válido conclui", async () => {
    const variantId = await newVariant();
    await receive.execute(receiveInput(variantId, 5));
    const tmShort = new PrismaTransactionManager({ lockTimeoutMs: 3000 });
    let onLocked!: () => void;
    const failingLocked = new Promise<void>((r) => (onLocked = r));
    // Repositório que, após travar a linha, segura a trava por 400ms (dentro da transação).
    class HoldingRepo extends PrismaInventoryRepository {
      async lockExistingByProductVariantId(id: string) {
        const inv = await super.lockExistingByProductVariantId(id);
        onLocked();
        await sleep(400);
        return inv;
      }
    }
    const failing = new DispatchInventoryUseCase(
      new HoldingRepo(),
      new PrismaInventoryLotRepository(),
      new PrismaStockMovementRepository(),
      tmShort,
    );
    const shortLock = makeDispatchWith(tmShort);

    let failingEnd = 0;
    let validEnd = 0;
    const pFailing = failing
      .execute(dispatchInput(variantId, 10))
      .finally(() => (failingEnd = Date.now()));
    await failingLocked; // a recusada já segura a trava
    const validStart = Date.now();
    const pValid = shortLock
      .execute(dispatchInput(variantId, 2))
      .finally(() => (validEnd = Date.now()));
    const results = await Promise.allSettled([pFailing, pValid]);
    assert.ok(isBusiness("INSUFFICIENT_STOCK")(results[0]));
    assert.equal(results[1].status, "fulfilled");
    assert.ok(validEnd >= failingEnd, "o dispatch válido deve concluir depois do rollback do recusado");
    assert.ok(validEnd - validStart >= 200, `o válido deveria esperar a trava, esperou ${validEnd - validStart}ms`);

    await shortLock.execute(dispatchInput(variantId, 3));
    const s = await state(variantId);
    assert.equal(s.inventory.quantity, 0);
    assert.equal(s.lotSum, 0);
  });

  test("dispatch em variante sem inventário → NotFoundError, nenhum inventário criado", async () => {
    const variantId = await newVariant();
    await assert.rejects(
      dispatch.execute(dispatchInput(variantId, 1)),
      (e: unknown) => e instanceof NotFoundError && e.code === "INVENTORY_NOT_FOUND",
    );
    assert.equal(await prisma.inventory.count({ where: { productVariantId: variantId } }), 0);
  });

  test("receive de variante inexistente → NotFoundError, nenhum inventário criado", async () => {
    const variantId = randomUUID();
    await assert.rejects(
      receive.execute(receiveInput(variantId, 1)),
      (e: unknown) => e instanceof NotFoundError && e.code === "VARIANT_NOT_FOUND",
    );
    assert.equal(await prisma.inventory.count({ where: { productVariantId: variantId } }), 0);
  });

  // --- Vendas: CreateSale real com InventoryService real (Prisma), demais serviços falsos.

  function makeSale(inventoryService: InventoryService, variantIds: string[]) {
    const saleRepository = { create: async (s: Sale) => s } as unknown as SaleRepository;
    const customerService = {
      getCustomer: async (id: string) => ({ id }),
    } as unknown as CustomerService;
    const financialService: FinancialService = { createReceivable: async () => {} };
    return new CreateSaleUseCase(
      saleRepository,
      new PrismaTransactionManager(),
      customerService,
      new FakeCatalogService(variantIds.map((id) => makeVariant({ id }))),
      inventoryService,
      financialService,
    );
  }

  test("venda com dois itens da mesma variante conclui", async () => {
    const variantId = await newVariant();
    await receive.execute(receiveInput(variantId, 5));
    const sale = makeSale(new InventoryApplicationService(dispatch), [variantId]);

    await sale.execute({
      customerId: "c-1",
      items: [
        { productVariantId: variantId, quantity: 2, price: 1 },
        { productVariantId: variantId, quantity: 1, price: 1 },
      ],
    });

    const s = await state(variantId);
    assert.equal(s.inventory.quantity, 2);
    assert.equal(s.lotSum, 2);
  });

  test("vendas simultâneas com itens em ordem inversa → ambas concluem (sem deadlock)", async () => {
    const a = await newVariant();
    const b = await newVariant();
    await receive.execute(receiveInput(a, 5));
    await receive.execute(receiveInput(b, 5));

    // Pausa após o 1º item de cada venda: força a intercalação que causaria deadlock.
    const slowService = (): InventoryService => {
      const real = new InventoryApplicationService(dispatch);
      let calls = 0;
      return {
        async consumeStock(req) {
          await real.consumeStock(req);
          if (calls++ === 0) await sleep(300);
        },
      };
    };
    const sale1 = makeSale(slowService(), [a, b]);
    const sale2 = makeSale(slowService(), [a, b]);

    const results = await Promise.allSettled([
      sale1.execute({
        customerId: "c-1",
        items: [
          { productVariantId: a, quantity: 1, price: 1 },
          { productVariantId: b, quantity: 1, price: 1 },
        ],
      }),
      sale2.execute({
        customerId: "c-1",
        items: [
          { productVariantId: b, quantity: 1, price: 1 },
          { productVariantId: a, quantity: 1, price: 1 },
        ],
      }),
    ]);

    assert.deepEqual(
      results.map((r) => (r.status === "rejected" ? String(r.reason) : "ok")),
      ["ok", "ok"],
    );
    assert.equal((await state(a)).inventory.quantity, 3);
    assert.equal((await state(b)).inventory.quantity, 3);
  });
});

function makeDispatchWith(tm: PrismaTransactionManager) {
  return new DispatchInventoryUseCase(
    new PrismaInventoryRepository(),
    new PrismaInventoryLotRepository(),
    new PrismaStockMovementRepository(),
    tm,
  );
}
