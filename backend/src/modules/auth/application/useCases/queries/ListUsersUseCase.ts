import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { IListUsersInput } from "@auth/application/dto/UserDTO";

export class ListUsersUseCase {
  constructor(private readonly userRepo: UserReadRepository) {}

  async execute(params: IListUsersInput) {
    return this.userRepo.list(params);
  }
}
