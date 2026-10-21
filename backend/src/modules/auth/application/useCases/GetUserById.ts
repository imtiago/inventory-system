import { UserReadRepository } from "../contracts/UserReadRepository";

export class GetUserById {
  constructor(private userRepo: UserReadRepository) {}

  async execute(id: string) {
    return this.userRepo.findById(id);
  }
}
