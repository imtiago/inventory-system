import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { AuthenticateUserUseCase } from "@auth/application/useCases/commands/AuthenticateUserUseCase";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";
import { JwtTokenService } from "@auth/infrastructure/security/JwtTokenService";
import { loginAttemptLimiter } from "@auth/infrastructure/security/LoginAttemptLimiter";
import { env } from "@shared/config/env";

export function makeAuthenticateUserUserUseCase() {
  const userRepository = new PrismaUserRepository();
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(env.JWT_SECRET);

  return new AuthenticateUserUseCase(
    userRepository,
    passwordHasher,
    tokenService,
    loginAttemptLimiter,
  );
}
