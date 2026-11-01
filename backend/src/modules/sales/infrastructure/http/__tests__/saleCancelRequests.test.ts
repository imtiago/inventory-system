import "dotenv/config";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { withIdempotencyKey } from "../../../../../test/idempotency";
import { convertToLegacyInstallments } from "../../../../../test/legacySaleFixtures";

app.log.level = "silent";

const inThirtyDays = () => {
  const d = new Date(`${todayInBusinessTz()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
};

describe("pedidos de cancelamento de venda", () => {
  let admin: TestUser;
  let seller: TestUser;
  let customerId: string;
  const variants: { id: string; cleanup: () => Promise<void> }[] = [];

  const call = (user: TestUser, method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: withIdempotencyKey(method, { authorization: `Bearer ${user.token}` }),
    });

  const createVariant = async () => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice: 10 } });
    const res = await call(admin, "POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity: 10,
      unitCost: 5,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
    return variantId;
  };

  const createSale = async (variantId: string, installments = 1) => {
    const res = await call(seller, "POST", "/sales", {
      customerId,
      items: [{ productVariantId: variantId, quantity: 2 }],
      payment: { condition: "CASH" },
    });
    assert.equal(res.statusCode, 201, res.body);
    const saleId = res.json().data.id as string;
    // Conta a receber em aberto: venda parcelada antiga (o parcelado saiu da API).
    await convertToLegacyInstallments(saleId, installments, installments > 1 ? inThirtyDays() : undefined);
    return saleId;
  };

  const qty = async (variantId: string) =>
    (await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: variantId } })).quantity;

  const requestCancel = (user: TestUser, saleId: string, reason = "Cliente desistiu") =>
    call(user, "POST", `/sales/${saleId}/cancel-requests`, { reason });

  beforeEach(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    seller = await createTestUser({ role: "VENDEDOR" });
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  });

  afterEach(async () => {
    const id = customerId;
    const toClean = variants.splice(0);
    try {
      try {
        await deleteFinancialDocuments({ where: { partyId: id } });
      } finally {
        const sales = await prisma.sale.findMany({ where: { customerId: id }, select: { id: true } });
        await prisma.saleCancelRequest.deleteMany({ where: { saleId: { in: sales.map((s) => s.id) } } });
        await prisma.sale.deleteMany({ where: { customerId: id } });
      }
    } finally {
      try {
        for (const v of toClean) await v.cleanup();
      } finally {
        try {
          await prisma.customer.deleteMany({ where: { id } });
        } finally {
          await admin.cleanup();
          await seller.cleanup();
        }
      }
    }
  });

  after(async () => {
    try {
      await app.close();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("VENDEDOR: POST /sales/:id/cancel → 403; POST /sales/:id/cancel-requests → 201 PENDING", async () => {
    const saleId = await createSale(await createVariant());

    const direct = await call(seller, "POST", `/sales/${saleId}/cancel`);
    assert.equal(direct.statusCode, 403, direct.body);

    const res = await requestCancel(seller, saleId);
    assert.equal(res.statusCode, 201, res.body);
    const dto = res.json().data;
    assert.equal(dto.status, "PENDING");
    assert.equal(dto.saleId, saleId);
    assert.equal(dto.reason, "Cliente desistiu");
    assert.equal(dto.customerName.startsWith("tx-test-"), true);
    assert.equal(dto.total, 20);
    assert.deepEqual(dto.requestedBy, { id: seller.id, name: seller.name });
    assert.equal(dto.decidedBy, null);
    assert.equal(dto.decidedAt, null);
    assert.equal(dto.decisionReason, null);
    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status, "COMPLETED");

    const bad = await requestCancel(seller, saleId, "ab");
    assert.equal(bad.statusCode, 400, bad.body);
  });

  test("segundo pedido para a mesma venda → 409 CANCEL_REQUEST_ALREADY_PENDING (dois simultâneos: um 201, outro 409)", async () => {
    const saleId = await createSale(await createVariant());
    const [a, b] = await Promise.all([requestCancel(seller, saleId), requestCancel(admin, saleId, "Outro motivo")]);
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [201, 409], `${a.body} ${b.body}`);
    const loser = a.statusCode === 409 ? a : b;
    assert.equal(loser.json().code, "CANCEL_REQUEST_ALREADY_PENDING");
    assert.equal(loser.json().message, "Já existe um pedido de cancelamento em aberto para esta venda.");

    const again = await requestCancel(seller, saleId);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, "CANCEL_REQUEST_ALREADY_PENDING");
    assert.equal(await prisma.saleCancelRequest.count({ where: { saleId } }), 1);
  });

  test("pedido para venda cancelada → 409 SALE_ALREADY_CANCELED; venda com pagamento de parcela → 409 SALE_HAS_PAYMENTS", async () => {
    const v = await createVariant();
    const canceled = await createSale(v);
    assert.equal((await call(admin, "POST", `/sales/${canceled}/cancel`)).statusCode, 200);
    const r1 = await requestCancel(seller, canceled);
    assert.equal(r1.statusCode, 409, r1.body);
    assert.equal(r1.json().code, "SALE_ALREADY_CANCELED");

    const paid = await createSale(v, 2);
    const doc = await prisma.financialDocument.findFirstOrThrow({ where: { originId: paid }, include: { parcels: true } });
    await prisma.payment.create({ data: { parcelId: doc.parcels[0].id, amount: 5, method: "PIX" } });
    const r2 = await requestCancel(seller, paid);
    assert.equal(r2.statusCode, 409, r2.body);
    assert.equal(r2.json().code, "SALE_HAS_PAYMENTS");
    assert.equal(await prisma.saleCancelRequest.count({ where: { saleId: paid } }), 0);

    const missing = await requestCancel(seller, randomUUID());
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().code, "SALE_NOT_FOUND");
  });

  test("ADMIN aprova → venda CANCELED, estoque devolvido, contas a receber cancelado, pedido APPROVED com decidedBy", async () => {
    const v = await createVariant();
    const saleId = await createSale(v);
    assert.equal(await qty(v), 8);
    const created = (await requestCancel(seller, saleId)).json().data;

    const denied = await call(seller, "POST", `/sales/cancel-requests/${created.id}/approve`);
    assert.equal(denied.statusCode, 403);

    const res = await call(admin, "POST", `/sales/cancel-requests/${created.id}/approve`);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.status, "APPROVED");
    assert.deepEqual(res.json().data.decidedBy, { id: admin.id, name: admin.name });
    assert.ok(res.json().data.decidedAt);

    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status, "CANCELED");
    assert.equal(await qty(v), 10);
    const doc = await prisma.financialDocument.findFirstOrThrow({ where: { originId: saleId } });
    assert.equal(doc.status, "CANCELED");
    const row = await prisma.saleCancelRequest.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.status, "APPROVED");
    assert.equal(row.decidedById, admin.id);

    const again = await call(admin, "POST", `/sales/cancel-requests/${created.id}/approve`);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, "CANCEL_REQUEST_NOT_PENDING");
    const nf = await call(admin, "POST", `/sales/cancel-requests/${randomUUID()}/approve`);
    assert.equal(nf.statusCode, 404);
    assert.equal(nf.json().code, "CANCEL_REQUEST_NOT_FOUND");
  });

  test("aprovar quando a venda ganhou pagamento depois do pedido → 409 SALE_HAS_PAYMENTS e o pedido continua PENDING", async () => {
    const v = await createVariant();
    const saleId = await createSale(v, 2);
    const created = (await requestCancel(seller, saleId)).json().data;
    const doc = await prisma.financialDocument.findFirstOrThrow({ where: { originId: saleId }, include: { parcels: true } });
    await prisma.payment.create({ data: { parcelId: doc.parcels[0].id, amount: 5, method: "PIX" } });

    const res = await call(admin, "POST", `/sales/cancel-requests/${created.id}/approve`);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(res.json().code, "SALE_HAS_PAYMENTS");
    assert.equal((await prisma.saleCancelRequest.findUniqueOrThrow({ where: { id: created.id } })).status, "PENDING");
    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status, "COMPLETED");
    assert.equal(await qty(v), 8);
  });

  test("recusar exige motivo; grava REJECTED e decisionReason; venda intacta", async () => {
    const v = await createVariant();
    const saleId = await createSale(v);
    const created = (await requestCancel(seller, saleId)).json().data;

    const noReason = await call(admin, "POST", `/sales/cancel-requests/${created.id}/reject`, {});
    assert.equal(noReason.statusCode, 400, noReason.body);
    const short = await call(admin, "POST", `/sales/cancel-requests/${created.id}/reject`, { reason: "ab" });
    assert.equal(short.statusCode, 400);
    const denied = await call(seller, "POST", `/sales/cancel-requests/${created.id}/reject`, { reason: "Não pode" });
    assert.equal(denied.statusCode, 403);

    const res = await call(admin, "POST", `/sales/cancel-requests/${created.id}/reject`, { reason: "Venda correta" });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.status, "REJECTED");
    assert.equal(res.json().data.decisionReason, "Venda correta");
    assert.deepEqual(res.json().data.decidedBy, { id: admin.id, name: admin.name });
    assert.equal((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status, "COMPLETED");
    assert.equal(await qty(v), 8);

    const again = await call(admin, "POST", `/sales/cancel-requests/${created.id}/reject`, { reason: "Venda correta" });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, "CANCEL_REQUEST_NOT_PENDING");

    // Rejeitado libera um novo pedido.
    assert.equal((await requestCancel(seller, saleId)).statusCode, 201);
  });

  test("ADMIN cancela direto com pedido pendente → pedido APPROVED", async () => {
    const saleId = await createSale(await createVariant());
    const created = (await requestCancel(seller, saleId)).json().data;
    const res = await call(admin, "POST", `/sales/${saleId}/cancel`);
    assert.equal(res.statusCode, 200, res.body);
    const row = await prisma.saleCancelRequest.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.status, "APPROVED");
    assert.equal(row.decidedById, admin.id);
    assert.ok(row.decidedAt);
  });

  test("detalhe da venda traz pendingCancelRequest; lista e contador só para sales.cancel", async () => {
    const saleId = await createSale(await createVariant());
    const before = await call(seller, "GET", `/sales/${saleId}`);
    assert.equal(before.json().data.pendingCancelRequest, null);

    const created = (await requestCancel(seller, saleId)).json().data;
    const detail = await call(seller, "GET", `/sales/${saleId}`);
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().data.pendingCancelRequest.id, created.id);
    assert.equal(detail.json().data.pendingCancelRequest.status, "PENDING");

    assert.equal((await call(seller, "GET", "/sales/cancel-requests?status=PENDING")).statusCode, 403);
    assert.equal((await call(seller, "GET", "/sales/cancel-requests/count")).statusCode, 403);

    const list = await call(admin, "GET", "/sales/cancel-requests?status=PENDING&limit=100");
    assert.equal(list.statusCode, 200, list.body);
    const found = list.json().data.find((r: { id: string }) => r.id === created.id);
    assert.equal(found.saleId, saleId);
    assert.ok(list.json().pagination);

    const count = await call(admin, "GET", "/sales/cancel-requests/count");
    assert.equal(count.statusCode, 200);
    assert.equal(typeof count.json().data.pending, "number");
    assert.ok(count.json().data.pending >= 1);

    await call(admin, "POST", `/sales/${saleId}/cancel`);
    const after = await call(admin, "GET", `/sales/${saleId}`);
    assert.equal(after.json().data.pendingCancelRequest, null);
  });

  test("detalhe da venda traz o último pedido decidido (recusado, com o motivo) para o vendedor", async () => {
    const saleId = await createSale(await createVariant());
    const empty = await call(seller, "GET", `/sales/${saleId}`);
    assert.equal(empty.json().data.latestDecidedCancelRequest, null);

    const first = (await requestCancel(seller, saleId, "Cliente desistiu")).json().data;
    const rejected = await call(admin, "POST", `/sales/cancel-requests/${first.id}/reject`, { reason: "Venda correta" });
    assert.equal(rejected.statusCode, 200, rejected.body);

    const detail = (await call(seller, "GET", `/sales/${saleId}`)).json().data;
    assert.equal(detail.pendingCancelRequest, null);
    assert.equal(detail.latestDecidedCancelRequest.id, first.id);
    assert.equal(detail.latestDecidedCancelRequest.status, "REJECTED");
    assert.equal(detail.latestDecidedCancelRequest.decisionReason, "Venda correta");
    assert.deepEqual(detail.latestDecidedCancelRequest.decidedBy, { id: admin.id, name: admin.name });

    // Novo pedido pendente: o recusado continua visível ao lado do pendente.
    const second = (await requestCancel(seller, saleId, "Insistiu")).json().data;
    const both = (await call(seller, "GET", `/sales/${saleId}`)).json().data;
    assert.equal(both.pendingCancelRequest.id, second.id);
    assert.equal(both.latestDecidedCancelRequest.id, first.id);

    // Recusado de novo: o mais recente vence.
    await call(admin, "POST", `/sales/cancel-requests/${second.id}/reject`, { reason: "Ainda correta" });
    const latest = (await call(seller, "GET", `/sales/${saleId}`)).json().data;
    assert.equal(latest.latestDecidedCancelRequest.id, second.id);
    assert.equal(latest.latestDecidedCancelRequest.decisionReason, "Ainda correta");
  });
});
