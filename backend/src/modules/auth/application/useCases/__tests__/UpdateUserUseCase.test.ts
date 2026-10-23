import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError, NotFoundError } from "@shared/domain/errors";
import { UserRole } from "@auth/domain/enums/UserRole";
import { UpdateUserUseCase } from "../commands/UpdateUserUseCase";
import { InMemoryUserRepository, SpyTransactionManager } from "../../__tests__/fakes";

function setup() {
  const repo = new InMemoryUserRepository();
  const tx = new SpyTransactionManager();
  return { repo, tx, useCase: new UpdateUserUseCase(repo, tx) };
}

describe("UpdateUserUseCase", () => {
  test("não deixar o sistema sem admin ativo → 409 LAST_ADMIN (rebaixar ou desativar o último)", async () => {
    const { repo, useCase } = setup();
    repo.add({ id: "actor", role: UserRole.ADMIN, active: false }); // ator sem efeito na contagem
    repo.add({ id: "last", role: UserRole.ADMIN });
    repo.add({ id: "inactive-admin", role: UserRole.ADMIN, active: false });

    for (const change of [{ role: UserRole.VENDEDOR }, { active: false }]) {
      await assert.rejects(
        useCase.execute({ actorId: "actor", id: "last", ...change }),
        (err: unknown) => err instanceof ConflictError && err.code === "LAST_ADMIN",
      );
    }
    assert.equal(repo.row("last").role, UserRole.ADMIN);
    assert.equal(repo.row("last").active, true);
  });

  test("com outro admin ativo, rebaixar/desativar é permitido; admins travados antes do alvo, alvo lido com lock", async () => {
    const { repo, tx, useCase } = setup();
    repo.add({ id: "actor", role: UserRole.ADMIN });
    repo.add({ id: "target", role: UserRole.ADMIN });

    const out = await useCase.execute({ actorId: "actor", id: "target", role: UserRole.ESTOQUISTA, active: false });
    assert.equal(out.role, UserRole.ESTOQUISTA);
    assert.equal(out.active, false);
    assert.equal(tx.calls, 1);
    // ordem fixa de locks (admins → alvo) evita deadlock entre dois rebaixamentos
    assert.deepEqual(repo.calls, [
      "countActiveAdminsExcluding",
      "findByIdForUpdate",
      "updateAccess:active,role",
    ]);
  });

  test("grava só os campos alterados: renomear não reescreve active/role/senha", async () => {
    const { repo, useCase } = setup();
    repo.add({ id: "actor", role: UserRole.ADMIN });
    repo.add({ id: "seller", role: UserRole.VENDEDOR });

    await useCase.execute({ actorId: "actor", id: "seller", name: "novo nome" });
    assert.deepEqual(repo.calls, ["findByIdForUpdate", "updateAccess:name"]);
    assert.equal(repo.row("seller").name, "novo nome");
  });

  test("reativar/promover não consulta a contagem de admins", async () => {
    const { repo, useCase } = setup();
    repo.add({ id: "actor", role: UserRole.ADMIN });
    repo.add({ id: "seller", role: UserRole.VENDEDOR, active: false });

    const out = await useCase.execute({ actorId: "actor", id: "seller", role: UserRole.ADMIN, active: true });
    assert.equal(out.role, UserRole.ADMIN);
    assert.equal(out.active, true);
    assert.ok(!repo.calls.includes("countActiveAdminsExcluding"));
  });

  test("admin não pode desativar a si nem remover o próprio papel ADMIN → CANNOT_CHANGE_OWN_ACCESS", async () => {
    const { repo, useCase } = setup();
    repo.add({ id: "me", role: UserRole.ADMIN });
    repo.add({ id: "other", role: UserRole.ADMIN });

    for (const change of [{ active: false }, { role: UserRole.VENDEDOR }]) {
      await assert.rejects(
        useCase.execute({ actorId: "me", id: "me", ...change }),
        (err: unknown) => err instanceof ConflictError && err.code === "CANNOT_CHANGE_OWN_ACCESS",
      );
    }
    const renamed = await useCase.execute({ actorId: "me", id: "me", name: "Eu", role: UserRole.ADMIN, active: true });
    assert.equal(renamed.name, "Eu");
  });

  test("usuário inexistente → USER_NOT_FOUND", async () => {
    const { useCase } = setup();
    await assert.rejects(
      useCase.execute({ actorId: "a", id: "nope", name: "x" }),
      (err: unknown) => err instanceof NotFoundError && err.code === "USER_NOT_FOUND",
    );
  });
});
