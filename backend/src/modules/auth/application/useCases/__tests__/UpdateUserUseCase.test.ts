import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { User } from "@auth/domain/entities/User";
import { UserRole } from "@auth/domain/enums/UserRole";
import { UserRepository } from "@auth/domain/repositories/UserRepository";
import { UpdateUserUseCase } from "../commands/UpdateUserUseCase";

class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();
  adminCountCalls = 0;

  add(props: { id: string; role: UserRole; active?: boolean }) {
    this.users.set(
      props.id,
      new User({ ...props, name: props.id, email: `${props.id}@example.com`, password: "hash" }),
    );
  }
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async create(user: User) {
    this.users.set(user.id, user);
    return user;
  }
  async update(user: User) {
    this.users.set(user.id, user);
    return user;
  }
  async delete(id: string) {
    this.users.delete(id);
  }
  async countActiveAdminsExcluding(id: string) {
    this.adminCountCalls++;
    return [...this.users.values()].filter(
      (u) => u.id !== id && u.active && u.role === UserRole.ADMIN,
    ).length;
  }
}

class SpyTransactionManager implements TransactionManager {
  calls = 0;
  async execute<T>(work: () => Promise<T>): Promise<T> {
    this.calls++;
    return work();
  }
}

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
        (err: unknown) =>
          err instanceof ConflictError && err.code === "LAST_ADMIN",
      );
    }
    assert.equal(repo.users.get("last")!.role, UserRole.ADMIN);
    assert.equal(repo.users.get("last")!.active, true);
  });

  test("com outro admin ativo, rebaixar/desativar um admin é permitido", async () => {
    const { repo, tx, useCase } = setup();
    repo.add({ id: "actor", role: UserRole.ADMIN });
    repo.add({ id: "target", role: UserRole.ADMIN });

    const out = await useCase.execute({ actorId: "actor", id: "target", role: UserRole.ESTOQUISTA, active: false });
    assert.equal(out.role, UserRole.ESTOQUISTA);
    assert.equal(out.active, false);
    assert.equal(tx.calls, 1);
    assert.equal(repo.adminCountCalls, 1);
  });

  test("reativar/promover ou alterar não-admin não consulta a contagem de admins", async () => {
    const { repo, useCase } = setup();
    repo.add({ id: "actor", role: UserRole.ADMIN });
    repo.add({ id: "seller", role: UserRole.VENDEDOR, active: false });

    const out = await useCase.execute({ actorId: "actor", id: "seller", role: UserRole.ADMIN, active: true });
    assert.equal(out.role, UserRole.ADMIN);
    assert.equal(out.active, true);
    await useCase.execute({ actorId: "actor", id: "seller", name: "novo nome" });
    assert.equal(repo.adminCountCalls, 0);
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
