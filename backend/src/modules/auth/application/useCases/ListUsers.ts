import { UserReadRepository } from "../contracts/UserReadRepository";

export class ListUsers {
  constructor(private userRepo: UserReadRepository) {}

  async execute() {
    return this.userRepo.list();
    // async execute(page: number, limit: number) {
    //   return this.userRepo.list(page, limit);
  }
}
