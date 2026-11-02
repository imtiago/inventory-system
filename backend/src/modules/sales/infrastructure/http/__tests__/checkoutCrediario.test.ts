import "dotenv/config";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { crediarioDueDates } from "@credit/domain/dueDates";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { keyShape } from "../../../../../test/keyShape";
import { createTestVariant } from "../../../../../test/inventoryFixtures";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { newIdempotencyKey, withIdempotencyKey } from "../../../../../test/idempotency";
import { createHash } from "node:crypto";
import { canonicalJson, REDACTED_SECRET } from "@shared/http/idempotency/requestHash";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/sales/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));

const DAY_MS = 24 * 60 * 60 * 1000;

/** Novo (padrão): itens 300,00, entrada 90,00 (30%), 3x a 3,99% → 75,66 + 75,66 + 75,65. */
const PLAN_3X = { installments: 3, downPayment: 90, downPaymentMethod: "PIX" as const };

describe("fechamento da venda: crediário", () => {
  let admin: TestUser;
  let seller: TestUser;
  let customerId: string;
  let releaseCreditLock: () => Promise<void>;
  const extraUsers: TestUser[] = [];
  const variants: { id: string; cleanup: () => Promise<void> }[] = [];

  const call = (user: TestUser, method: "GET" | "POST", url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as any,
      headers: withIdempotencyKey(method, { authorization: `Bearer ${user.token}` }),
    });

  /** Variante com preço e 10 unidades a custo 100,00. */
  const createVariant = async (salePrice: number) => {
    const { variantId, cleanup } = await createTestVariant();
    variants.push({ id: variantId, cleanup });
    await prisma.productVariant.update({ where: { id: variantId }, data: { salePrice } });
    const res = await call(admin, "POST", "/inventory/lots", {
      productVariantId: variantId,
      batchNumber: `tx-test-${randomUUID().slice(0, 8)}`,
      quantity: 10,
      unitCost: 100,
      expirationDate: "2030-06-30T00:00:00.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
    return variantId;
  };

  const sellTo = (user: TestUser, cid: string, variantId: string, payment: unknown, quantity = 1) =>
    call(user, "POST", "/sales", { customerId: cid, items: [{ productVariantId: variantId, quantity }], payment });
  const sell = (user: TestUser, variantId: string, payment: unknown, quantity = 1) =>
    sellTo(user, customerId, variantId, payment, quantity);
  const crediario = (crediarioPlan: unknown, override?: unknown) => ({
    condition: "CREDIARIO",
    crediario: crediarioPlan,
    ...(override ? { override } : {}),
  });

  const qty = async (variantId: string) =>
    (await prisma.inventory.findUniqueOrThrow({ where: { productVariantId: variantId } })).quantity;

  const newCustomer = async () => {
    const tag = `tx-test-${randomUUID()}`;
    return (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
  };

  const approver = async (opts: { role?: "ADMIN" | "VENDEDOR"; canApproveCredit?: boolean; active?: boolean } = {}) => {
    const user = await createTestUser({ role: opts.role ?? "VENDEDOR", canApproveCredit: opts.canApproveCredit, active: opts.active });
    extraUsers.push(user);
    return user;
  };

  /** Conta a receber manual do cliente com uma parcela aberta vencida há `days` dias. */
  const overdueDebt = async (days: number, amount = 10) => {
    const due = new Date(`${todayInBusinessTz()}T00:00:00.000Z`).getTime() - days * DAY_MS;
    await prisma.financialDocument.create({
      data: {
        type: "RECEIVABLE",
        originType: "MANUAL",
        originId: randomUUID(),
        partyType: "CUSTOMER",
        partyId: customerId,
        parcels: { create: [{ amount, dueDate: new Date(due) }] },
      },
    });
  };

  before(async () => {
    releaseCreditLock = await acquireCreditTestLock();
    await resetCreditDefaults();
    await prisma.creditSettings.update({ where: { id: "default" }, data: { crediarioEnabled: true } });
  });

  beforeEach(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    seller = await createTestUser({ role: "VENDEDOR" });
    customerId = await newCustomer();
  });

  const cleanCustomer = async (id: string) => {
    try {
      await deleteFinancialDocuments({ where: { partyId: id } });
    } finally {
      const sales = await prisma.sale.findMany({ where: { customerId: id }, select: { id: true } });
      const saleIds = sales.map((s) => s.id);
      await prisma.saleFinancing.deleteMany({ where: { saleId: { in: saleIds } } });
      await prisma.saleCancelRequest.deleteMany({ where: { saleId: { in: saleIds } } });
      await prisma.sale.deleteMany({ where: { customerId: id } });
      await prisma.customer.deleteMany({ where: { id } });
    }
  };

  const extraCustomers: string[] = [];

  afterEach(async () => {
    const toClean = variants.splice(0);
    const users = extraUsers.splice(0);
    try {
      for (const id of [customerId, ...extraCustomers.splice(0)]) await cleanCustomer(id);
    } finally {
      try {
        for (const v of toClean) await v.cleanup();
      } finally {
        for (const u of [admin, seller, ...users]) await u.cleanup();
      }
    }
  });

  after(async () => {
    try {
      await resetCreditDefaults();
    } finally {
      await releaseCreditLock?.();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("Novo, itens 300,00, entrada 90,00, 3x → financiado 210,00 Price 3,99%; parcelas nos vencimentos; total a prazo gravado em SaleFinancing", async () => {
    const variantId = await createVariant(300);
    const res = await sell(seller, variantId, crediario(PLAN_3X));
    assert.equal(res.statusCode, 201, res.body);
    const dto = res.json().data;
    const today = todayInBusinessTz();
    const due = crediarioDueDates(today, 3, null);

    assert.equal(dto.paymentCondition, "CREDIARIO");
    assert.equal(dto.downPayment, 90);
    assert.equal(dto.surchargeAmount, 16.97);
    assert.equal(dto.totalAmount, 316.97);
    assert.equal(dto.receivable.status, "PARTIALLY_PAID");
    assert.deepEqual(
      dto.receivable.parcels.map((p: { amount: number; dueDate: string; paidAmount: number }) => [p.amount, p.dueDate, p.paidAmount]),
      [
        [90, today, 90],
        [75.66, due[0], 0],
        [75.66, due[1], 0],
        [75.65, due[2], 0],
      ],
    );
    assert.deepEqual(dto.financing, {
      cashPrice: 300,
      downPayment: 90,
      downPaymentMethod: "PIX",
      financedAmount: 210,
      installments: 3,
      monthlyRatePercent: 3.99,
      surchargeAmount: 16.97,
      totalAmount: 316.97,
      dueDay: null,
      firstDueDate: due[0],
      override: null,
    });

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(sale.paymentCondition, "CREDIARIO");
    assert.equal(Number(sale.downPayment), 90);
    assert.equal(Number(sale.surchargeAmount), 16.97);
    const financing = await prisma.saleFinancing.findUniqueOrThrow({ where: { saleId: dto.id } });
    assert.equal(Number(financing.cashPrice), 300);
    assert.equal(Number(financing.financedAmount), 210);
    assert.equal(financing.monthlyRateBps, 399);
    assert.equal(Number(financing.totalAmount), 316.97);
    assert.equal(financing.overrideById, null);
    assert.deepEqual(financing.overrideKinds, []);

    const payments = await prisma.payment.findMany({ where: { parcel: { document: { originType: "SALE", originId: dto.id } } } });
    assert.equal(payments.length, 1);
    assert.equal(payments[0].method, "PIX");
    assert.equal(payments[0].atCheckout, true);
    assert.equal(Number(payments[0].amount), 90);
    assert.equal(await qty(variantId), 9);

    // Dia de vencimento escolhido; sem entrada (perfil Bom: 0%) não há parcela paga no ato.
    await prisma.customer.update({ where: { id: customerId }, data: { creditProfileCode: "GOOD", creditLimit: 2000 } });
    const good = await sell(seller, variantId, crediario({ installments: 2, downPayment: 0, dueDay: 10 }));
    assert.equal(good.statusCode, 201, good.body);
    const goodDto = good.json().data;
    assert.equal(goodDto.receivable.status, "OPEN");
    assert.deepEqual(
      goodDto.receivable.parcels.map((p: { amount: number; dueDate: string }) => [p.amount, p.dueDate]),
      crediarioDueDates(today, 2, 10).map((d) => [150, d]),
    );
    assert.equal(goodDto.financing.dueDay, 10);
    assert.equal(goodDto.financing.downPaymentMethod, null);
    assert.equal(goodDto.surchargeAmount, 0);
  });

  test("termos de atraso ficam na venda: mudar multa/juros/carência depois não muda a prévia nem o pagamento da venda antiga", async () => {
    const variantId = await createVariant(300);
    const res = await sell(seller, variantId, crediario(PLAN_3X));
    assert.equal(res.statusCode, 201, res.body);
    const saleId = res.json().data.id;
    const financing = await prisma.saleFinancing.findUniqueOrThrow({ where: { saleId } });
    assert.deepEqual(
      { fineBps: financing.fineBps, monthlyInterestBps: financing.monthlyInterestBps, graceDays: financing.graceDays },
      { fineBps: 200, monthlyInterestBps: 100, graceDays: 3 },
    );

    // Primeira parcela do plano (75,66) vencida há 10 dias.
    const doc = await prisma.financialDocument.findFirstOrThrow({
      where: { originType: "SALE", originId: saleId },
      include: { parcels: { orderBy: { dueDate: "asc" } } },
    });
    const parcel = doc.parcels[1];
    const dueDate = new Date(Date.parse(`${todayInBusinessTz()}T00:00:00.000Z`) - 10 * DAY_MS);
    await prisma.financialParcel.update({ where: { id: parcel.id }, data: { dueDate } });

    // A loja muda os termos depois da venda.
    const settings = await prisma.creditSettings.findUniqueOrThrow({ where: { id: "default" } });
    await prisma.creditSettings.update({
      where: { id: "default" },
      data: { rules: { ...(settings.rules as object), fineBps: 100, monthlyInterestBps: 500, graceDays: 0 } },
    });
    try {
      // Contratado: multa 2% de 75,66 = 1,51; juros 1% a.m. × 10 dias = 0,25 (novos termos dariam 0,76 + 1,26).
      const quote = await call(seller, "GET", `/receivables/${doc.id}/parcels/${parcel.id}/late-fees`);
      assert.equal(quote.statusCode, 200, quote.body);
      assert.deepEqual(quote.json().data, { principalRemaining: 75.66, daysLate: 10, fine: 1.51, interest: 0.25, totalDue: 77.42 });

      const detail = await call(seller, "GET", `/receivables/${doc.id}`);
      const today = detail.json().data.parcels.find((p: { id: string }) => p.id === parcel.id).lateFeesToday;
      assert.deepEqual(today, { daysLate: 10, fine: 1.51, interest: 0.25, totalDue: 77.42 });

      const paid = await call(seller, "POST", `/receivables/${doc.id}/parcels/${parcel.id}/payments`, { amount: 75.66, method: "CASH" });
      assert.equal(paid.statusCode, 201, paid.body);
      const payment = await prisma.payment.findFirstOrThrow({ where: { parcelId: parcel.id } });
      assert.equal(Number(payment.fineAmount), 1.51);
      assert.equal(Number(payment.interestAmount), 0.25);

      // Venda nova grava os termos atuais.
      await prisma.customer.update({ where: { id: customerId }, data: { creditLimit: 5000 } });
      const next = await sell(seller, variantId, crediario(PLAN_3X));
      assert.equal(next.statusCode, 201, next.body);
      const nextFinancing = await prisma.saleFinancing.findUniqueOrThrow({ where: { saleId: next.json().data.id } });
      assert.deepEqual(
        { fineBps: nextFinancing.fineBps, monthlyInterestBps: nextFinancing.monthlyInterestBps, graceDays: nextFinancing.graceDays },
        { fineBps: 100, monthlyInterestBps: 500, graceDays: 0 },
      );
    } finally {
      await prisma.creditSettings.update({ where: { id: "default" }, data: { rules: settings.rules as object } });
    }
  });

  test("entrada 89,99 (< 30%) → 422 DOWN_PAYMENT_TOO_LOW com minDownPayment 90,00", async () => {
    const variantId = await createVariant(300);
    const res = await sell(seller, variantId, crediario({ ...PLAN_3X, downPayment: 89.99 }));
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "DOWN_PAYMENT_TOO_LOW");
    assert.deepEqual(res.json().details, { minDownPayment: 90 });
    assert.equal(await qty(variantId), 10);

    // Entrada > 0 sem forma de pagamento → 400; entrada ≥ total → 400.
    const noMethod = await sell(seller, variantId, crediario({ installments: 3, downPayment: 90 }));
    assert.equal(noMethod.statusCode, 400, noMethod.body);
    const all = await sell(seller, variantId, crediario({ installments: 1, downPayment: 300, downPaymentMethod: "CASH" }));
    assert.equal(all.statusCode, 400, all.body);
  });

  test("4x para Novo → 422 INSTALLMENTS_NOT_ALLOWED maxInstallments 3", async () => {
    const variantId = await createVariant(300);
    const res = await sell(seller, variantId, crediario({ ...PLAN_3X, installments: 4 }));
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "INSTALLMENTS_NOT_ALLOWED");
    assert.deepEqual(res.json().details, { maxInstallments: 3 });
  });

  test("parcela vencida há 11 dias → 422 CREDIT_OVERDUE_BLOCK; com override válido → 201 e overrideKinds ['OVERDUE'], motivo e aprovador gravados", async () => {
    const variantId = await createVariant(300);
    await overdueDebt(10);
    const tenDays = await sell(seller, variantId, crediario(PLAN_3X));
    assert.equal(tenDays.statusCode, 201, `10 dias ainda passa: ${tenDays.body}`);

    await overdueDebt(11);
    const blocked = await sell(seller, variantId, crediario(PLAN_3X));
    assert.equal(blocked.statusCode, 422, blocked.body);
    assert.equal(blocked.json().code, "CREDIT_OVERDUE_BLOCK");

    const boss = await approver({ canApproveCredit: true });
    // Limite do Novo (300) já tem 236,97 em aberto: aumenta para não misturar com LIMIT.
    await prisma.customer.update({ where: { id: customerId }, data: { creditLimit: 5000 } });
    const res = await sell(
      seller,
      variantId,
      crediario(PLAN_3X, { approverEmail: boss.email, approverPassword: boss.password, reason: "Cliente antigo, pagou ontem" }),
    );
    assert.equal(res.statusCode, 201, res.body);
    const dto = res.json().data;
    assert.deepEqual(dto.financing.override, {
      approver: { id: boss.id, name: boss.name },
      reason: "Cliente antigo, pagou ontem",
      kinds: ["OVERDUE"],
    });
    const financing = await prisma.saleFinancing.findUniqueOrThrow({ where: { saleId: dto.id } });
    assert.equal(financing.overrideById, boss.id);
    assert.equal(financing.overrideReason, "Cliente antigo, pagou ontem");
    assert.deepEqual(financing.overrideKinds, ["OVERDUE"]);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("saleDetailCrediario")), "POST /sales difere de saleDetailCrediario.json");
  });

  test("acima do disponível → 422 CREDIT_LIMIT_EXCEEDED com available/required; override de VENDEDOR sem a marca → 403; com a marca → 201", async () => {
    const variantId = await createVariant(300);
    await prisma.customer.update({ where: { id: customerId }, data: { creditLimit: 250 } });
    await overdueDebt(0, 50); // vence hoje: conta no saldo, não é atraso
    const res = await sell(seller, variantId, crediario(PLAN_3X));
    assert.equal(res.statusCode, 422, res.body);
    assert.equal(res.json().code, "CREDIT_LIMIT_EXCEEDED");
    assert.deepEqual(res.json().details, { available: 200, required: 226.97 });

    const plain = await approver();
    const denied = await sell(
      seller,
      variantId,
      crediario(PLAN_3X, { approverEmail: plain.email, approverPassword: plain.password, reason: "Autorizo" }),
    );
    assert.equal(denied.statusCode, 403, denied.body);
    assert.equal(denied.json().code, "CREDIT_OVERRIDE_DENIED");
    assert.equal(denied.json().message, "Autorização recusada.");

    // O próprio vendedor sem a marca também não autoriza.
    const self = await sell(
      seller,
      variantId,
      crediario(PLAN_3X, { approverEmail: seller.email, approverPassword: seller.password, reason: "Autorizo" }),
    );
    assert.equal(self.statusCode, 403, self.body);

    const flagged = await approver({ canApproveCredit: true });
    const ok = await sell(
      seller,
      variantId,
      crediario(PLAN_3X, { approverEmail: flagged.email.toUpperCase(), approverPassword: flagged.password, reason: "Autorizo" }),
    );
    assert.equal(ok.statusCode, 201, ok.body);
    assert.deepEqual(ok.json().data.financing.override.kinds, ["LIMIT"]);

    // ADMIN (pelo papel) também autoriza.
    const byAdmin = await sell(
      seller,
      variantId,
      crediario(PLAN_3X, { approverEmail: admin.email, approverPassword: admin.password, reason: "Autorizo" }),
    );
    assert.equal(byAdmin.statusCode, 201, byAdmin.body);
    assert.equal(await qty(variantId), 8);
  });

  test("override com senha errada 10× → 429; aprovador inativo → 403", async () => {
    const variantId = await createVariant(300);
    await prisma.customer.update({ where: { id: customerId }, data: { creditLimit: 100 } });
    const boss = await approver({ canApproveCredit: true });
    const wrong = crediario(PLAN_3X, { approverEmail: boss.email, approverPassword: "senha-errada", reason: "Autorizo" });
    for (let i = 1; i <= 10; i++) {
      const res = await sell(seller, variantId, wrong);
      assert.equal(res.statusCode, 403, `tentativa ${i}: ${res.body}`);
      assert.equal(res.json().code, "CREDIT_OVERRIDE_DENIED");
    }
    const limited = await sell(seller, variantId, wrong);
    assert.equal(limited.statusCode, 429, limited.body);
    // Até a senha certa fica bloqueada na janela.
    const right = await sell(seller, variantId, crediario(PLAN_3X, { approverEmail: boss.email, approverPassword: boss.password, reason: "Autorizo" }));
    assert.equal(right.statusCode, 429, right.body);

    const inactive = await approver({ canApproveCredit: true, active: false });
    const res = await sell(
      seller,
      variantId,
      crediario(PLAN_3X, { approverEmail: inactive.email, approverPassword: inactive.password, reason: "Autorizo" }),
    );
    assert.equal(res.statusCode, 403, res.body);
    assert.equal(res.json().code, "CREDIT_OVERRIDE_DENIED");
    assert.equal(await qty(variantId), 10);
  });

  test("idempotência com exceção: a senha do aprovador não entra no hash nem no registro; retry com outra senha → replay", async () => {
    const variantId = await createVariant(300);
    await prisma.customer.update({ where: { id: customerId }, data: { creditLimit: 100 } });
    const boss = await approver({ canApproveCredit: true });
    const key = newIdempotencyKey();
    const body = (approverPassword: string, reason = "Autorizo") => ({
      customerId,
      items: [{ productVariantId: variantId, quantity: 1 }],
      payment: crediario(PLAN_3X, { approverEmail: boss.email, approverPassword, reason }),
    });
    const post = (payload: unknown) =>
      app.inject({
        method: "POST",
        url: "/sales",
        payload: payload as any,
        headers: { authorization: `Bearer ${seller.token}`, "idempotency-key": key },
      });
    const rawHash = (payload: unknown) =>
      createHash("sha256").update(canonicalJson(["POST", "/sales", {}, payload])).digest("hex");

    const first = await post(body(boss.password));
    assert.equal(first.statusCode, 201, first.body);
    const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: seller.id, key } });
    assert.equal(record.requestHash, rawHash(body(REDACTED_SECRET)));
    assert.notEqual(record.requestHash, rawHash(body(boss.password)));
    assert.notEqual(record.requestHash, rawHash(body(REDACTED_SECRET, "Outro motivo")));
    assert.ok(!JSON.stringify(record).includes(boss.password), "senha no registro de idempotência");
    assert.ok(!first.body.includes(boss.password));

    // Resposta perdida, o vendedor redigita a senha (até errada): mesma chave → replay, sem outra venda.
    const retry = await post(body("senha-redigitada"));
    assert.equal(retry.statusCode, 201, retry.body);
    assert.equal(retry.headers["idempotent-replayed"], "true");
    assert.deepEqual(retry.json(), first.json());
    assert.equal(await qty(variantId), 9);

    // Outro campo diferente com a mesma chave continua recusado.
    const other = await post(body(boss.password, "Outro motivo"));
    assert.equal(other.statusCode, 422, other.body);
    assert.equal(other.json().code, "IDEMPOTENCY_KEY_REUSED");
  });

  test("SUSPENDED → 422 CREDIT_SUSPENDED mesmo com override", async () => {
    const variantId = await createVariant(300);
    const boss = await approver({ canApproveCredit: true });
    for (const status of ["SUSPENDED", "BLOCKED"] as const) {
      await prisma.customer.update({ where: { id: customerId }, data: { creditStatus: status } });
      const res = await sell(
        seller,
        variantId,
        crediario(PLAN_3X, { approverEmail: boss.email, approverPassword: boss.password, reason: "Autorizo" }),
      );
      assert.equal(res.statusCode, 422, res.body);
      assert.equal(res.json().code, "CREDIT_SUSPENDED");
    }
    assert.equal(await qty(variantId), 10);
  });

  test("crediarioEnabled false → 422 CREDIARIO_DISABLED", async () => {
    const variantId = await createVariant(300);
    await prisma.creditSettings.update({ where: { id: "default" }, data: { crediarioEnabled: false } });
    try {
      const res = await sell(seller, variantId, crediario(PLAN_3X));
      assert.equal(res.statusCode, 422, res.body);
      assert.equal(res.json().code, "CREDIARIO_DISABLED");
      assert.equal(res.json().message, "O crediário ainda não foi ativado nas configurações.");

      const sim = await call(admin, "POST", "/sales/simulate", { customerId, items: [{ productVariantId: variantId, quantity: 1 }] });
      assert.equal(sim.statusCode, 200, sim.body);
      assert.equal(sim.json().data.crediario.allowed, false);
      assert.equal(sim.json().data.crediario.blockedReason, "DISABLED");
    } finally {
      await prisma.creditSettings.update({ where: { id: "default" }, data: { crediarioEnabled: true } });
    }
    assert.equal(await qty(variantId), 10);
  });

  for (const round of [1, 2]) {
    test(`duas vendas simultâneas do mesmo cliente que juntas estouram o limite → uma 201, outra 422; sem deadlock com venda à vista concorrente da mesma variante (rodada ${round})`, async () => {
      const variantId = await createVariant(300);
      const otherCustomer = await newCustomer();
      extraCustomers.push(otherCustomer);
      const [a, b, cash, other] = await Promise.all([
        sell(seller, variantId, crediario(PLAN_3X)),
        sell(admin, variantId, crediario(PLAN_3X)),
        sell(seller, variantId, { condition: "CASH" }),
        sellTo(seller, otherCustomer, variantId, crediario(PLAN_3X)),
      ]);
      const pair = [a, b].map((r) => r.statusCode).sort();
      assert.deepEqual(pair, [201, 422], `${a.body}\n${b.body}`);
      const rejected = [a, b].find((r) => r.statusCode === 422)!;
      assert.equal(rejected.json().code, "CREDIT_LIMIT_EXCEEDED");
      assert.deepEqual(rejected.json().details, { available: 73.03, required: 226.97 });
      assert.equal(cash.statusCode, 201, cash.body);
      assert.equal(other.statusCode, 201, other.body);
      assert.equal(await qty(variantId), 7);
      assert.equal(await prisma.sale.count({ where: { customerId, paymentCondition: "CREDIARIO" } }), 1);
    });
  }

  test("simulate: lista 1..máximo com parcela, total, acréscimo R$ e %; margin só para reports.profit", async () => {
    const variantId = await createVariant(300);
    const payload = { customerId, items: [{ productVariantId: variantId, quantity: 1 }] };

    const adminRes = await call(admin, "POST", "/sales/simulate", payload);
    assert.equal(adminRes.statusCode, 200, adminRes.body);
    const block = adminRes.json().data.crediario;
    assert.equal(block.allowed, true);
    assert.equal(block.blockedReason, null);
    assert.equal(block.available, 300);
    assert.equal(block.minDownPayment, 90);
    assert.equal(block.maxInstallments, 3);
    assert.equal(block.options.length, 3);
    const [one, two, three] = block.options;
    assert.deepEqual(
      { ...one, margin: undefined },
      { installments: 1, downPayment: 90, installmentAmount: 210, lastInstallmentAmount: 210, total: 300, surcharge: 0, surchargePercent: 0, margin: undefined },
    );
    assert.equal(two.installmentAmount, 105);
    assert.deepEqual(
      { ...three, margin: undefined },
      { installments: 3, downPayment: 90, installmentAmount: 75.66, lastInstallmentAmount: 75.65, total: 316.97, surcharge: 16.97, surchargePercent: 8.08, margin: undefined },
    );
    assert.equal(typeof three.margin.amount, "number");
    assert.ok(three.margin.amount > one.margin.amount, "juros aumentam a margem");
    assert.deepEqual(keyShape(adminRes.json()), keyShape(loadFixture("saleSimulation")), "difere de saleSimulation.json");

    // Entrada maior e dia de vencimento aceitos; entrada abaixo do mínimo sobe para o mínimo.
    const bigger = await call(admin, "POST", "/sales/simulate", { ...payload, downPayment: 150, dueDay: 5 });
    assert.equal(bigger.statusCode, 200, bigger.body);
    assert.equal(bigger.json().data.crediario.options[0].downPayment, 150);
    assert.equal(bigger.json().data.crediario.maxInstallments, 2);
    const lower = await call(admin, "POST", "/sales/simulate", { ...payload, downPayment: 10 });
    assert.equal(lower.json().data.crediario.options[0].downPayment, 90);
    const invalid = await call(admin, "POST", "/sales/simulate", { ...payload, dueDay: 29 });
    assert.equal(invalid.statusCode, 400, invalid.body);

    const sellerRes = await call(seller, "POST", "/sales/simulate", payload);
    assert.equal(sellerRes.statusCode, 200, sellerRes.body);
    assert.equal(sellerRes.json().data.crediario.options.length, 3);
    assert.ok(!sellerRes.body.includes("margin"), sellerRes.body);
    assert.ok(!sellerRes.body.includes("Cost"), sellerRes.body);

    // Bloqueios: limite (disponível < financiado) e atraso.
    await prisma.customer.update({ where: { id: customerId }, data: { creditLimit: 100 } });
    const limit = (await call(seller, "POST", "/sales/simulate", payload)).json().data.crediario;
    assert.equal(limit.allowed, false);
    assert.equal(limit.blockedReason, "LIMIT");
    assert.equal(limit.available, 100);
    await overdueDebt(11);
    const overdue = (await call(seller, "POST", "/sales/simulate", payload)).json().data.crediario;
    assert.equal(overdue.blockedReason, "OVERDUE");
    await prisma.customer.update({ where: { id: customerId }, data: { creditStatus: "SUSPENDED" } });
    const suspended = (await call(seller, "POST", "/sales/simulate", payload)).json().data.crediario;
    assert.equal(suspended.blockedReason, "SUSPENDED");
  });

  test("detalhe da venda devolve financing; fixture atualizada", async () => {
    const variantId = await createVariant(300);
    const created = await sell(seller, variantId, crediario(PLAN_3X));
    assert.equal(created.statusCode, 201, created.body);
    const detail = await call(seller, "GET", `/sales/${created.json().data.id}`);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.deepEqual(detail.json().data.financing, created.json().data.financing);
    assert.equal(detail.json().data.financing.override, null);

    const cash = await sell(seller, variantId, { condition: "CASH" });
    assert.equal(cash.statusCode, 201, cash.body);
    assert.equal(cash.json().data.financing, null);
    assert.deepEqual(keyShape(cash.json()), keyShape(loadFixture("saleDetail")), "POST /sales difere de saleDetail.json");

    // Cancelar no prazo estorna a entrada (atCheckout) e cancela as parcelas.
    const canceled = await call(admin, "POST", `/sales/${created.json().data.id}/cancel`);
    assert.equal(canceled.statusCode, 200, canceled.body);
    assert.equal(canceled.json().data.receivable.status, "CANCELED");
    assert.equal(await qty(variantId), 9);
  });
});
