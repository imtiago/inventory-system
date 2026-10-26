import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPercentSum, expenseBpsFromMonthly, realMargin, resolveTargetMarginBps, saleMargin, suggestedPriceCents,
} from "../pricingMath";

describe("pricingMath", () => {
  test("sugerido: custo 10,0000; despesas 20%; margem 30% → 20,00 → 20,90", () =>
    assert.equal(suggestedPriceCents({ averageCost4: 100000, expensesBps: 2000, marginBps: 3000, strategy: "STORE_TABLE" }), 2090));
  test("sugerido sobe no centavo antes de arredondar: custo 0,0001 com 0% → 0,01", () =>
    assert.equal(suggestedPriceCents({ averageCost4: 1, expensesBps: 0, marginBps: 0, strategy: "NONE" }), 1));
  test("despesas + margem = 100% → PRICING_PERCENT_SUM_TOO_HIGH com a mensagem da spec", () =>
    assert.throws(() => assertPercentSum(6000, 4000), (e: any) =>
      e.code === "PRICING_PERCENT_SUM_TOO_HIGH" && e.message === "Despesas e margem somam 100% ou mais"));
  test("soma abaixo de 100% passa", () => assert.doesNotThrow(() => assertPercentSum(6000, 3999)));
  test("sugerido com soma >= 100% lança", () =>
    assert.throws(() => suggestedPriceCents({ averageCost4: 100, expensesBps: 5000, marginBps: 5000, strategy: "NONE" })));
  test("margem real: preço 20,90, custo 10,0000, despesas 20% → R$ 6,72 e 32,15%", () =>
    assert.deepEqual(realMargin({ priceCents: 2090, unitCost4: 100000, expensesBps: 2000 }), { marginCents: 672, marginBps: 3215 }));
  test("margem real com repasse de taxa do cartão (cobrado maior que o preço)", () => {
    const r = realMargin({ priceCents: 10000, unitCost4: 500000, expensesBps: 1000, cardFeeBps: 350, chargedCents: 10363 });
    assert.equal(r.marginCents, 10363 - 363 - 5000 - 1000);
  });
  test("margem real com cobrado zero → 0 bps", () =>
    assert.deepEqual(realMargin({ priceCents: 0, unitCost4: 0, expensesBps: 0 }), { marginCents: 0, marginBps: 0 }));
  test("prioridade da margem: variante > produto > categoria > loja (null cai para o próximo)", () => {
    assert.equal(resolveTargetMarginBps({ variant: 1000, product: 2000, category: 3000, store: 4000 }), 1000);
    assert.equal(resolveTargetMarginBps({ variant: null, product: 2000, category: 3000, store: 4000 }), 2000);
    assert.equal(resolveTargetMarginBps({ variant: null, product: null, category: 3000, store: 4000 }), 3000);
    assert.equal(resolveTargetMarginBps({ variant: null, product: null, category: null, store: 4000 }), 4000);
    assert.equal(resolveTargetMarginBps({ variant: 0, product: 2000, category: null, store: 4000 }), 0);
  });
  test("ajudante: R$ 1.500 de aluguel ÷ R$ 20.000 de faturamento → 750 bps", () =>
    assert.equal(expenseBpsFromMonthly(150000, 2000000), 750));
  test("ajudante com faturamento zero lança", () => assert.throws(() => expenseBpsFromMonthly(100, 0), RangeError));
  test("saleMargin simples", () => {
    const r = saleMargin({
      lines: [{ quantity: 2, unitPriceCents: 2090, unitCost4: 100000 }], chargedCents: 4180, expensesBps: 2000, cardFeeBps: 0,
    });
    assert.deepEqual(r, { marginCents: 4180 - 2000 - 836, marginBps: 3215, missingCost: false });
  });
  test("saleMargin com item sem custo → missingCost true e custo do item tratado como 0", () => {
    const r = saleMargin({
      lines: [
        { quantity: 1, unitPriceCents: 1000, unitCost4: null },
        { quantity: 1, unitPriceCents: 1000, unitCost4: 50000 },
      ],
      chargedCents: 2000, expensesBps: 0, cardFeeBps: 0,
    });
    assert.equal(r.missingCost, true);
    assert.equal(r.marginCents, 2000 - 500);
  });
});
