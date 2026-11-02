import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildCarneContent, buildReceiptContent, formatBrl, formatBps, type CarneInput } from "../carneContent";
import { crediarioOptions } from "../crediarioPlan";
import { DEFAULT_CREDIT_PROFILES } from "../CreditProfileCode";
import { DEFAULT_CREDIT_RULES } from "../creditRules";

const store = { name: "Loja da Dona Maria", cnpj: "11222333000181", address: "Rua das Flores, 100 - Centro, São Paulo/SP", phone: "11988887777" };
const customer = { name: "Ana Souza", document: "52998224725", phone: "11977776666", address: "Av. Brasil, 5" };

const carneInput = (over: Partial<CarneInput> = {}): CarneInput => ({
  store,
  customer,
  sale: { code: "3F9A12BC", date: "2026-11-01", items: [{ name: "Camiseta azul", quantity: 2 }, { name: "Calça jeans", quantity: 1 }] },
  financing: {
    cashPriceCents: 100000,
    downPaymentCents: 0,
    downPaymentMethod: null,
    financedCents: 100000,
    installments: 5,
    monthlyRateBps: 399,
    surchargeCents: 12282,
    totalCents: 112282,
  },
  parcels: [
    { dueDate: "2026-12-01", amountCents: 22456 },
    { dueDate: "2027-01-01", amountCents: 22456 },
    { dueDate: "2027-02-01", amountCents: 22456 },
    { dueDate: "2027-03-01", amountCents: 22456 },
    { dueDate: "2027-04-01", amountCents: 22458 },
  ],
  rules: { fineBps: 200, monthlyInterestBps: 100, graceDays: 3 },
  ...over,
});

const summaryOf = (input: CarneInput) => Object.fromEntries(buildCarneContent(input).summary.map((r) => [r.label, r.value]));

describe("formatadores", () => {
  test("formatBrl em centavos inteiros", () => {
    assert.equal(formatBrl(0), "R$ 0,00");
    assert.equal(formatBrl(5), "R$ 0,05");
    assert.equal(formatBrl(112282), "R$ 1.122,82");
    assert.equal(formatBrl(123456789), "R$ 1.234.567,89");
  });
  test("formatBps", () => {
    assert.equal(formatBps(399), "3,99%");
    assert.equal(formatBps(200), "2%");
    assert.equal(formatBps(150), "1,5%");
    assert.equal(formatBps(0), "0%");
  });
});

describe("buildCarneContent", () => {
  test("R$ 1.000 em 5x a 3,99%: canhotos 224,56 x4 e 224,58; total a prazo 1.122,82; multa 2% e juros 1% a.m.", () => {
    const content = buildCarneContent(carneInput());
    assert.deepEqual(
      content.stubs.map((s) => [s.number, s.dueDate, s.amount]),
      [
        ["1/5", "01/12/2026", "R$ 224,56"],
        ["2/5", "01/01/2027", "R$ 224,56"],
        ["3/5", "01/02/2027", "R$ 224,56"],
        ["4/5", "01/03/2027", "R$ 224,56"],
        ["5/5", "01/04/2027", "R$ 224,58"],
      ],
    );
    assert.deepEqual(
      content.summary.map((r) => r.label),
      ["Preço à vista", "Entrada", "Valor financiado", "Parcelas", "Taxa mensal", "Acréscimo total", "Total a prazo", "Multa por atraso", "Juros por atraso"],
    );
    const s = summaryOf(carneInput());
    assert.equal(s["Preço à vista"], "R$ 1.000,00");
    assert.equal(s["Entrada"], "R$ 0,00");
    assert.equal(s["Valor financiado"], "R$ 1.000,00");
    assert.equal(s["Parcelas"], "4 × R$ 224,56 + 1 × R$ 224,58");
    assert.equal(s["Taxa mensal"], "3,99% ao mês");
    assert.equal(s["Acréscimo total"], "R$ 122,82");
    assert.equal(s["Total a prazo"], "R$ 1.122,82");
    assert.match(s["Multa por atraso"], /2%/);
    assert.match(s["Multa por atraso"], /3 dias/);
    assert.match(s["Juros por atraso"], /1% ao mês/);
  });

  test("os valores do carnê batem com o plano calculado pelo crediário (soma exata)", () => {
    const profile = DEFAULT_CREDIT_PROFILES.find((p) => p.code === "EXCELLENT")!;
    const option = crediarioOptions({ totalCents: 100000, downPaymentCents: 0, rules: DEFAULT_CREDIT_RULES, profile }).find((o) => o.installments === 5)!;
    const content = buildCarneContent(
      carneInput({ parcels: option.parcels.map((a, i) => ({ dueDate: ["2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01", "2027-04-01"][i], amountCents: a })) }),
    );
    assert.equal(content.stubs[0].amount, formatBrl(option.installmentCents));
    assert.equal(content.stubs[4].amount, formatBrl(option.lastInstallmentCents));
    assert.equal(option.totalCents, 112282);
  });

  test("com entrada: mostra forma da entrada; sem carência não fala em dias", () => {
    const s = summaryOf(
      carneInput({
        financing: { ...carneInput().financing, downPaymentCents: 30000, downPaymentMethod: "PIX", financedCents: 70000 },
        rules: { fineBps: 200, monthlyInterestBps: 100, graceDays: 0 },
      }),
    );
    assert.equal(s["Entrada"], "R$ 300,00 (Pix)");
    assert.doesNotMatch(s["Multa por atraso"], /dias/);
  });

  test("parcelas iguais: n × valor; sem acréscimo: taxa 0%", () => {
    const s = summaryOf(
      carneInput({
        financing: { ...carneInput().financing, installments: 2, monthlyRateBps: 0, surchargeCents: 0, totalCents: 100000 },
        parcels: [
          { dueDate: "2026-12-01", amountCents: 50000 },
          { dueDate: "2027-01-01", amountCents: 50000 },
        ],
      }),
    );
    assert.equal(s["Parcelas"], "2 × R$ 500,00");
    assert.equal(s["Taxa mensal"], "0% (sem acréscimo)");
    assert.equal(s["Acréscimo total"], "R$ 0,00");
  });

  test("loja, cliente e venda formatados", () => {
    const c = buildCarneContent(carneInput());
    assert.deepEqual(c.store, [
      "Loja da Dona Maria",
      "CNPJ: 11.222.333/0001-81",
      "Rua das Flores, 100 - Centro, São Paulo/SP",
      "Telefone: (11) 98888-7777",
    ]);
    assert.deepEqual(c.customer, ["Ana Souza", "CPF: 529.982.247-25", "Telefone: (11) 97777-6666", "Endereço: Av. Brasil, 5"]);
    assert.equal(c.sale[0], "Venda #3F9A12BC em 01/11/2026");
    assert.ok(c.sale.some((l) => l.includes("2 × Camiseta azul")));
  });

  test("cliente sem documento/telefone/endereço: só as linhas existentes", () => {
    const c = buildCarneContent(carneInput({ customer: { name: "Ana", document: null, phone: null, address: null } }));
    assert.deepEqual(c.customer, ["Ana"]);
  });

  test("canhoto repete cliente, loja e venda", () => {
    const c = buildCarneContent(carneInput());
    assert.equal(c.stubOwner, "Ana Souza");
    assert.equal(c.storeName, "Loja da Dona Maria");
    assert.equal(c.saleCode, "3F9A12BC");
  });
});

