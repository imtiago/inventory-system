// infrastructure/security/JwtTokenService.ts

import jwt from "jsonwebtoken";
import { ITokenService } from "@auth/application/ports/ITokenService";

export const JWT_ISSUER = "my-api";
export const JWT_AUDIENCE = "my-api-client";
export const JWT_ALGORITHM = "HS256" as const;
export const JWT_EXPIRES_IN = "8h";

export class JwtTokenService implements ITokenService {
  constructor(private readonly secret: string) {
    if (!secret) {
      throw new Error("JWT_SECRET não configurado");
    }
  }

  async sign(payload: { sub: string; role: string }): Promise<string> {
    return jwt.sign(payload, this.secret, {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }
}
