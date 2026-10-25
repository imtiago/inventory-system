import { User } from "@auth/domain/entities/User";
import { UserRole } from "@auth/domain/enums/UserRole";
import { UserAccessChanges, UserRepository } from "@auth/domain/repositories/UserRepository";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { ILoginAttemptLimiter } from "@auth/application/ports/LoginAttemptLimiter";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { ITokenService } from "@auth/application/ports/ITokenService";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  passwordChangedAt: Date | null;
};

/**
 * Repositório em memória que guarda linhas (cópias), não entidades: uma
 * entidade lida e depois alterada só muda o "banco" pelo que o repositório grava.
 */
export class InMemoryUserRepository implements UserRepository {
  readonly rows = new Map<string, UserRecord>();
  readonly calls: string[] = [];

  add(props: { id: string; role: UserRole; active?: boolean; password?: string }) {
    this.rows.set(props.id, {
      id: props.id,
      name: props.id,
      email: `${props.id}@example.com`,
      password: props.password ?? "hash:senha",
      role: props.role,
      active: props.active ?? true,
      createdAt: new Date(),
      passwordChangedAt: null,
    });
  }

  row(id: string): UserRecord {
    return this.rows.get(id)!;
  }

  private toEntity(r: UserRecord | undefined): User | null {
    return r ? new User({ ...r }) : null;
  }

  private store(user: User) {
    this.rows.set(user.id, {
      passwordChangedAt: this.rows.get(user.id)?.passwordChangedAt ?? null,
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
    });
  }

  async findById(id: string) {
    this.calls.push("findById");
    return this.toEntity(this.rows.get(id));
  }
  async findByIdForUpdate(id: string) {
    this.calls.push("findByIdForUpdate");
    return this.toEntity(this.rows.get(id));
  }
  async findByEmail(email: string) {
    return this.toEntity([...this.rows.values()].find((u) => u.email === email));
  }
  async create(user: User) {
    this.calls.push("create");
    this.store(user);
    return user;
  }
  /** Grava a linha inteira (o que os use cases NÃO devem usar para senha/acesso). */
  async update(user: User) {
    this.calls.push("update");
    this.store(user);
    return user;
  }
  async updateAccess(id: string, changes: UserAccessChanges) {
    this.calls.push(`updateAccess:${Object.keys(changes).sort().join(",")}`);
    const row = this.row(id);
    this.rows.set(id, { ...row, ...changes });
    return this.toEntity(this.rows.get(id))!;
  }
  async updatePassword(id: string, passwordHash: string, changedAt: Date) {
    this.calls.push("updatePassword");
    const row = this.row(id);
    this.rows.set(id, { ...row, password: passwordHash, passwordChangedAt: changedAt });
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  async countActiveAdminsExcluding(id: string) {
    this.calls.push("countActiveAdminsExcluding");
    return [...this.rows.values()].filter(
      (u) => u.id !== id && u.active && u.role === UserRole.ADMIN,
    ).length;
  }
}

export class SpyTransactionManager implements TransactionManager {
  calls = 0;
  async execute<T>(work: () => Promise<T>): Promise<T> {
    this.calls++;
    return work();
  }
}

/** Hasher determinístico; `onHash` simula trabalho concorrente durante o bcrypt. */
export class FakePasswordHasher implements IPasswordHasher {
  onHash?: () => void;
  async hash(plain: string) {
    this.onHash?.();
    return `hash:${plain}`;
  }
  async compare(plain: string, hash: string) {
    return hash === `hash:${plain}`;
  }
  async compareWithDummy() {}
}

export class FakeLimiter implements ILoginAttemptLimiter {
  readonly counts = new Map<string, number>();
  constructor(private readonly max = 10) {}
  tryConsume(key: string) {
    const n = this.counts.get(key) ?? 0;
    if (n >= this.max) return false;
    this.counts.set(key, n + 1);
    return true;
  }
  clear(key: string) {
    this.counts.delete(key);
  }
}

export class FakeTokenService implements ITokenService {
  readonly signed: { sub: string; role: string }[] = [];
  async sign(payload: { sub: string; role: string }) {
    this.signed.push(payload);
    return `token:${payload.sub}:${payload.role}`;
  }
}
