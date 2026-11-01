import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, type TestUser } from "../../../../../test/authFixtures";
import { keyShape } from "../../../../../test/keyShape";
import { acquireCreditTestLock } from "../../../../../test/creditTestLock";
import { DEFAULT_CREDIT_RULES } from "@credit/domain/creditRules";
import { DEFAULT_CREDIT_PROFILES } from "@credit/domain/CreditProfileCode";
import { resetCreditDefaults } from "../../../../../test/creditFixtures";

app.log.level = "silent";

const FIXTURES_DIR = new URL("../../../../../../../frontend/src/test/fixtures/credit/", import.meta.url);
const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES_DIR), "utf8"));
const MIGRATION = new URL(
  "../../../../../../prisma/migrations/20261029100200_credit_settings_profiles/migration.sql",
  import.meta.url,
);

/** Regras iniciais da spec em reais/percentuais (forma da API). */
const SPEC_RULES = {
  bands: [
    { upTo: 150, maxInstallments: 2 },
    { upTo: 300, maxInstallments: 3 },
    { upTo: 600, maxInstallments: 5 },
    { upTo: 1000, maxInstallments: 8 },
    { upTo: null, maxInstallments: 10 },
  ],
  minInstallment: 30,
  interestFreeInstallments: 2,
  monthlyRatePercent: 3.99,
  defaultDueDay: null,
  overdueBlockDays: 10,
  finePercent: 2,
  monthlyInterestPercent: 1,
  graceDays: 3,
  autoApproval: { profiles: ["GOOD", "EXCELLENT"], maxDaysLate: 5, minPaidInstallments: 6, maxIncreasePercent: 50 },
  review: {
    weights: {
      paidOnTime: 10,
      relationshipMonth: 2,
      relationshipMonthsCap: 24,
      per100Paid: 1,
      per100PaidCap: 50,
      dayLate: -1,
      paidLate30: -15,
      renegotiation: -20,
    },
    promoteAt: { NEW: 40, REGULAR: 80, GOOD: 150 },
    demoteIfDaysLateOver: 30,
    suspendIfOverdueOver: 60,
  },
};

const SPEC_PROFILES = [
  { code: "NEW", name: "Novo", initialLimit: 300, minDownPaymentPercent: 30, maxInstallments: 3, position: 0 },
  { code: "REGULAR", name: "Regular", initialLimit: 800, minDownPaymentPercent: 15, maxInstallments: 5, position: 1 },
  { code: "GOOD", name: "Bom", initialLimit: 2000, minDownPaymentPercent: 0, maxInstallments: 8, position: 2 },
  { code: "EXCELLENT", name: "Excelente", initialLimit: 5000, minDownPaymentPercent: 0, maxInstallments: 10, position: 3 },
];

