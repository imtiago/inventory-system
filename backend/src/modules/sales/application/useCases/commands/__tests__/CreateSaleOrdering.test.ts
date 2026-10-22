import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransactionManager } from "@shared/application/transaction/InMemoryTransactionManager";
import { ConsumeStockRequest, InventoryService } from "@inventory/application/services/InventoryService";
import { CustomerService } from "@customer/application/services/CustomerService";
import { FinancialService } from "@finance/application/services/FinacialService";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";
import { Sale } from "@sales/domain/entities/Sale";
import { FakeCatalogService, makeVariant } from "@inventory/application/__tests__/fakes";
import { CreateSaleUseCase } from "../CreateSaleUseCase";

function build(variantIds: string[]) {
  const calls: ConsumeStockRequest[] = [];
  const inventoryService: InventoryService = {
    consumeStock: async (req) => {
      calls.push(req);
    },
  };
  const saleRepository = { create: async (s: Sale) => s } as unknown as SaleRepository;
  const customerService = {
    getCustomer: async (id: string) => ({ id }),
  } as unknown as CustomerService;
  const financialService: FinancialService = { createReceivable: async () => {} };
  const uc = new CreateSaleUseCase(
    saleRepository,
    new InMemoryTransactionManager(),
    customerService,
    new FakeCatalogService(variantIds.map((id) => makeVariant({ id }))),
    inventoryService,
    financialService,
  );
  return { uc, calls };
}

test("CreateSale processa itens em ordem crescente de productVariantId", async () => {
  const { uc, calls } = build(["v-a", "v-b", "v-c"]);
  const items = [
    { productVariantId: "v-c", quantity: 3, price: 1 },
    { productVariantId: "v-a", quantity: 1, price: 1 },
    { productVariantId: "v-b", quantity: 2, price: 1 },
  ];
  await uc.execute({ customerId: "c-1", items });

  assert.deepEqual(
    calls.map((c) => [c.productVariantId, c.quantity]),
    [["v-a", 1], ["v-b", 2], ["v-c", 3]],
  );
  // Não reordena a entrada do chamador.
  assert.deepEqual(items.map((i) => i.productVariantId), ["v-c", "v-a", "v-b"]);
});

test("venda com dois itens da mesma variante conclui", async () => {
  const { uc, calls } = build(["v-a", "v-b"]);
  await uc.execute({
    customerId: "c-1",
    items: [
      { productVariantId: "v-b", quantity: 1, price: 1 },
      { productVariantId: "v-a", quantity: 2, price: 1 },
      { productVariantId: "v-b", quantity: 4, price: 1 },
    ],
  });
  assert.deepEqual(
    calls.map((c) => [c.productVariantId, c.quantity]),
    [["v-a", 2], ["v-b", 1], ["v-b", 4]],
  );
});
