import { IUserOutput } from "@auth/application/dto/UserDTO";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

export class GetUserByIdUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(id: string): Promise<IUserOutput | null> {
    const user = await this.userRepo.findById(id);
    if (!user) return null;
    return {
      id: user.id,
      code: user.code,
      name: user.name,
      role: user.role,
      email: user.email,
    };
  }
}