describe("Configurações do crédito e perfis (/credit/settings, /credit/profiles)", () => {
  const users = {} as Record<"ADMIN" | "VENDEDOR" | "ESTOQUISTA", TestUser>;
  const customerIds: string[] = [];
  let releaseLock: () => Promise<void>;

  const call = (role: keyof typeof users, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${users[role].token}` } });
  const putRules = (rules: unknown) => call("ADMIN", "PUT", "/credit/settings", { rules });

  before(async () => {
    releaseLock = await acquireCreditTestLock();
    for (const role of ["ADMIN", "VENDEDOR", "ESTOQUISTA"] as const) users[role] = await createTestUser({ role });
    await resetCreditDefaults();
  });

  after(async () => {
    try {
      await resetCreditDefaults();
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
      for (const u of Object.values(users)) await u?.cleanup();
    } finally {
      await releaseLock?.();
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("GET /credit/settings devolve os valores iniciais da spec e crediarioEnabled false", async () => {
    const res = await call("ADMIN", "GET", "/credit/settings");
    assert.equal(res.statusCode, 200);
    const { data } = res.json();
    assert.equal(data.crediarioEnabled, false);
    assert.equal(data.enabledAt, null);
    assert.equal(data.enabledBy, null);
    assert.deepEqual(data.rules, SPEC_RULES);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("creditSettings")));
  });

  test("a migration grava exatamente DEFAULT_CREDIT_RULES e DEFAULT_CREDIT_PROFILES", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const json = /VALUES \('default', false, '(\{[\s\S]*?\})'::jsonb\)/.exec(sql);
    assert.ok(json, "INSERT de CreditSettings com JSON literal");
    assert.deepEqual(JSON.parse(json[1]), DEFAULT_CREDIT_RULES);
    for (const p of DEFAULT_CREDIT_PROFILES) {
      const line = `('${p.code}', '${p.name}', ${(p.initialLimitCents / 100).toFixed(2)}, ${p.minDownPaymentBps}, ${p.maxInstallments},`;
      assert.ok(sql.includes(line), `perfil ${p.code}: ${line}`);
    }
  });

  test("PUT com multa 2,01% → 422 FINE_ABOVE_LEGAL_LIMIT; faixas fora de ordem ou parcela mínima 0 → 400", async () => {
    const fine = await putRules({ ...SPEC_RULES, finePercent: 2.01 });
    assert.equal(fine.statusCode, 422);
    assert.equal(fine.json().code, "FINE_ABOVE_LEGAL_LIMIT");
    assert.equal(fine.json().message, "A multa não pode passar de 2% (CDC, art. 52 §1º).");

    const unordered = await putRules({
      ...SPEC_RULES,
      bands: [
        { upTo: 300, maxInstallments: 3 },
        { upTo: 150, maxInstallments: 2 },
        { upTo: null, maxInstallments: 10 },
      ],
    });
    assert.equal(unordered.statusCode, 400);

    const noOpenBand = await putRules({ ...SPEC_RULES, bands: [{ upTo: 150, maxInstallments: 2 }] });
    assert.equal(noOpenBand.statusCode, 400);

    const minZero = await putRules({ ...SPEC_RULES, minInstallment: 0 });
    assert.equal(minZero.statusCode, 400);

    const dueDay = await putRules({ ...SPEC_RULES, defaultDueDay: 29 });
    assert.equal(dueDay.statusCode, 400);

    const empty = await call("ADMIN", "PUT", "/credit/settings", {});
    assert.equal(empty.statusCode, 400);

    // Nada gravado.
    const got = await call("ADMIN", "GET", "/credit/settings");
    assert.deepEqual(got.json().data.rules, SPEC_RULES);
  });

  test("PUT válido grava as regras (reais/percentuais → centavos/bps) e quem alterou", async () => {
    const rules = {
      ...SPEC_RULES,
      bands: [
        { upTo: 200, maxInstallments: 3 },
        { upTo: null, maxInstallments: 12 },
      ],
      monthlyRatePercent: 4.5,
      finePercent: 1.5,
      defaultDueDay: 10,
    };
    const res = await putRules(rules);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data.rules, rules);
    assert.deepEqual(res.json().data.updatedBy, { id: users.ADMIN.id, name: users.ADMIN.name });

    const row = await prisma.creditSettings.findUniqueOrThrow({ where: { id: "default" } });
    const stored = row.rules as any;
    assert.deepEqual(stored.bands, [
      { upToCents: 20000, maxInstallments: 3 },
      { upToCents: null, maxInstallments: 12 },
    ]);
    assert.equal(stored.monthlyRateBps, 450);
    assert.equal(stored.fineBps, 150);
    assert.equal(row.crediarioEnabled, false);
    await resetCreditDefaults();
  });

  test("ativar sem dados da loja → 422 STORE_SETTINGS_MISSING e continua desligado", async () => {
    const approver = await createTestUser({ role: "VENDEDOR", canApproveCredit: true });
    await prisma.storeSettings.deleteMany();
    try {
      const res = await call("ADMIN", "PUT", "/credit/settings", { crediarioEnabled: true });
      assert.equal(res.statusCode, 422);
      assert.equal(res.json().code, "STORE_SETTINGS_MISSING");
      const row = await prisma.creditSettings.findUniqueOrThrow({ where: { id: "default" } });
      assert.equal(row.crediarioEnabled, false);
    } finally {
      await approver.cleanup();
    }
  });

  test("VENDEDOR/ESTOQUISTA: GET e PUT /credit/settings → 403", async () => {
    for (const role of ["VENDEDOR", "ESTOQUISTA"] as const) {
      assert.equal((await call(role, "GET", "/credit/settings")).statusCode, 403);
      assert.equal((await call(role, "PUT", "/credit/settings", { rules: SPEC_RULES })).statusCode, 403);
    }
  });

  test("GET /credit/profiles (VENDEDOR) lista os 4 perfis na ordem com os valores iniciais", async () => {
    const res = await call("VENDEDOR", "GET", "/credit/profiles");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, SPEC_PROFILES);
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("creditProfiles")));
    assert.equal((await call("ESTOQUISTA", "GET", "/credit/profiles")).statusCode, 403);
  });

  test("PUT /credit/profiles/:code (ADMIN) muda os parâmetros; cliente novo nasce com o limite inicial do Novo", async () => {
    const res = await call("ADMIN", "PUT", "/credit/profiles/NEW", {
      initialLimit: 350,
      minDownPaymentPercent: 25,
      maxInstallments: 4,
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().data, {
      code: "NEW",
      name: "Novo",
      initialLimit: 350,
      minDownPaymentPercent: 25,
      maxInstallments: 4,
      position: 0,
    });
    assert.deepEqual(keyShape(res.json()), keyShape(loadFixture("creditProfile")));

    const created = await call("ADMIN", "POST", "/customers", { name: `tx-test-${randomUUID()}` });
    assert.equal(created.statusCode, 201);
    customerIds.push(created.json().data.id);
    const credit = await call("ADMIN", "GET", `/customers/${created.json().data.id}/credit`);
    assert.equal(credit.json().data.limit, 350);
    assert.equal(credit.json().data.profileCode, "NEW");

    assert.equal(
      (await call("ADMIN", "PUT", "/credit/profiles/NEW", { initialLimit: 300, minDownPaymentPercent: 30, maxInstallments: 25 })).statusCode,
      400,
    );
    assert.equal(
      (await call("ADMIN", "PUT", "/credit/profiles/NEW", { initialLimit: -1, minDownPaymentPercent: 30, maxInstallments: 3 })).statusCode,
      400,
    );
    assert.equal(
      (await call("ADMIN", "PUT", "/credit/profiles/VIP", { initialLimit: 300, minDownPaymentPercent: 30, maxInstallments: 3 })).statusCode,
      400,
    );
    assert.equal(
      (await call("VENDEDOR", "PUT", "/credit/profiles/NEW", { initialLimit: 300, minDownPaymentPercent: 30, maxInstallments: 3 })).statusCode,
      403,
    );
    await resetCreditDefaults();
  });
});
