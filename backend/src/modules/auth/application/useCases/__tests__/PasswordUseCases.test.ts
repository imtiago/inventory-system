import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BusinessRuleError, TooManyRequestsError } from "@shared/domain/errors";
import { UserRole } from "@auth/domain/enums/UserRole";
import { ChangeOwnPasswordUseCase } from "../commands/ChangeOwnPasswordUseCase";
import { ResetUserPasswordUseCase } from "../commands/ResetUserPasswordUseCase";
import {
  FakeLimiter,
  FakePasswordHasher,
  FakeTokenService,
  InMemoryUserRepository,
  SpyTransactionManager,
} from "../../__tests__/fakes";

describe("troca/redefinição de senha não sobrescreve acesso concorrente", () => {
  test("ChangeOwnPassword: desativação/rebaixamento durante o bcrypt continua valendo", async () => {
    const repo = new InMemoryUserRepository();
    repo.add({ id: "u", role: UserRole.ADMIN, password: "hash:atual-123" });
    const hasher = new FakePasswordHasher();
    // admin desativa e rebaixa o usuário enquanto o hash da nova senha é calculado
    hasher.onHash = () => {
      repo.rows.set("u", { ...repo.row("u"), active: false, role: UserRole.VENDEDOR });
    };
    const useCase = new ChangeOwnPasswordUseCase(repo, hasher, new SpyTransactionManager(), new FakeLimiter(), new FakeTokenService());

    await useCase.execute({ userId: "u", currentPassword: "atual-123", newPassword: "nova-senha-1" });

    assert.equal(repo.row("u").active, false);
    assert.equal(repo.row("u").role, UserRole.VENDEDOR);
    assert.equal(repo.row("u").password, "hash:nova-senha-1");
    assert.ok(!repo.calls.includes("update"), repo.calls.join(","));
  });

  test("ResetUserPassword: desativação durante o bcrypt continua valendo", async () => {
    const repo = new InMemoryUserRepository();
    repo.add({ id: "u", role: UserRole.VENDEDOR });
    const hasher = new FakePasswordHasher();
    hasher.onHash = () => {
      repo.rows.set("u", { ...repo.row("u"), active: false });
    };
    const useCase = new ResetUserPasswordUseCase(repo, hasher, new SpyTransactionManager());

    await useCase.execute({ id: "u", password: "nova-senha-1" });

    assert.equal(repo.row("u").active, false);
    assert.equal(repo.row("u").password, "hash:nova-senha-1");
    assert.ok(!repo.calls.includes("update"), repo.calls.join(","));
  });
});

describe("ChangeOwnPassword: limite de tentativas da senha atual", () => {
  test("10 senhas atuais erradas → 422; a 11ª → 429 TOO_MANY_ATTEMPTS; chave pwd:<userId>; sucesso zera", async () => {
    const repo = new InMemoryUserRepository();
    repo.add({ id: "u", role: UserRole.ESTOQUISTA, password: "hash:atual-123" });
    const limiter = new FakeLimiter(10);
    const useCase = new ChangeOwnPasswordUseCase(repo, new FakePasswordHasher(), new SpyTransactionManager(), limiter, new FakeTokenService());
    const attempt = (currentPassword: string) =>
      useCase.execute({ userId: "u", currentPassword, newPassword: "nova-senha-1" });

    for (let i = 0; i < 9; i++) {
      await assert.rejects(attempt("errada"), (e: unknown) => e instanceof BusinessRuleError && e.code === "INVALID_CURRENT_PASSWORD");
    }
    await attempt("atual-123"); // 10ª tentativa, certa: zera
    assert.equal(limiter.counts.has("pwd:u"), false);

    for (let i = 0; i < 10; i++) {
      await assert.rejects(attempt("errada"), (e: unknown) => e instanceof BusinessRuleError);
    }
    await assert.rejects(attempt("nova-senha-1"), (e: unknown) => e instanceof TooManyRequestsError && e.code === "TOO_MANY_ATTEMPTS");
    assert.equal(limiter.counts.get("pwd:u"), 10);
  });
});

describe("troca/redefinição de senha registram passwordChangedAt", () => {
  test("ChangeOwnPassword grava passwordChangedAt e devolve token novo assinado depois dele", async () => {
    const repo = new InMemoryUserRepository();
    repo.add({ id: "u", role: UserRole.VENDEDOR, password: "hash:atual-123" });
    const tokens = new FakeTokenService();
    const useCase = new ChangeOwnPasswordUseCase(repo, new FakePasswordHasher(), new SpyTransactionManager(), new FakeLimiter(), tokens);

    const before = Date.now();
    const result = await useCase.execute({ userId: "u", currentPassword: "atual-123", newPassword: "nova-senha-1" });

    const changedAt = repo.row("u").passwordChangedAt;
    assert.ok(changedAt && changedAt.getTime() >= before, String(changedAt));
    assert.deepEqual(result, { token: "token:u:VENDEDOR" });
    assert.deepEqual(tokens.signed, [{ sub: "u", role: UserRole.VENDEDOR }]);
  });

  test("ChangeOwnPassword com senha atual errada não grava nem assina", async () => {
    const repo = new InMemoryUserRepository();
    repo.add({ id: "u", role: UserRole.VENDEDOR, password: "hash:atual-123" });
    const tokens = new FakeTokenService();
    const useCase = new ChangeOwnPasswordUseCase(repo, new FakePasswordHasher(), new SpyTransactionManager(), new FakeLimiter(), tokens);

    await assert.rejects(useCase.execute({ userId: "u", currentPassword: "errada", newPassword: "nova-senha-1" }));
    assert.equal(repo.row("u").passwordChangedAt, null);
    assert.deepEqual(tokens.signed, []);
  });

  test("ResetUserPassword grava passwordChangedAt", async () => {
    const repo = new InMemoryUserRepository();
    repo.add({ id: "u", role: UserRole.VENDEDOR });
    const before = Date.now();
    await new ResetUserPasswordUseCase(repo, new FakePasswordHasher(), new SpyTransactionManager()).execute({
      id: "u",
      password: "nova-senha-1",
    });
    const changedAt = repo.row("u").passwordChangedAt;
    assert.ok(changedAt && changedAt.getTime() >= before, String(changedAt));
  });
});
