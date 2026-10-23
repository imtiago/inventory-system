import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 10;

// Hash fixo (custo 10, igual a BCRYPT_COST) pré-calculado uma única vez.
const DUMMY_HASH = "$2b$10$.Dgz6OM35M6sNnc7xppwFO7J2O5sfdG1DOQ4qxhAmHs5lNvGOH2Yu";

export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_COST);
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  async compareWithDummy(plainPassword: string): Promise<void> {
    await bcrypt.compare(plainPassword, DUMMY_HASH);
  }
}
