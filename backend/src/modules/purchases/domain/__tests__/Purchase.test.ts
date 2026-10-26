import { test } from "node:test";
import assert from "node:assert/strict";
import { Purchase } from "../entities/Purchase";
import { PurchaseItem } from "../entities/PurchaseItem";
import { PurchaseStatus } from "../enums/PurchaseStatus";
import { PurchaseOrigin } from "../enums/PurchaseOrigin";

const item = (over: Partial<ConstructorParameters<typeof PurchaseItem>[0]> = {}) =>
  new PurchaseItem({ productVariantId: "v-1", quantity: 1, unitPriceCents: 100, ...over });

const newPurchase = (items: PurchaseItem[]) =>
  Purchase.create({ code: "PC000001", supplierId: "s-1", purchaseDate: "2026-10-20", notes: null, items });

test("item: total = quantidade × preço − desconto + frete + imposto (centavos)", () => {
  const i = item({ quantity: 2, unitPriceCents: 1050, discountCents: 100, freightCents: 50, taxCents: 25 });
  assert.equal(i.totalCents, 2075);
  assert.equal(i.receivedQuantity, 0);
  assert.equal(i.remainingQuantity, 2);
});

test("item: unitCost = round-half-up(total / quantidade) com 4 casas — 1000/3 → 3,3333; 2075/2 → 10,375; 5/2 → 0,025", () => {
  assert.equal(item({ quantity: 3, unitPriceCents: 333, freightCents: 1 }).unitCost, 3.3333);
  assert.equal(
    item({ quantity: 2, unitPriceCents: 1050, discountCents: 100, freightCents: 50, taxCents: 25 }).unitCost,
    10.375,
  );
  assert.equal(item({ quantity: 2, unitPriceCents: 2, freightCents: 1 }).unitCost, 0.025);
  assert.equal(item({ quantity: 3, unitPriceCents: 0, freightCents: 2 }).unitCost, 0.0067);
});

test("item com total negativo → 422 INVALID_ITEM_TOTAL", () => {
  assert.throws(() => item({ quantity: 1, unitPriceCents: 100, discountCents: 101 }), {
    name: "BusinessRuleError",
    code: "INVALID_ITEM_TOTAL",
    message: "Total do item não pode ser negativo.",
  });
});

test("pedido: total = Σ itens; status PENDING, origem MANUAL, sem recebimentos", () => {
  const p = newPurchase([
    item({ productVariantId: "v-1", quantity: 3, unitPriceCents: 333, freightCents: 1 }),
    item({ productVariantId: "v-2", quantity: 2, unitPriceCents: 1050, discountCents: 100, freightCents: 50, taxCents: 25 }),
  ]);
  assert.equal(p.totalAmountCents, 3075);
  assert.equal(p.status, PurchaseStatus.PENDING);
  assert.equal(p.origin, PurchaseOrigin.MANUAL);
  assert.equal(p.hasReceipts, false);
});

test("pedido com total 0 → 422 PURCHASE_TOTAL_ZERO", () => {
  assert.throws(() => newPurchase([item({ unitPriceCents: 0 })]), {
    name: "BusinessRuleError",
    code: "PURCHASE_TOTAL_ZERO",
    message: "O total do pedido deve ser maior que zero.",
  });
});

test("cancelar: grava motivo, data e usuário; duas vezes → 409 PURCHASE_ALREADY_CANCELED", () => {
  const p = newPurchase([item()]);
  const now = new Date("2026-10-23T12:00:00.000Z");
  p.cancel({ reason: "Fornecedor desistiu", userId: "u-1", now });
  assert.equal(p.status, PurchaseStatus.CANCELED);
  assert.equal(p.cancelReason, "Fornecedor desistiu");
  assert.equal(p.canceledAt, now);
  assert.equal(p.canceledById, "u-1");
  assert.throws(() => p.cancel({ reason: "de novo", userId: "u-1" }), {
    name: "ConflictError",
    code: "PURCHASE_ALREADY_CANCELED",
    message: "Pedido já está cancelado.",
  });
});

test("cancelar pedido com qualquer quantidade recebida → 409 PURCHASE_HAS_RECEIPTS", () => {
  const p = new Purchase({
    id: "p-1",
    code: "PC000001",
    supplierId: "s-1",
    status: PurchaseStatus.PARTIALLY_RECEIVED,
    origin: PurchaseOrigin.MANUAL,
    purchaseDate: "2026-10-20",
    notes: null,
    items: [item({ quantity: 5, receivedQuantity: 1 })],
  });
  assert.equal(p.hasReceipts, true);
  assert.throws(() => p.cancel({ reason: "motivo", userId: "u-1" }), {
    name: "ConflictError",
    code: "PURCHASE_HAS_RECEIPTS",
    message: "Pedido com recebimentos não pode ser cancelado.",
  });
  assert.equal(p.status, PurchaseStatus.PARTIALLY_RECEIVED);
});

