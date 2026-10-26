import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransactionManager } from "../../../../../../test/InMemoryTransactionManager";
import { FinancialService } from "@finance/application/services/FinacialService";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { PurchaseItem } from "@purchases/domain/entities/PurchaseItem";
import { PurchaseRepository } from "@purchases/domain/repositories/PurchaseRepository";
import { PurchaseStatus } from "@purchases/domain/enums/PurchaseStatus";
import { CancelPurchaseUseCase } from "../CancelPurchaseUseCase";

function build(purchase: Purchase | null) {
  const log: string[] = [];
  const repo: PurchaseRepository = {
    create: async (p) => p,
    lockById: async (id) => {
      log.push(`lockPurchase:${id}`);
      return purchase;
    },
    update: async (p) => {
      log.push(`update:${p.status}`);
      return p;
    },
  };
  const finance: FinancialService = {
    createSaleReceivable: async () => {},
    cancelSaleReceivable: async () => {},
    createPurchasePayable: async () => {},
    cancelPurchasePayable: async (id) => {
      log.push(`cancelPayable:${id}`);
    },
  };
  return { uc: new CancelPurchaseUseCase(repo, new InMemoryTransactionManager(), finance), log };
}

const purchase = (receivedQuantity = 0) =>
  Purchase.create({
    code: "PC000001",
    supplierId: "s-1",
    purchaseDate: "2026-10-20",
    notes: null,
    items: [new PurchaseItem({ productVariantId: "v-1", quantity: 2, receivedQuantity, unitPriceCents: 100 })],
  });

test("trava o pedido antes do documento financeiro e grava CANCELED por último", async () => {
  const p = purchase();
  const { uc, log } = build(p);
  const result = await uc.execute({ id: p.id, reason: "Motivo", userId: "u-1" });
  assert.equal(result.status, PurchaseStatus.CANCELED);
  assert.deepEqual(log, [`lockPurchase:${p.id}`, `cancelPayable:${p.id}`, "update:CANCELED"]);
});

test("com recebimento → 409 PURCHASE_HAS_RECEIPTS sem tocar no financeiro", async () => {
  const p = purchase(1);
  const { uc, log } = build(p);
  await assert.rejects(() => uc.execute({ id: p.id, reason: "Motivo", userId: "u-1" }), {
    code: "PURCHASE_HAS_RECEIPTS",
  });
  assert.deepEqual(log, [`lockPurchase:${p.id}`]);
});

test("pedido inexistente → 404 PURCHASE_NOT_FOUND", async () => {
  const { uc } = build(null);
  await assert.rejects(() => uc.execute({ id: "x", reason: "Motivo", userId: "u-1" }), {
    name: "NotFoundError",
    code: "PURCHASE_NOT_FOUND",
    message: "Pedido de compra não encontrado.",
  });
});
