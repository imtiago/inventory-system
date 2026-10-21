// infrastructure/security/JwtTokenService.ts

import jwt from "jsonwebtoken";
import { ITokenService } from "@auth/application/ports/ITokenService";

export class JwtTokenService implements ITokenService {
  constructor(private readonly secret: string) {
    if (!secret) {
      throw new Error("JWT_SECRET não configurado");
    }
  }

  async sign(payload: { sub: string; role: string }): Promise<string> {
    return jwt.sign(payload, this.secret, {
      expiresIn: "1d",
      issuer: "my-api",
      audience: "my-api-client",
    });
  }
}
