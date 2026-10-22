import { UnauthorizedError } from "@shared/domain/errors";
import { IAuthRequestInput } from "@auth/application/dto/UserDTO";
import { ITokenService } from "@auth/application/ports/ITokenService";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

export class AuthenticateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  async execute({
    email,
    password,
  }: IAuthRequestInput): Promise<{ token: string }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new UnauthorizedError("Credenciais inválidas.", "INVALID_CREDENTIALS");

    const passwordMatch = await this.passwordHasher.compare(
      password,
      user.password,
    );
    if (!passwordMatch) throw new UnauthorizedError("Credenciais inválidas.", "INVALID_CREDENTIALS");

    const token = await this.tokenService.sign({
      sub: user.id,
      role: user.role,
    });

    return { token };
  }
}
