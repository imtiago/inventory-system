import { TooManyRequestsError, UnauthorizedError } from "@shared/domain/errors";
import { IAuthRequestInput, IAuthResult } from "@auth/application/dto/UserDTO";
import { ITokenService } from "@auth/application/ports/ITokenService";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import {
  ILoginAttemptLimiter,
  loginAccountKey,
  loginAttemptKey,
  loginIpKey,
  LOGIN_MAX_PER_ACCOUNT,
  LOGIN_MAX_PER_IP,
  LOGIN_MAX_PER_PAIR,
} from "@auth/application/ports/LoginAttemptLimiter";
import { UserRepository } from "@auth/domain/repositories/UserRepository";
import { normalizeEmail } from "@auth/domain/services/normalizeEmail";

export class AuthenticateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
    private readonly attemptLimiter: ILoginAttemptLimiter,
  ) {}

  async execute({ email, password, ip }: IAuthRequestInput): Promise<IAuthResult> {
    const normalizedEmail = normalizeEmail(email);
    const key = loginAttemptKey(ip, normalizedEmail);

    const accountKey = loginAccountKey(normalizedEmail);
    const ipKey = loginIpKey(ip);

    // Três camadas: IP+e-mail, conta (qualquer IP) e IP (qualquer e-mail). Checa e conta
    // antes de qualquer await (atômico no event loop). Se uma camada recusa, devolve as vagas
    // das camadas já consumidas: tentativa recusada (429) não gasta o orçamento das outras.
    const layers: [string, number][] = [
      [key, LOGIN_MAX_PER_PAIR],
      [accountKey, LOGIN_MAX_PER_ACCOUNT],
      [ipKey, LOGIN_MAX_PER_IP],
    ];
    const consumed: string[] = [];
    for (const [layerKey, max] of layers) {
      if (!this.attemptLimiter.tryConsume(layerKey, max)) {
        for (const done of consumed) this.attemptLimiter.release(done);
        throw new TooManyRequestsError();
      }
      consumed.push(layerKey);
    }

    const user = await this.userRepo.findByEmail(normalizedEmail);

    let passwordMatch = false;
    if (user && user.active) {
      passwordMatch = await this.passwordHasher.compare(password, user.password);
    } else {
      // Mesmo custo de um usuário existente: não revela se o e-mail existe/está ativo.
      await this.passwordHasher.compareWithDummy(password);
    }

    if (!user || !user.active || !passwordMatch) {
      throw new UnauthorizedError("Credenciais inválidas.", "INVALID_CREDENTIALS");
    }

    // Sucesso prova a senha da conta: zera IP+e-mail e conta. O contador do IP NÃO é zerado
    // (um atacante entrando na própria conta não ganharia tentativas contra outras); só
    // devolve a vaga desta tentativa, de modo que apenas falhas contem para o limite por IP.
    this.attemptLimiter.clear(key);
    this.attemptLimiter.clear(accountKey);
    this.attemptLimiter.release(ipKey);

    const token = await this.tokenService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
