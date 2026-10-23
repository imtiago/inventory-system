import { NotFoundError } from "@shared/domain/errors";
import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { UserDTO } from "@auth/application/dto/UserDTO";

export class GetUserByIdUseCase {
  constructor(private readonly userRepo: UserReadRepository) {}

  async execute(id: string): Promise<UserDTO> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("Usuário não encontrado.", "USER_NOT_FOUND");
    return user;
  }
}