describe("buildReceiptContent", () => {
  const receipt = (over: Record<string, unknown> = {}) =>
    buildReceiptContent({
      store,
      customer,
      payment: {
        code: "A1B2C3D4",
        paymentDate: "2026-11-20",
        method: "PIX",
        reference: null,
        parcelNumber: 2,
        parcelCount: 5,
        dueDate: "2026-11-10",
        principalCents: 10000,
        fineCents: 200,
        interestCents: 33,
        waivedCents: 0,
        waiverReason: null,
        receivedBy: "Carla",
        originLabel: "Venda 3F9A12BC",
      },
      ...over,
    } as never);

  test("mostra principal, multa, juros, dispensa e total recebido em caixa", () => {
    const rows = Object.fromEntries(receipt({
      payment: {
        code: "A1B2C3D4", paymentDate: "2026-11-20", method: "PIX", reference: "ref-1", parcelNumber: 2, parcelCount: 5,
        dueDate: "2026-11-10", principalCents: 10000, fineCents: 200, interestCents: 33, waivedCents: 100, waiverReason: "Cliente antigo",
        receivedBy: "Carla", originLabel: "Venda 3F9A12BC",
      },
    }).lines.map((r) => [r.label, r.value]));
    assert.equal(rows["Valor da parcela (principal)"], "R$ 100,00");
    assert.equal(rows["Multa por atraso"], "R$ 2,00");
    assert.equal(rows["Juros por atraso"], "R$ 0,33");
    assert.equal(rows["Dispensado"], "- R$ 1,00");
    assert.equal(rows["Total recebido"], "R$ 101,33");
    assert.equal(rows["Motivo da dispensa"], "Cliente antigo");
    assert.equal(rows["Forma de pagamento"], "Pix");
    assert.equal(rows["Parcela"], "2/5 (venc. 10/11/2026)");
    assert.equal(rows["Data do pagamento"], "20/11/2026");
  });

  test("pagamento em dia: sem linhas de multa, juros nem dispensa", () => {
    const labels = receipt({ payment: { code: "X", paymentDate: "2026-11-10", method: "CASH", reference: null, parcelNumber: 1, parcelCount: 1, dueDate: "2026-11-10", principalCents: 5000, fineCents: 0, interestCents: 0, waivedCents: 0, waiverReason: null, receivedBy: null, originLabel: "Venda X" } }).lines.map((r) => r.label);
    assert.ok(!labels.includes("Multa por atraso") && !labels.includes("Juros por atraso") && !labels.includes("Dispensado"));
    assert.ok(labels.includes("Total recebido"));
  });

  test("parcela a combinar do caderninho: vencimento 'a combinar' e origem do caderninho", () => {
    const rows = Object.fromEntries(receipt({
      payment: {
        code: "X", paymentDate: "2026-11-10", method: "CASH", reference: null, parcelNumber: 1, parcelCount: 1,
        dueDate: "2026-09-01", dueDateUnknown: true, principalCents: 5000, fineCents: 0, interestCents: 0, waivedCents: 0,
        waiverReason: null, receivedBy: null, originLabel: "Saldo anterior — caderninho",
      },
    }).lines.map((r) => [r.label, r.value]));
    assert.equal(rows["Parcela"], "1/1 (venc. a combinar)");
    assert.equal(rows["Referente a"], "Saldo anterior — caderninho");
  });

  test("declaração e título", () => {
    const c = receipt();
    assert.equal(c.title, "Recibo nº A1B2C3D4");
    assert.match(c.statement, /Recebemos de Ana Souza a quantia de R\$ 102,33/);
    assert.match(c.statement, /Venda 3F9A12BC/);
  });
});
