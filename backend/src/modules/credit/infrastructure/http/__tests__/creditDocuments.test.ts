import "dotenv/config";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { withIdempotencyKey } from "../../../../../test/idempotency";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";
import { readFileSync } from "node:fs";
import { keyShape } from "../../../../../test/keyShape";
import { pdfPageCount, pdfPages } from "../../../../../test/pdfText";

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const STORE = { name: "Loja da Dona Maria", cnpj: "11.222.333/0001-81", address: "Rua das Flores, 100 - Centro, São Paulo/SP", phone: "(11) 98888-7777" };

/**
 * Carnê e recibo em PDF e dados da loja. A linha `StoreSettings` e as regras de crédito são globais:
 * segura o lock dos testes de crédito.
 */
describe("Carnê, recibo e dados da loja", () => {
  let release: () => Promise<void>;
  let admin: TestUser;
  let seller: TestUser;
  let stockkeeper: TestUser;
  let customerId: string;
  const variants: { cleanup: () => Promise<void> }[] = [];

  const call = (user: TestUser, method: "GET" | "PUT" | "POST", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as never, headers: withIdempotencyKey(method, { authorization: `Bearer ${user.token}` }) });

  const saveStore = async () => {
    const res = await call(admin, "PUT", "/settings/store", STORE);
    assert.equal(res.statusCode, 200, res.body);
  };

  /**
   * Venda no crediário gravada como o fechamento grava: documento a receber com a entrada (parcela de hoje,
   * paga `atCheckout`, se houver) e as parcelas do plano.
   */
  const createCrediarioSale = async (opts: {
    parcels: number[];
    downPayment?: number;
    cashPrice: number;
    surcharge: number;
    status?: "COMPLETED" | "CANCELED";
    /** Termos de atraso gravados na venda; padrão = valores iniciais das configurações. */
    terms?: { fineBps: number; monthlyInterestBps: number; graceDays: number };
  }) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ cleanup });
    const down = opts.downPayment ?? 0;
    const financed = opts.cashPrice - down;
    const total = down + opts.parcels.reduce((a, b) => a + b, 0);
    const sale = await prisma.sale.create({
      data: {
        customerId,
        status: opts.status ?? "COMPLETED",
        paymentCondition: "CREDIARIO",
        totalAmount: total,
        surchargeAmount: opts.surcharge,
        downPayment: down,
        items: { create: [{ productVariantId: variantId, productName: "Camiseta azul", quantity: 2, unitPrice: opts.cashPrice / 2 }] },
        financing: {
          create: {
            cashPrice: opts.cashPrice,
            downPayment: down,
            downPaymentMethod: down > 0 ? "PIX" : null,
            financedAmount: financed,
            installments: opts.parcels.length,
            monthlyRateBps: 399,
            surchargeAmount: opts.surcharge,
            totalAmount: total,
            firstDueDate: day(addDays(30)),
            ...(opts.terms ?? { fineBps: 200, monthlyInterestBps: 100, graceDays: 3 }),
          },
        },
      },
    });
    const parcels = [
      ...(down > 0 ? [{ amount: down, dueDate: day(TODAY), payments: { create: [{ amount: down, method: "PIX" as const, paymentDate: day(TODAY), atCheckout: true }] } }] : []),
      ...opts.parcels.map((amount, i) => ({ amount, dueDate: day(addDays(30 * (i + 1))) })),
    ];
    const doc = await prisma.financialDocument.create({
      data: { type: "RECEIVABLE", originType: "SALE", originId: sale.id, partyType: "CUSTOMER", partyId: customerId, parcels: { create: parcels } },
      include: { parcels: { include: { payments: true }, orderBy: { dueDate: "asc" } } },
    });
    return { saleId: sale.id, doc };
  };

  before(async () => {
    release = await acquireCreditTestLock();
    await resetCreditDefaults();
  });

  beforeEach(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    seller = await createTestUser({ role: "VENDEDOR" });
    stockkeeper = await createTestUser({ role: "ESTOQUISTA" });
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag, phone: "11977776666", document: null, address: "Av. Brasil, 5" } })).id;
    await prisma.storeSettings.deleteMany();
  });

  afterEach(async () => {
    try {
      await deleteFinancialDocuments({ where: { partyId: customerId } });
      const sales = await prisma.sale.findMany({ where: { customerId }, select: { id: true } });
      await prisma.saleFinancing.deleteMany({ where: { saleId: { in: sales.map((s) => s.id) } } });
      await prisma.sale.deleteMany({ where: { customerId } });
      await prisma.customer.deleteMany({ where: { id: customerId } });
    } finally {
      try {
        for (const v of variants.splice(0)) await v.cleanup();
      } finally {
        await prisma.storeSettings.deleteMany();
        for (const u of [admin, seller, stockkeeper]) await u.cleanup();
      }
    }
  });

  after(async () => {
    try {
      await release();
    } finally {
      try {
        await app.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  describe("dados da loja", () => {
    test("GET sem dados → configured false; PUT grava normalizado; GET devolve", async () => {
      const empty = await call(seller, "GET", "/settings/store");
      assert.equal(empty.statusCode, 200);
      assert.deepEqual(empty.json().data, { name: "", cnpj: "", address: "", phone: "", configured: false, updatedAt: null });
      const fixture = JSON.parse(readFileSync(new URL("../../../../../../../frontend/src/test/fixtures/credit/storeSettings.json", import.meta.url), "utf8"));

      const put = await call(admin, "PUT", "/settings/store", { ...STORE, name: "  Loja   da Dona  Maria " });
      assert.equal(put.statusCode, 200, put.body);
      const data = put.json().data;
      assert.equal(data.name, "Loja da Dona Maria");
      assert.equal(data.cnpj, "11222333000181");
      assert.equal(data.phone, "11988887777");
      assert.equal(data.configured, true);

      assert.deepEqual(keyShape(put.json()), keyShape(fixture));
      const again = await call(admin, "GET", "/settings/store");
      assert.deepEqual(again.json().data, data);
      // Segunda gravação atualiza a mesma linha.
      assert.equal((await call(admin, "PUT", "/settings/store", { ...STORE, address: "Rua Nova, 200" })).statusCode, 200);
      assert.equal(await prisma.storeSettings.count(), 1);
    });

    test("validação: CNPJ inválido, telefone sem DDD, campos vazios → 400", async () => {
      for (const bad of [{ cnpj: "11.222.333/0001-82" }, { phone: "98888" }, { name: " " }, { address: "x" }]) {
        const res = await call(admin, "PUT", "/settings/store", { ...STORE, ...bad });
        assert.equal(res.statusCode, 400, JSON.stringify(bad));
      }
      assert.equal((await call(admin, "PUT", "/settings/store", { name: "A" })).statusCode, 400);
      assert.equal(await prisma.storeSettings.count(), 0);
    });

    test("permissões: GET ADMIN/VENDEDOR; PUT só ADMIN; ESTOQUISTA nada", async () => {
      assert.equal((await call(seller, "GET", "/settings/store")).statusCode, 200);
      assert.equal((await call(seller, "PUT", "/settings/store", STORE)).statusCode, 403);
      assert.equal((await call(stockkeeper, "GET", "/settings/store")).statusCode, 403);
      assert.equal((await call(stockkeeper, "PUT", "/settings/store", STORE)).statusCode, 403);
    });

    test("ativar o crediário: sem dados da loja → 422; com dados completos e aprovador → 200", async () => {
      const approver = await createTestUser({ role: "VENDEDOR", canApproveCredit: true });
      try {
        const blocked = await call(admin, "PUT", "/credit/settings", { crediarioEnabled: true });
        assert.equal(blocked.statusCode, 422);
        assert.equal(blocked.json().code, "STORE_SETTINGS_MISSING");

        await saveStore();
        const ok = await call(admin, "PUT", "/credit/settings", { crediarioEnabled: true });
        assert.equal(ok.statusCode, 200, ok.body);
        assert.equal(ok.json().data.crediarioEnabled, true);
      } finally {
        await resetCreditDefaults();
        await approver.cleanup();
      }
    });
  });

  describe("carnê", () => {
    test("PDF: %PDF, 5 parcelas → 3 páginas (resumo + 2 de canhotos); nome de arquivo seguro; texto do resumo", async () => {
      await saveStore();
      const { saleId } = await createCrediarioSale({ parcels: [224.56, 224.56, 224.56, 224.56, 224.58], cashPrice: 1000, surcharge: 122.82 });
      const res = await call(seller, "GET", `/sales/${saleId}/carne.pdf`);
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(res.headers["content-type"], "application/pdf");
      assert.match(String(res.headers["content-disposition"]), /^inline; filename="carne-[A-F0-9]{8}\.pdf"; filename\*=UTF-8''carne-[A-F0-9]{8}\.pdf$/);
      const pdf = res.rawPayload;
      assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
      assert.equal(pdfPageCount(pdf), 3);

      const pages = pdfPages(pdf);
      assert.equal(pages.length, 3);
      const [summary, stubs1, stubs2] = pages;
      for (const needle of ["Loja da Dona Maria", "Preço à vista", "R$ 1.000,00", "4 × R$ 224,56 + 1 × R$ 224,58", "3,99% ao mês", "R$ 122,82", "Total a prazo", "R$ 1.122,82", "2%", "1% ao mês", "Camiseta azul"]) {
        assert.ok(summary.includes(needle), `resumo sem "${needle}"`);
      }
      assert.equal((stubs1.match(/Parcela \d\/5/g) ?? []).length, 3);
      assert.equal((stubs2.match(/Parcela \d\/5/g) ?? []).length, 2);
      assert.ok(stubs2.includes("R$ 224,58") && stubs2.includes("Parcela 5/5"));
      assert.ok(stubs1.includes("Assinatura"));
    });

    test("com entrada: a entrada não vira canhoto (3 parcelas → 3 canhotos) e aparece no resumo", async () => {
      await saveStore();
      const { saleId } = await createCrediarioSale({ parcels: [75.66, 75.66, 75.65], downPayment: 90, cashPrice: 300, surcharge: 16.97 });
      const res = await call(admin, "GET", `/sales/${saleId}/carne.pdf`);
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(pdfPageCount(res.rawPayload), 2);
      const [summary, stubs] = pdfPages(res.rawPayload);
      assert.ok(summary.includes("R$ 90,00 (Pix)"));
      assert.equal((stubs.match(/Parcela \d\/3/g) ?? []).length, 3);
      assert.ok(!stubs.includes("R$ 90,00"));
    });

    test("multa, juros e carência do carnê são os da venda, não os atuais das configurações", async () => {
      await saveStore();
      const { saleId } = await createCrediarioSale({
        parcels: [100, 100],
        cashPrice: 190,
        surcharge: 10,
        terms: { fineBps: 150, monthlyInterestBps: 120, graceDays: 7 },
      });
      const [summary] = pdfPages((await call(admin, "GET", `/sales/${saleId}/carne.pdf`)).rawPayload);
      for (const needle of ["1,5%", "1,2% ao mês", "7 dias"]) assert.ok(summary.includes(needle), `resumo sem "${needle}"`);
      assert.ok(!summary.includes("1% ao mês"), "carnê usou os juros atuais");
    });

    test("sem dados da loja → 422 STORE_SETTINGS_MISSING", async () => {
      const { saleId } = await createCrediarioSale({ parcels: [100, 100], cashPrice: 190, surcharge: 10 });
      const res = await call(seller, "GET", `/sales/${saleId}/carne.pdf`);
      assert.equal(res.statusCode, 422);
      assert.equal(res.json().code, "STORE_SETTINGS_MISSING");
      assert.equal(res.json().message, "Preencha os dados da loja antes de emitir o carnê.");
    });

    test("venda que não é crediário → 422 NOT_A_CREDIARIO_SALE; cancelada → 422; inexistente → 404; id inválido → 400", async () => {
      await saveStore();
      const cash = await prisma.sale.create({ data: { customerId, status: "COMPLETED", paymentCondition: "CASH", totalAmount: 10 } });
      try {
        const res = await call(admin, "GET", `/sales/${cash.id}/carne.pdf`);
        assert.equal(res.statusCode, 422);
        assert.equal(res.json().code, "NOT_A_CREDIARIO_SALE");
      } finally {
        await prisma.sale.delete({ where: { id: cash.id } });
      }
      const { saleId } = await createCrediarioSale({ parcels: [100], cashPrice: 100, surcharge: 0, status: "CANCELED" });
      assert.equal((await call(admin, "GET", `/sales/${saleId}/carne.pdf`)).json().code, "SALE_ALREADY_CANCELED");
      assert.equal((await call(admin, "GET", `/sales/${randomUUID()}/carne.pdf`)).statusCode, 404);
      assert.equal((await call(admin, "GET", `/sales/nao-e-uuid/carne.pdf`)).statusCode, 400);
    });

    test("ESTOQUISTA não emite carnê (403)", async () => {
      assert.equal((await call(stockkeeper, "GET", `/sales/${randomUUID()}/carne.pdf`)).statusCode, 403);
    });
  });

  describe("recibo", () => {
    const payParcel = (docId: string, parcelId: string, body: Record<string, unknown>) =>
      call(admin, "POST", `/receivables/${docId}/parcels/${parcelId}/payments`, { method: "PIX", ...body });

    test("recibo mostra principal, multa, juros, dispensa e total recebido", async () => {
      await saveStore();
      // Parcela de 100,00 vencida há 10 dias: multa 2,00 + juros 0,33; dispensa de 1,00 → recebido 101,33.
      const doc = await prisma.financialDocument.create({
        data: {
          type: "RECEIVABLE", originType: "SALE", originId: randomUUID(), partyType: "CUSTOMER", partyId: customerId,
          parcels: { create: [{ amount: 100, dueDate: day(addDays(-10)) }] },
        },
        include: { parcels: true },
      });
      const paid = await payParcel(doc.id, doc.parcels[0].id, { amount: 100, waiveAmount: 1, waiverReason: "Cliente antigo" });
      assert.equal(paid.statusCode, 201, paid.body);
      const payment = await prisma.payment.findFirstOrThrow({ where: { parcelId: doc.parcels[0].id } });

      const res = await call(seller, "GET", `/receivables/payments/${payment.id}/receipt.pdf`);
      assert.equal(res.statusCode, 200, res.body);
      assert.equal(res.headers["content-type"], "application/pdf");
      assert.match(String(res.headers["content-disposition"]), /^inline; filename="recibo-[A-F0-9]{8}\.pdf"/);
      assert.equal(pdfPageCount(res.rawPayload), 1);
      const [text] = pdfPages(res.rawPayload);
      for (const needle of ["Recibo nº", "Valor da parcela (principal)", "R$ 100,00", "R$ 2,00", "R$ 0,33", "- R$ 1,00", "Cliente antigo", "Total recebido", "R$ 101,33", "Loja da Dona Maria", "Pix"]) {
        assert.ok(text.includes(needle), `recibo sem "${needle}"`);
      }
    });

    test("recibo de pagamento com data passada mostra o motivo", async () => {
      await saveStore();
      const doc = await prisma.financialDocument.create({
        data: {
          type: "RECEIVABLE", originType: "MANUAL", originId: randomUUID(), partyType: "CUSTOMER", partyId: customerId,
          createdAt: new Date(`${addDays(-30)}T12:00:00.000Z`),
          parcels: { create: [{ amount: 100, dueDate: day(addDays(-5)) }] },
        },
        include: { parcels: true },
      });
      const paid = await payParcel(doc.id, doc.parcels[0].id, { amount: 100, paymentDate: addDays(-5), backdateReason: "Pagou no balcão, lançado hoje" });
      assert.equal(paid.statusCode, 201, paid.body);
      const payment = await prisma.payment.findFirstOrThrow({ where: { parcelId: doc.parcels[0].id } });
      const [text] = pdfPages((await call(admin, "GET", `/receivables/payments/${payment.id}/receipt.pdf`)).rawPayload);
      for (const needle of ["Motivo da data retroativa", "Pagou no balcão, lançado hoje"]) {
        assert.ok(text.includes(needle), `recibo sem "${needle}"`);
      }
    });

    test("recibo da entrada do crediário diz 'Entrada'; parcela do plano é numerada sem contar a entrada", async () => {
      await saveStore();
      const { doc } = await createCrediarioSale({ parcels: [75.66, 75.66, 75.65], downPayment: 90, cashPrice: 300, surcharge: 16.97 });
      const down = doc.parcels[0].payments[0];
      const entry = pdfPages((await call(admin, "GET", `/receivables/payments/${down.id}/receipt.pdf`)).rawPayload)[0];
      assert.ok(entry.includes("Entrada") && entry.includes("R$ 90,00"));

      const paid = await payParcel(doc.id, doc.parcels[1].id, { amount: 75.66, paymentDate: undefined });
      assert.equal(paid.statusCode, 201, paid.body);
      const payment = await prisma.payment.findFirstOrThrow({ where: { parcelId: doc.parcels[1].id } });
      const text = pdfPages((await call(admin, "GET", `/receivables/payments/${payment.id}/receipt.pdf`)).rawPayload)[0];
      assert.ok(text.includes("1/3"), "primeira parcela do plano = 1/3");
    });

    test("sem dados da loja → 422; estornado → 422; inexistente → 404; ESTOQUISTA → 403", async () => {
      const doc = await prisma.financialDocument.create({
        data: {
          type: "RECEIVABLE", originType: "MANUAL", originId: randomUUID(), partyType: "CUSTOMER", partyId: customerId,
          parcels: { create: [{ amount: 50, dueDate: day(addDays(5)) }] },
        },
        include: { parcels: true },
      });
      const paid = await payParcel(doc.id, doc.parcels[0].id, { amount: 50 });
      assert.equal(paid.statusCode, 201, paid.body);
      const payment = await prisma.payment.findFirstOrThrow({ where: { parcelId: doc.parcels[0].id } });
      const url = `/receivables/payments/${payment.id}/receipt.pdf`;

      const noStore = await call(seller, "GET", url);
      assert.equal(noStore.statusCode, 422);
      assert.equal(noStore.json().code, "STORE_SETTINGS_MISSING");
      assert.equal(noStore.json().message, "Preencha os dados da loja antes de emitir o recibo.");

      await saveStore();
      assert.equal((await call(seller, "GET", url)).statusCode, 200);
      assert.equal((await call(stockkeeper, "GET", url)).statusCode, 403);
      assert.equal((await call(admin, "GET", `/receivables/payments/${randomUUID()}/receipt.pdf`)).statusCode, 404);

      await prisma.payment.update({ where: { id: payment.id }, data: { reversedAt: new Date(), reversalReason: "teste" } });
      const reversed = await call(admin, "GET", url);
      assert.equal(reversed.statusCode, 422);
      assert.equal(reversed.json().code, "PAYMENT_ALREADY_REVERSED");
    });
  });
});
