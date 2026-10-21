import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";
import { AuthenticateUserUseCase } from "@auth/application/useCases/commands/AuthenticateUserUseCase";
import { BcryptPasswordHasher } from "@auth/infrastructure/security/BcryptPasswordHasher";
import { JwtTokenService } from "@auth/infrastructure/security/JwtTokenService";
import { prisma } from "@shared/prisma";
export function makeAuthenticateUserUserUseCase() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET não configurado");
  }

  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(jwtSecret);

  return new AuthenticateUserUseCase(
    userRepository,
    passwordHasher,
    tokenService,
  );
}
