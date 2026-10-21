import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { UserDTO } from "@auth/application/dto/UserDTO";

export class GetUserByIdUseCase {
  constructor(private userRepo: UserReadRepository) {}

  async execute(id: string): Promise<UserDTO | null> {
    const user = await this.userRepo.findById(id);
    return user;
  }
}
