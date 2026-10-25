import { test } from "node:test";
import assert from "node:assert/strict";
import { NfeItem } from "../NfeDocument";
import { nfeItemUnits, toPurchaseLines } from "../nfePurchaseLines";
import { BusinessRuleError } from "@shared/domain/errors";

const item = (overrides: Partial<NfeItem>): NfeItem => ({
  index: 1,
  supplierCode: "X",
  barcode: null,
  name: "x",
  ncm: null,
  cfop: null,
  unit: "UN",
  quantity: "1",
  unitPrice: "0",
  productsTotal: 0,
  discount: 0,
  freight: 0,
  insurance: 0,
  other: 0,
  icmsRelief: 0,
  importTax: 0,
  ipi: 0,
  icmsSt: 0,
  composesTotal: true,
  lots: [],
  ...overrides,
});

test("caixa: 2 CX × 12 → 24 un; resíduo negativo do unitPrice vai para o imposto e o total = custo", () => {
  const box = item({
    quantity: "2",
    productsTotal: 24100,
    discount: 1100,
    freight: 500,
    ipi: 1205,
    lots: [
      { batchNumber: "L1", quantity: "1", manufacturingDate: null, expirationDate: "2027-01-10" },
      { batchNumber: " ", quantity: "1", manufacturingDate: null, expirationDate: null },
    ],
  });
  const units = nfeItemUnits(box, 12);
  assert.deepEqual(units, { units: 24, lots: [{ batchNumber: "L1", quantity: 12, manufacturingDate: null, expirationDate: "2027-01-10" }] });
  const [line] = toPurchaseLines([{ item: box, productVariantId: "v", units }]);
  // round(24100 / 24) = 1004; 24 × 1004 = 24096 → resíduo −4 → imposto 1205 + 4.
  assert.deepEqual(
    [line.quantity, line.unitPriceCents, line.discountCents, line.freightCents, line.taxCents, line.costCents],
    [24, 1004, 1100, 500, 1209, 24705],
  );
});

test("mesma variante: soma unidades e componentes; resíduo positivo vai para o desconto; lotes somados por número", () => {
  const a = item({ index: 1, quantity: "2", productsTotal: 24100, discount: 1100, freight: 500, ipi: 1205,
    lots: [{ batchNumber: "L1", quantity: "1", manufacturingDate: null, expirationDate: null }] });
  const b = item({ index: 3, quantity: "1", productsTotal: 9999, discount: 99, icmsRelief: 150, insurance: 10, other: 5, icmsSt: 7, importTax: 3,
    lots: [{ batchNumber: "L1", quantity: "1", manufacturingDate: null, expirationDate: null }] });
  const lines = toPurchaseLines([
    { item: a, productVariantId: "v", units: nfeItemUnits(a, 12) },
    { item: b, productVariantId: "v", units: nfeItemUnits(b, 1) },
  ]);
  assert.equal(lines.length, 1);
  const [line] = lines;
  // 25 un; round(34099 / 25) = 1364 → 34100, resíduo +1 no desconto (1100 + 99 + 150 + 1).
  assert.deepEqual(
    [line.quantity, line.unitPriceCents, line.discountCents, line.freightCents, line.taxCents, line.costCents],
    [25, 1364, 1350, 515, 1215, 24705 + 9999 - 99 - 150 + 15 + 10],
  );
  assert.deepEqual(line.lots.map((l) => [l.batchNumber, l.quantity]), [["L1", 13]]);
});

test("não inteiro, indTot 0 e lotes acima da quantidade → 422", () => {
  assert.throws(() => nfeItemUnits(item({ index: 2, quantity: "10.5" }), 1), { code: "NFE_QUANTITY_NOT_INTEGER", message: "Quantidade do item 2 não resulta em unidades inteiras." });
  assert.equal(nfeItemUnits(item({ quantity: "10.5" }), 2).units, 21);
  assert.throws(() => nfeItemUnits(item({ quantity: "1", lots: [{ batchNumber: "L", quantity: "0.5", manufacturingDate: null, expirationDate: null }] }), 1), { code: "NFE_QUANTITY_NOT_INTEGER" });
  assert.throws(() => nfeItemUnits(item({ index: 3, composesTotal: false }), 1), { code: "NFE_UNSUPPORTED_ITEM" });
  assert.throws(() => nfeItemUnits(item({ quantity: "1", lots: [{ batchNumber: "L", quantity: "2", manufacturingDate: null, expirationDate: null }] }), 1), { code: "INVALID_NFE" });
});

test("unidades por item (qCom × unidades por embalagem) acima de 1.000.000 → 422 INVALID_NFE com o item; no teto passa", () => {
  const big = item({ index: 4, quantity: "30000", productsTotal: 100 });
  assert.throws(
    () => nfeItemUnits(big, 100_000),
    (e: unknown) =>
      e instanceof BusinessRuleError &&
      e.code === "INVALID_NFE" &&
      e.message === "Item 4: quantidade em unidades acima do máximo permitido (1.000.000).",
  );
  assert.throws(() => nfeItemUnits(item({ index: 2, quantity: "1000000" }), 2), /Item 2: quantidade em unidades/);
  assert.equal(nfeItemUnits(item({ quantity: "500000" }), 2).units, 1_000_000);
});

test("componentes do item do pedido acima de Decimal(12,2) → 422 com o item; total do pedido acima → 422", () => {
  const MAX = 999_999_999_999;
  const resolve = (it: NfeItem, productVariantId: string) => ({ item: it, productVariantId, units: nfeItemUnits(it, 1) });
  // Duas linhas da mesma variante: cada uma no teto, a soma estoura (reporta o primeiro item da variante).
  const a = item({ index: 2, quantity: "1", productsTotal: MAX });
  const b = item({ index: 5, quantity: "1", productsTotal: 1 });
  assert.throws(
    () => toPurchaseLines([resolve(a, "v"), resolve(b, "v")]),
    (e: unknown) =>
      e instanceof BusinessRuleError && e.code === "INVALID_NFE" && e.message === "Item 2: valor acima do máximo permitido.",
  );
  // Linhas de variantes diferentes, cada uma no teto: o total do pedido estoura.
  assert.throws(
    () => toPurchaseLines([resolve(a, "v1"), resolve(b, "v2")]),
    (e: unknown) =>
      e instanceof BusinessRuleError && e.code === "INVALID_NFE" && e.message === "O total da nota excede o máximo permitido.",
  );
  // No teto passa.
  const [line] = toPurchaseLines([resolve(a, "v")]);
  assert.equal(line.costCents, MAX);
});
