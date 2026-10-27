import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransactionManager } from "../../../../../test/InMemoryTransactionManager";
import { DEFAULT_CREDIT_RULES, type CreditRules } from "@credit/domain/creditRules";
import type {
  CreditSettingsRecord,
  CreditSettingsRepository,
  CreditSettingsWrite,
} from "@credit/application/contracts/CreditSettingsRepository";
import type { CreditActivationChecks } from "@credit/application/contracts/CreditActivationChecks";
import { UpdateCreditSettingsUseCase } from "@credit/application/useCases/UpdateCreditSettingsUseCase";

class FakeRepo implements CreditSettingsRepository {
  locks = 0;
  record: CreditSettingsRecord = {
    crediarioEnabled: false,
    rules: structuredClone(DEFAULT_CREDIT_RULES),
    enabledAt: null,
    enabledBy: null,
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    updatedBy: null,
  };
  async lock() {
    this.locks++;
  }
  async read() {
    return structuredClone(this.record);
  }
  async save(w: CreditSettingsWrite) {
    this.record = {
      crediarioEnabled: w.crediarioEnabled,
      rules: w.rules,
      enabledAt: w.enabledAt,
      enabledBy: w.enabledById ? { id: w.enabledById, name: "Dona" } : null,
      updatedAt: new Date("2026-10-27T12:00:00Z"),
      updatedBy: w.updatedById ? { id: w.updatedById, name: "Dona" } : null,
    };
  }
}

const checks = (store: boolean, approvers: number): CreditActivationChecks => ({
  storeDataComplete: async () => store,
  activeApproverCount: async () => approvers,
});

const NOW = new Date("2026-10-27T15:00:00Z");
const make = (repo: FakeRepo, c: CreditActivationChecks) =>
  new UpdateCreditSettingsUseCase(repo, c, new InMemoryTransactionManager(), () => NOW);

describe("UpdateCreditSettingsUseCase", () => {
  test("ativar exige dados da loja → 422 STORE_SETTINGS_MISSING", async () => {
    const repo = new FakeRepo();
    await assert.rejects(make(repo, checks(false, 1)).execute({ crediarioEnabled: true, userId: "u1" }), {
      code: "STORE_SETTINGS_MISSING",
      message: "Preencha os dados da loja antes de ativar o crediário.",
    });
    assert.equal(repo.record.crediarioEnabled, false);
  });

  test("ativar exige ao menos um aprovador de crédito → 422 CREDIT_APPROVER_MISSING", async () => {
    const repo = new FakeRepo();
    await assert.rejects(make(repo, checks(true, 0)).execute({ crediarioEnabled: true, userId: "u1" }), {
      code: "CREDIT_APPROVER_MISSING",
    });
    assert.equal(repo.record.crediarioEnabled, false);
  });

  test("ativar com loja e aprovador grava quem e quando; desligar limpa; religar já ligado não muda a data", async () => {
    const repo = new FakeRepo();
    const dto = await make(repo, checks(true, 1)).execute({ crediarioEnabled: true, userId: "u1" });
    assert.equal(dto.crediarioEnabled, true);
    assert.equal(repo.locks, 1);
    assert.equal(repo.record.enabledAt?.toISOString(), NOW.toISOString());
    assert.deepEqual(repo.record.enabledBy, { id: "u1", name: "Dona" });
    assert.deepEqual(dto.enabledBy, { id: "u1", name: "Dona" });

    const later = new UpdateCreditSettingsUseCase(repo, checks(true, 1), new InMemoryTransactionManager(), () => new Date("2027-01-01T00:00:00Z"));
    await later.execute({ crediarioEnabled: true, userId: "u2" });
    assert.equal(repo.record.enabledAt?.toISOString(), NOW.toISOString());

    // Desligar não exige nada.
    await make(repo, checks(false, 0)).execute({ crediarioEnabled: false, userId: "u1" });
    assert.equal(repo.record.crediarioEnabled, false);
    assert.equal(repo.record.enabledAt, null);
    assert.equal(repo.record.enabledBy, null);
  });

  test("só regras: mantém ligado/desligado; multa > 2% → 422 FINE_ABOVE_LEGAL_LIMIT", async () => {
    const repo = new FakeRepo();
    const rules: CreditRules = { ...structuredClone(DEFAULT_CREDIT_RULES), monthlyRateBps: 450 };
    const dto = await make(repo, checks(false, 0)).execute({ rules, userId: "u1" });
    assert.equal(dto.rules.monthlyRatePercent, 4.5);
    assert.equal(repo.record.rules.monthlyRateBps, 450);
    assert.equal(repo.record.crediarioEnabled, false);

    await assert.rejects(
      make(repo, checks(true, 1)).execute({ rules: { ...rules, fineBps: 201 }, userId: "u1" }),
      { code: "FINE_ABOVE_LEGAL_LIMIT", message: "A multa não pode passar de 2% (CDC, art. 52 §1º)." },
    );
    assert.equal(repo.record.rules.fineBps, 200);
  });
});
