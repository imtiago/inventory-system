import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";

export class GetUserByIdUseCase {
  constructor(private userRepo: UserReadRepository) {}

  async execute(id: string) {
    return this.userRepo.findById(id);
  }
}
