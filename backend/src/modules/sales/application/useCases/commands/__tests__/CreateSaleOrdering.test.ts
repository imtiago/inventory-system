import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransactionManager } from "../../../../../../test/InMemoryTransactionManager";
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
    returnSaleStock: async () => {},
    receivePurchaseStock: async () => {},
    revertPurchaseStock: async () => "REVERTED",
  };
  const saleRepository = { create: async (s: Sale) => s } as unknown as SaleRepository;
  const customerService = {
    getCustomer: async (id: string) => ({ id }),
  } as unknown as CustomerService;
  const financialService: FinancialService = {
    createSaleReceivable: async () => {},
    cancelSaleReceivable: async () => {},
    createPurchasePayable: async () => {},
    cancelPurchasePayable: async () => {},
  };
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
    { productVariantId: "v-c", quantity: 3 },
    { productVariantId: "v-a", quantity: 1 },
    { productVariantId: "v-b", quantity: 2 },
  ];
  await uc.execute({ customerId: "c-1", sellerId: "u-1", items, paymentTerms: { installments: 1 } });

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
    sellerId: "u-1",
    paymentTerms: { installments: 1 },
    items: [
      { productVariantId: "v-b", quantity: 1 },
      { productVariantId: "v-a", quantity: 2 },
      { productVariantId: "v-b", quantity: 4 },
    ],
  });
  assert.deepEqual(
    calls.map((c) => [c.productVariantId, c.quantity]),
    [["v-a", 2], ["v-b", 1], ["v-b", 4]],
  );
});

test("consumeStock recebe o sellerId como userId (auditoria)", async () => {
  const { uc, calls } = build(["v-a"]);
  await uc.execute({
    customerId: "c-1",
    sellerId: "u-1",
    paymentTerms: { installments: 1 },
    items: [{ productVariantId: "v-a", quantity: 1 }],
  });
  assert.deepEqual(
    calls.map((c) => c.userId),
    ["u-1"],
  );
});

test("total em centavos menor que o nº de parcelas → 422 INSTALLMENTS_EXCEED_TOTAL antes de mexer no estoque", async () => {
  const calls: ConsumeStockRequest[] = [];
  const inventoryService = {
    consumeStock: async (req: ConsumeStockRequest) => {
      calls.push(req);
    },
  } as unknown as InventoryService;
  let receivables = 0;
  const financialService = {
    createSaleReceivable: async () => {
      receivables++;
    },
  } as unknown as FinancialService;
  const uc = new CreateSaleUseCase(
    { create: async (s: Sale) => s } as unknown as SaleRepository,
    new InMemoryTransactionManager(),
    { getCustomer: async (id: string) => ({ id }) } as unknown as CustomerService,
    new FakeCatalogService([makeVariant({ id: "v-a", salePrice: 0.01 })]),
    inventoryService,
    financialService,
  );

  await assert.rejects(
    uc.execute({
      customerId: "c-1",
      sellerId: "u-1",
      paymentTerms: { installments: 3, firstDueDate: new Date() },
      items: [{ productVariantId: "v-a", quantity: 2 }],
    }),
    {
      name: "BusinessRuleError",
      code: "INSTALLMENTS_EXCEED_TOTAL",
      message: "O valor da venda não permite esse número de parcelas.",
    },
  );
  assert.equal(calls.length, 0);
  assert.equal(receivables, 0);

  // Limite: total = nº de parcelas é permitido.
  await uc.execute({
    customerId: "c-1",
    sellerId: "u-1",
    paymentTerms: { installments: 3, firstDueDate: new Date() },
    items: [{ productVariantId: "v-a", quantity: 3 }],
  });
  assert.equal(calls.length, 1);
});
