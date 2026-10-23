import { TooManyRequestsError, UnauthorizedError } from "@shared/domain/errors";
import { IAuthRequestInput, IAuthResult } from "@auth/application/dto/UserDTO";
import { ITokenService } from "@auth/application/ports/ITokenService";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import {
  ILoginAttemptLimiter,
  loginAttemptKey,
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

    // Checa e conta a tentativa antes de qualquer await (atômico no event loop).
    if (!this.attemptLimiter.tryConsume(key)) {
      throw new TooManyRequestsError();
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

    this.attemptLimiter.clear(key);

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