const twoItemPurchase = () =>
  newPurchase([
    item({ id: "i-1", productVariantId: "v-1", quantity: 5 }),
    item({ id: "i-2", productVariantId: "v-2", quantity: 2 }),
  ]);

test("receber: soma em receivedQuantity e recalcula status (parcial → total)", () => {
  const p = twoItemPurchase();
  p.receive([{ purchaseItemId: "i-1", quantity: 2 }]);
  assert.equal(p.status, PurchaseStatus.PARTIALLY_RECEIVED);
  assert.deepEqual(p.items.map((i) => [i.receivedQuantity, i.remainingQuantity]), [[2, 3], [0, 2]]);
  assert.equal(p.hasReceipts, true);

  p.receive([
    { purchaseItemId: "i-2", quantity: 2 },
    { purchaseItemId: "i-1", quantity: 3 },
  ]);
  assert.equal(p.status, PurchaseStatus.RECEIVED);
  assert.deepEqual(p.items.map((i) => i.remainingQuantity), [0, 0]);

  assert.throws(() => p.receive([{ purchaseItemId: "i-1", quantity: 1 }]), {
    name: "ConflictError",
    code: "PURCHASE_ALREADY_RECEIVED",
    message: "Pedido já foi totalmente recebido.",
  });
});

test("receber: cancelado → 409; item desconhecido → 404; acima do restante → 422; nada muda em erro", () => {
  const canceled = twoItemPurchase();
  canceled.cancel({ reason: "motivo", userId: "u-1" });
  assert.throws(() => canceled.receive([{ purchaseItemId: "i-1", quantity: 1 }]), {
    name: "ConflictError",
    code: "PURCHASE_CANCELED",
    message: "Pedido cancelado não pode ser recebido.",
  });

  const p = twoItemPurchase();
  assert.throws(() => p.receive([{ purchaseItemId: "outro", quantity: 1 }]), {
    name: "NotFoundError",
    code: "PURCHASE_ITEM_NOT_FOUND",
    message: "Item do pedido não encontrado.",
  });
  // Segundo item excede: o primeiro (válido) não pode ter sido aplicado.
  assert.throws(
    () =>
      p.receive([
        { purchaseItemId: "i-1", quantity: 1 },
        { purchaseItemId: "i-2", quantity: 3 },
      ]),
    {
      name: "BusinessRuleError",
      code: "RECEIPT_EXCEEDS_REMAINING",
      message: "Quantidade maior que o saldo a receber do item.",
    },
  );
  assert.deepEqual(p.items.map((i) => i.receivedQuantity), [0, 0]);
  assert.equal(p.status, PurchaseStatus.PENDING);

  // Item repetido / quantidade inválida: invariantes (o schema HTTP já barra com 400).
  assert.throws(() =>
    p.receive([
      { purchaseItemId: "i-1", quantity: 1 },
      { purchaseItemId: "i-1", quantity: 1 },
    ]),
  );
  assert.throws(() => p.receive([{ purchaseItemId: "i-1", quantity: 0 }]));
  assert.throws(() => p.receive([]));
  assert.deepEqual(p.items.map((i) => i.receivedQuantity), [0, 0]);
});

test("estornar recebimentos (NF-e desfeita): zera o recebido e cancela com motivo; cancelado → 409", () => {
  const p = newPurchase([
    item({ id: "i-1", productVariantId: "v-1", quantity: 2 }),
    item({ id: "i-2", productVariantId: "v-2", quantity: 3 }),
  ]);
  p.receive([{ purchaseItemId: "i-1", quantity: 2 }, { purchaseItemId: "i-2", quantity: 3 }]);
  assert.equal(p.status, PurchaseStatus.RECEIVED);
  // cancel continua recusando pedido recebido.
  assert.throws(() => p.cancel({ reason: "x", userId: "u-1" }), { code: "PURCHASE_HAS_RECEIPTS" });

  const now = new Date("2026-10-26T12:00:00.000Z");
  p.revertReceipts({ reason: "Estorno da NF-e 12345", userId: "u-1", now });
  assert.equal(p.status, PurchaseStatus.CANCELED);
  assert.deepEqual(p.items.map((i) => i.receivedQuantity), [0, 0]);
  assert.deepEqual([p.cancelReason, p.canceledAt, p.canceledById], ["Estorno da NF-e 12345", now, "u-1"]);
  assert.throws(() => p.revertReceipts({ reason: "x", userId: "u-1" }), { code: "PURCHASE_ALREADY_CANCELED" });
});
