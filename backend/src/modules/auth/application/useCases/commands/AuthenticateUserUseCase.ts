import { IAuthRequestInput } from "@auth/application/dto/UserDTO";
import { UserRepository } from "@auth/domain/repositories/UserRepository";
import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";

export class AuthenticateUserUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute({
    email,
    password,
  }: IAuthRequestInput): Promise<{ token: string }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const passwordMatch = await compare(password, user.password);
    if (!passwordMatch) throw new Error("Invalid credentials");

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" },
    );

    return { token };
  }
}
