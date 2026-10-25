import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { randomCpf } from "../../../../../test/documentFixtures";
import { maxExportRows } from "../controllers/reportControllers";
import { parseCsv } from "../../../../../test/csvParse";

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

// Janela de vendas exclusiva deste arquivo.
const WIN_FROM = "2095-03-09";
const WIN_TO = "2095-03-11";

describe("Relatórios CSV", () => {
  let admin: TestUser;
  let seller: TestUser;
  let stocker: TestUser;
  const tag = `tx-test-${randomUUID()}`;
  const customerName = `=HYP;"${tag}"`;
  let customerId: string;
  let supplierId: string;
  let variantId: string;
  let variantCleanup: () => Promise<void>;
  let variantCode: string;
  let saleA: string;
  let saleB: string;
  let saleC: string;
  let recvOpen: string;
  let recvPaid: string;
  let payOpen: string;
  let purchaseId: string;
  const purchaseCode = `tx-${randomUUID().slice(0, 8)}`;

  const get = (url: string, user: TestUser = admin) =>
    app.inject({ method: "GET", url, headers: { authorization: `Bearer ${user.token}` } });
  const csv = async (url: string, user: TestUser = admin) => {
    const res = await get(url, user);
    assert.equal(res.statusCode, 200, res.body);
    return { res, rows: parseCsv(res.body) };
  };

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    seller = await createTestUser({ role: "VENDEDOR" });
    stocker = await createTestUser({ role: "ESTOQUISTA" });
    customerId = (await prisma.customer.create({ data: { name: customerName, code: tag } })).id;
    supplierId = (await prisma.supplier.create({ data: { name: `forn ${tag}`, document: randomCpf() } })).id;
    const v = await createTestVariant();
    variantId = v.variantId;
    variantCleanup = v.cleanup;
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    variantCode = variant.code;
    await prisma.productVariant.update({ where: { id: variantId }, data: { barcode: `bc-${tag}` } });
    await prisma.inventory.create({
      data: { productVariantId: variantId, quantity: 10, reservedQuantity: 3, averageCost: 2.5 },
    });

    const mkSale = (createdAt: string, status: "COMPLETED" | "CANCELED", total: number) =>
      prisma.sale.create({
        data: {
          customerId,
          status,
          totalAmount: total,
          createdAt: new Date(createdAt),
          items: {
            create: [
              { productVariantId: variantId, productName: `Prod ${tag}`, sku: variantCode, quantity: 3, unitPrice: 12.5 },
              { productVariantId: variantId, productName: `Outro, "x"`, quantity: 1, unitPrice: 1234.5 },
            ],
          },
        },
      });
    // 02:30Z do dia 10 = 23:30 BRT do dia 09.
    saleA = (await mkSale("2095-03-10T02:30:00.000Z", "COMPLETED", 1272)).id;
    saleB = (await mkSale("2095-03-10T12:00:00.000Z", "COMPLETED", 1272)).id;
    saleC = (await mkSale("2095-03-11T15:00:00.000Z", "CANCELED", 1272)).id;
    await mkSale("2095-04-20T15:00:00.000Z", "COMPLETED", 1272); // fora da janela

    const mkDoc = async (
      type: "RECEIVABLE" | "PAYABLE",
      status: "OPEN" | "PAID" | "CANCELED",
      originId: string,
      parcels: { amount: number; due: string; pay?: number }[],
    ) => {
      const doc = await prisma.financialDocument.create({
        data: {
          type,
          originType: type === "RECEIVABLE" ? "SALE" : "PURCHASE",
          originId,
          partyId: type === "RECEIVABLE" ? customerId : supplierId,
          partyType: type === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER",
          status,
        },
      });
      for (const p of parcels) {
        await prisma.financialParcel.create({
          data: {
            financialDocumentId: doc.id,
            amount: p.amount,
            dueDate: asDate(p.due),
            payments: p.pay
              ? { create: [{ amount: p.pay, method: "PIX", paymentDate: asDate(TODAY), createdById: admin.id }] }
              : undefined,
          },
        });
      }
      return doc.id;
    };
    recvOpen = await mkDoc("RECEIVABLE", "OPEN", saleA, [
      { amount: 100.5, due: "2095-05-10", pay: 40.25 },
      { amount: 50, due: "2095-06-10" },
    ]);
    recvPaid = await mkDoc("RECEIVABLE", "PAID", randomUUID(), [{ amount: 30, due: "2095-05-12", pay: 30 }]);
    purchaseId = (
      await prisma.purchase.create({
        data: { code: purchaseCode, supplierId, status: "PENDING", origin: "MANUAL", purchaseDate: asDate("2095-01-01") },
      })
    ).id;
    payOpen = await mkDoc("PAYABLE", "OPEN", purchaseId, [{ amount: 80, due: "2095-05-20" }]);
    await mkDoc("PAYABLE", "PAID", randomUUID(), [{ amount: 10, due: "2095-05-21", pay: 10 }]);
  });

  after(async () => {
    try {
      await prisma.financialDocument.deleteMany({ where: { partyId: { in: [customerId, supplierId] } } });
      await prisma.sale.deleteMany({ where: { customerId } });
      await prisma.purchase.deleteMany({ where: { id: purchaseId } });
      await variantCleanup();
      await prisma.customer.deleteMany({ where: { id: customerId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
      await admin.cleanup();
      await seller.cleanup();
      await stocker.cleanup();
    } finally {
      try {
        await app.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  test("vendas: colunas, vírgula decimal, data dd/mm/aaaa em BRT, escape e fórmula neutralizada", async () => {
    const { res, rows } = await csv(`/reports/sales.csv?from=${WIN_FROM}&to=${WIN_TO}`);
    assert.equal(res.headers["content-type"], "text/csv; charset=utf-8");
    assert.equal(res.body.charCodeAt(0), 0xfeff);
    assert.ok(res.body.includes("\r\n"));
    assert.deepEqual(rows[0], ["Venda", "Data", "Cliente", "Status", "Itens", "Total"]);
    const mine = rows.filter((r) => r[2] === `'${customerName}`);
    assert.equal(mine.length, 3); // A, B, C; a de abril fica de fora
    const byId = new Map(mine.map((r) => [r[0], r]));
    assert.equal(byId.get(saleA)![1], "09/03/2095"); // 23:30 BRT do dia 09
    assert.equal(byId.get(saleB)![1], "10/03/2095");
    assert.equal(byId.get(saleC)![1], "11/03/2095");
    assert.equal(byId.get(saleA)![4], "2");
    assert.equal(byId.get(saleA)![5], "1272,00");
    assert.ok(res.body.includes(`"'=HYP;""${tag}"""`));
  });

  test("vendas: filtro de status e fronteira de dias pelo fuso de negócio", async () => {
    const canceled = (await csv(`/reports/sales.csv?from=${WIN_FROM}&to=${WIN_TO}&status=CANCELED`)).rows;
    assert.deepEqual(
      canceled.filter((r) => r[2] === `'${customerName}`).map((r) => r[0]),
      [saleC],
    );
    const day10 = (await csv(`/reports/sales.csv?from=2095-03-10&to=2095-03-10`)).rows;
    assert.deepEqual(
      day10.filter((r) => r[2] === `'${customerName}`).map((r) => r[0]),
      [saleB],
    );
    const day09 = (await csv(`/reports/sales.csv?from=2095-03-09&to=2095-03-09`)).rows;
    assert.deepEqual(
      day09.filter((r) => r[2] === `'${customerName}`).map((r) => r[0]),
      [saleA],
    );
  });

  test("vendas e itens: período obrigatório, válido e de até 366 dias", async () => {
    for (const path of ["sales", "sale-items"]) {
      for (const q of [
        "",
        "?from=2095-03-09",
        "?to=2095-03-09",
        "?from=2095-03-10&to=2095-03-09",
        "?from=2095-02-30&to=2095-03-09",
        "?from=2095-01-01&to=2096-01-02", // 367 dias
        `?from=${WIN_FROM}&to=${WIN_TO}&status=XYZ`,
      ]) {
        if (path === "sale-items" && q.includes("status")) continue;
        const res = await get(`/reports/${path}.csv${q}`);
        assert.equal(res.statusCode, 400, `${path}${q}: ${res.body}`);
        assert.equal(res.json().code, "VALIDATION_ERROR");
      }
      const ok = await get(`/reports/${path}.csv?from=2095-01-01&to=2096-01-01`); // 366 dias
      assert.equal(ok.statusCode, 200, ok.body);
    }
  });

  test("itens vendidos: colunas e totais; venda cancelada fica de fora", async () => {
    const { rows } = await csv(`/reports/sale-items.csv?from=${WIN_FROM}&to=${WIN_TO}`);
    assert.deepEqual(rows[0], [
      "Venda", "Data", "Cliente", "Produto", "Variante", "Código", "Quantidade", "Preço unitário", "Total",
    ]);
    const mine = rows.filter((r) => r[2] === `'${customerName}`);
    assert.equal(mine.length, 4); // 2 itens × (A, B)
    assert.deepEqual(new Set(mine.map((r) => r[0])), new Set([saleA, saleB]));
    const first = mine.find((r) => r[0] === saleA && r[3] === `Prod ${tag}`)!;
    assert.equal(first[1], "09/03/2095");
    assert.equal(first[5], variantCode);
    assert.equal(first[6], "3");
    assert.equal(first[7], "12,50");
    assert.equal(first[8], "37,50");
    const second = mine.find((r) => r[0] === saleA && r[3] === `Outro, "x"`)!;
    assert.equal(second[7], "1234,50");
    assert.equal(second[8], "1234,50");
  });

  test("estoque: colunas, disponível e valor em estoque", async () => {
    const { res, rows } = await csv("/reports/stock.csv");
    assert.deepEqual(rows[0], [
      "Produto", "Variante", "Código", "Código de barras", "Quantidade", "Reservado", "Disponível", "Custo médio", "Valor em estoque",
    ]);
    const mine = rows.find((r) => r[2] === variantCode)!;
    assert.ok(mine, "linha do teste");
    assert.deepEqual(mine.slice(3), [`bc-${tag}`, "10", "3", "7", "2,50", "25,00"]);
    assert.match(res.headers["content-disposition"] as string, new RegExp(`^attachment; filename="estoque-${TODAY}\\.csv"$`));
  });

  test("contas a receber: uma linha por parcela, filtros da lista (openOnly, cliente)", async () => {
    const { rows } = await csv(`/reports/receivables.csv?customerId=${customerId}`);
    assert.deepEqual(rows[0], ["Documento", "Cliente", "Origem", "Parcela", "Vencimento", "Valor", "Pago", "Saldo", "Status"]);
    assert.equal(rows.length, 1 + 3);
    const open1 = rows.find((r) => r[0] === recvOpen && r[3] === "1")!;
    assert.deepEqual(open1.slice(1), [`'${customerName}`, `Venda ${saleA}`, "1", "10/05/2095", "100,50", "40,25", "60,25", "Parcialmente paga"]);
    const open2 = rows.find((r) => r[0] === recvOpen && r[3] === "2")!;
    assert.deepEqual(open2.slice(4), ["10/06/2095", "50,00", "0,00", "50,00", "Em aberto"]);
    assert.ok(rows.some((r) => r[0] === recvPaid && r[8] === "Paga"));

    const openOnly = (await csv(`/reports/receivables.csv?customerId=${customerId}&openOnly=true`)).rows;
    assert.deepEqual(new Set(openOnly.slice(1).map((r) => r[0])), new Set([recvOpen]));
    assert.equal(openOnly.length, 3);

    const ranged = (await csv(`/reports/receivables.csv?customerId=${customerId}&openOnly=true&dueFrom=2095-06-01&dueTo=2095-06-30`)).rows;
    // Só as parcelas dentro do intervalo (e com saldo).
    assert.equal(ranged.length, 2);
    assert.deepEqual([ranged[1][0], ranged[1][3], ranged[1][4]], [recvOpen, "2", "10/06/2095"]);
    const rangedAll = (await csv(`/reports/receivables.csv?customerId=${customerId}&dueFrom=2095-05-01&dueTo=2095-05-31`)).rows;
    assert.deepEqual(rangedAll.slice(1).map((r) => `${r[0]}#${r[3]}`).sort(), [`${recvOpen}#1`, `${recvPaid}#1`].sort());
    const none = (await csv(`/reports/receivables.csv?customerId=${customerId}&status=CANCELED`)).rows;
    assert.equal(none.length, 1);
    const bad = await get("/reports/receivables.csv?openOnly=talvez");
    assert.equal(bad.statusCode, 400);
  });

  test("contas a receber: openOnly exporta só parcelas com saldo, também combinado com o intervalo", async () => {
    const doc = await prisma.financialDocument.create({
      data: { type: "RECEIVABLE", originType: "MANUAL", originId: randomUUID(), partyId: customerId, partyType: "CUSTOMER", status: "OPEN" },
    });
    try {
      await prisma.financialParcel.create({
        data: {
          financialDocumentId: doc.id, amount: 20, dueDate: asDate("2095-07-05"),
          payments: { create: [{ amount: 20, method: "PIX", paymentDate: asDate(TODAY), createdById: admin.id }] },
        },
      });
      await prisma.financialParcel.create({ data: { financialDocumentId: doc.id, amount: 30, dueDate: asDate("2095-07-25") } });
      const only = (await csv(`/reports/receivables.csv?customerId=${customerId}&openOnly=true`)).rows.filter((r) => r[0] === doc.id);
      assert.equal(only.length, 1);
      assert.equal(only[0][7], "30,00");
      const combined = (await csv(`/reports/receivables.csv?customerId=${customerId}&openOnly=true&dueFrom=2095-07-01&dueTo=2095-07-10`)).rows;
      assert.equal(combined.filter((r) => r[0] === doc.id).length, 0);
      const combined2 = (await csv(`/reports/receivables.csv?customerId=${customerId}&openOnly=true&dueFrom=2095-07-01&dueTo=2095-07-31`)).rows;
      assert.equal(combined2.filter((r) => r[0] === doc.id).length, 1);
      const origem = (await csv(`/reports/receivables.csv?customerId=${customerId}`)).rows.find((r) => r[0] === doc.id)!;
      assert.equal(origem[2], "Manual");
    } finally {
      await prisma.financialDocument.deleteMany({ where: { id: doc.id } });
    }
  });

  test("contas a pagar: pedido, fornecedor e filtros", async () => {
    const { rows } = await csv(`/reports/payables.csv?supplierId=${supplierId}&openOnly=true`);
    assert.deepEqual(rows[0], ["Documento", "Fornecedor", "Pedido", "Parcela", "Vencimento", "Valor", "Pago", "Saldo", "Status"]);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], [payOpen, `forn ${tag}`, purchaseCode, "1", "20/05/2095", "80,00", "0,00", "80,00", "Em aberto"]);
    const all = (await csv(`/reports/payables.csv?supplierId=${supplierId}`)).rows;
    assert.equal(all.length, 3);
  });

  test("limite de linhas: 422 EXPORT_TOO_LARGE em todos os relatórios", async () => {
    process.env.REPORT_MAX_ROWS = "2";
    try {
      const urls = [
        `/reports/sales.csv?from=${WIN_FROM}&to=${WIN_TO}`, // 3 vendas
        `/reports/sale-items.csv?from=${WIN_FROM}&to=${WIN_TO}`, // 4 itens
        `/reports/receivables.csv?customerId=${customerId}`, // 3 parcelas
        "/reports/stock.csv", // pode ter qualquer quantidade; garantimos > 2 abaixo
      ];
      const extra = await createTestVariant();
      const extra2 = await createTestVariant();
      try {
        await prisma.inventory.create({ data: { productVariantId: extra.variantId, quantity: 1 } });
        await prisma.inventory.create({ data: { productVariantId: extra2.variantId, quantity: 1 } });
        for (const url of urls) {
          const res = await get(url);
          assert.equal(res.statusCode, 422, `${url}: ${res.body}`);
          assert.equal(res.json().code, "EXPORT_TOO_LARGE");
          assert.equal(res.json().message, "Muitos registros para exportar. Refine os filtros.");
        }
      } finally {
        await extra.cleanup();
        await extra2.cleanup();
      }
      // Exatamente no limite passa.
      process.env.REPORT_MAX_ROWS = "3";
      const ok = await get(`/reports/sales.csv?from=${WIN_FROM}&to=${WIN_TO}`);
      assert.equal(ok.statusCode, 200);
      const payables = await get(`/reports/payables.csv?supplierId=${supplierId}`);
      assert.equal(payables.statusCode, 200);
    } finally {
      delete process.env.REPORT_MAX_ROWS;
    }
  });

  test("REPORT_MAX_ROWS acima do padrão é limitado e valores inválidos usam o padrão", () => {
    try {
      process.env.REPORT_MAX_ROWS = "999999999";
      assert.equal(maxExportRows(), 50_000);
      for (const bad of ["0", "-5", "abc", "1.5", ""]) {
        process.env.REPORT_MAX_ROWS = bad;
        assert.equal(maxExportRows(), 50_000, bad);
      }
      process.env.REPORT_MAX_ROWS = "7";
      assert.equal(maxExportRows(), 7);
    } finally {
      delete process.env.REPORT_MAX_ROWS;
    }
  });

  test("permissões por papel e Content-Disposition com o nome do relatório", async () => {
    const q = `from=${WIN_FROM}&to=${WIN_TO}`;
    const cases: { url: string; name: string; allowed: TestUser[]; denied: TestUser[] }[] = [
      { url: `/reports/sales.csv?${q}`, name: "vendas", allowed: [admin, seller], denied: [stocker] },
      { url: `/reports/sale-items.csv?${q}`, name: "itens-vendidos", allowed: [admin, seller], denied: [stocker] },
      { url: "/reports/stock.csv", name: "estoque", allowed: [admin, seller, stocker], denied: [] },
      { url: `/reports/receivables.csv?customerId=${customerId}`, name: "contas-a-receber", allowed: [admin, seller], denied: [stocker] },
      { url: `/reports/payables.csv?supplierId=${supplierId}`, name: "contas-a-pagar", allowed: [admin], denied: [seller, stocker] },
    ];
    for (const c of cases) {
      for (const u of c.allowed) {
        const res = await get(c.url, u);
        assert.equal(res.statusCode, 200, `${c.name} ${u.role}`);
        assert.equal(res.headers["content-disposition"], `attachment; filename="${c.name}-${TODAY}.csv"`);
      }
      for (const u of c.denied) {
        const res = await get(c.url, u);
        assert.equal(res.statusCode, 403, `${c.name} ${u.role}`);
      }
    }
    const anon = await app.inject({ method: "GET", url: "/reports/stock.csv" });
    assert.equal(anon.statusCode, 401);
  });
});
