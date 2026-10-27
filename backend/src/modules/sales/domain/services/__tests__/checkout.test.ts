import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutCharge } from "../checkoutCharge";
import { isWithinCheckoutRefundWindow } from "../checkoutRefundWindow";
import { PaymentCondition } from "../../enums/PaymentCondition";

const fees = {
  debitBps: 199,
  creditBps: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, i === 2 ? 499 : 300])),
};

test("checkoutCharge: dinheiro/PIX = itens, sem taxa", () => {
  for (const condition of [PaymentCondition.CASH, PaymentCondition.PIX] as const) {
    assert.deepEqual(checkoutCharge({ itemsTotalCents: 10000, condition, passCardFee: true, cardFees: fees }), {
      totalCents: 10000,
      surchargeCents: 0,
      cardFeeBps: null,
      cardFeePassedOn: false,
      cardInstallments: null,
    });
  }
});

test("checkoutCharge: crédito 3x com repasse 4,99% → 105,26; sem repasse → 100,00 com a taxa registrada", () => {
  const base = { itemsTotalCents: 10000, condition: PaymentCondition.CREDIT_CARD, cardInstallments: 3, cardFees: fees } as const;
  assert.deepEqual(checkoutCharge(base), {
    totalCents: 10526,
    surchargeCents: 526,
    cardFeeBps: 499,
    cardFeePassedOn: true,
    cardInstallments: 3,
  });
  assert.deepEqual(checkoutCharge({ ...base, passCardFee: false }), {
    totalCents: 10000,
    surchargeCents: 0,
    cardFeeBps: 499,
    cardFeePassedOn: false,
    cardInstallments: 3,
  });
});

test("checkoutCharge: débito usa a taxa de débito e não tem parcelas", () => {
  const r = checkoutCharge({ itemsTotalCents: 10000, condition: PaymentCondition.DEBIT_CARD, cardFees: fees });
  assert.equal(r.totalCents, 10204);
  assert.equal(r.cardFeeBps, 199);
  assert.equal(r.cardInstallments, null);
});

test("janela de estorno: 7 dias corridos em data de negócio (São Paulo)", () => {
  // Venda 20/10 às 23h30 em São Paulo (= 21/10 02:30 UTC): data de negócio 20/10.
  const sale = new Date("2026-10-21T02:30:00.000Z");
  assert.equal(isWithinCheckoutRefundWindow(sale, new Date("2026-10-21T12:00:00.000Z")), true);
  // 27/10 23h59 em São Paulo = 28/10 02:59 UTC → 7º dia: ainda pode.
  assert.equal(isWithinCheckoutRefundWindow(sale, new Date("2026-10-28T02:59:00.000Z")), true);
  // 28/10 00h01 em São Paulo → 8º dia: não pode.
  assert.equal(isWithinCheckoutRefundWindow(sale, new Date("2026-10-28T03:01:00.000Z")), false);
});
