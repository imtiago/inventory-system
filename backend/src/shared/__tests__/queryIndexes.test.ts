import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../prisma";

const EXPECTED: Array<[string, string]> = [
  ["StockMovement", "StockMovement_origin_originId_idx"],
  ["StockMovement", "StockMovement_productVariantId_createdAt_idx"],
  ["StockMovement", "StockMovement_inventoryId_createdAt_idx"],
  ["StockMovement", "StockMovement_createdAt_idx"],
  ["InventoryLot", "InventoryLot_inventoryId_remainingQuantity_idx"],
  ["FinancialDocument", "FinancialDocument_type_originType_originId_idx"],
  ["FinancialDocument", "FinancialDocument_type_partyId_idx"],
  ["FinancialDocument", "FinancialDocument_type_status_idx"],
  ["Sale", "Sale_customerId_idx"],
  ["Sale", "Sale_createdAt_idx"],
  ["PurchaseItem", "PurchaseItem_purchaseId_idx"],
  ["ProductVariant", "ProductVariant_productId_idx"],
  ["Product", "Product_brandId_idx"],
  ["Product", "Product_categoryId_idx"],
];

test("índices de consulta existem no banco", async () => {
  const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`;
  const found = new Set(rows.map((r) => r.indexname));
  const missing = EXPECTED.filter(([, name]) => !found.has(name)).map(([, n]) => n);
  assert.deepEqual(missing, []);
});
