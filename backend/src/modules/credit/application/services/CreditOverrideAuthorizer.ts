import { ErrorCodes, ForbiddenError, TooManyRequestsError } from "@shared/domain/errors";
import { hasUserPermission } from "@shared/auth/permissions";
import type { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import {
  LOGIN_MAX_PER_ACCOUNT,
  LOGIN_MAX_PER_IP,
  LOGIN_MAX_PER_PAIR,
  type ILoginAttemptLimiter,
} from "@auth/application/ports/LoginAttemptLimiter";
import type { UserRepository } from "@auth/domain/repositories/UserRepository";
import { normalizeEmail } from "@auth/domain/services/normalizeEmail";

/** Autorização de exceção na venda (limite/atraso) por quem tem `credit.approve`, com a própria senha. */
export interface CreditOverrideInput {
  approverEmail: string;
  approverPassword: string;
  /** 3..200 */
  reason: string;
}

const denied = () => new ForbiddenError("Autorização recusada.", ErrorCodes.CREDIT_OVERRIDE_DENIED);

/**
 * Confere o aprovador: usuário ativo, senha certa e `credit.approve` (ADMIN ou marcado). Tentativas
 * contam no limitador com as mesmas cotas do login (par IP+e-mail, conta, IP), em chaves `override:…`;
 * acima → 429. Qualquer falha → 403 `CREDIT_OVERRIDE_DENIED` sem dizer o motivo.
 */
export class CreditOverrideAuthorizer {
  constructor(
    private readonly users: Pick<UserRepository, "findByEmail">,
    private readonly passwordHasher: IPasswordHasher,
    private readonly attemptLimiter: ILoginAttemptLimiter,
  ) {}

  async authorize(input: CreditOverrideInput, ip: string): Promise<{ approverId: string }> {
    const email = normalizeEmail(input.approverEmail);
    const pairKey = `override:${ip}|${email}`;
    const accountKey = `override:account:${email}`;
    const ipKey = `override:ip:${ip}`;
    const layers: [string, number][] = [
      [pairKey, LOGIN_MAX_PER_PAIR],
      [accountKey, LOGIN_MAX_PER_ACCOUNT],
      [ipKey, LOGIN_MAX_PER_IP],
    ];
    // Checa e conta antes de qualquer await (atômico no event loop), como no login.
    const consumed: string[] = [];
    for (const [key, max] of layers) {
      if (!this.attemptLimiter.tryConsume(key, max)) {
        for (const done of consumed) this.attemptLimiter.release(done);
        throw new TooManyRequestsError();
      }
      consumed.push(key);
    }

    const user = await this.users.findByEmail(email);
    let passwordMatch = false;
    if (user && user.active) {
      passwordMatch = await this.passwordHasher.compare(input.approverPassword, user.password);
    } else {
      await this.passwordHasher.compareWithDummy(input.approverPassword);
    }
    if (!user || !user.active || !passwordMatch) throw denied();

    // Senha provada: zera par e conta; o IP só devolve a vaga desta tentativa.
    this.attemptLimiter.clear(pairKey);
    this.attemptLimiter.clear(accountKey);
    this.attemptLimiter.release(ipKey);

    if (!hasUserPermission({ role: user.role, canApproveCredit: user.canApproveCredit }, "credit.approve")) {
      throw denied();
    }
    return { approverId: user.id };
  }
}
