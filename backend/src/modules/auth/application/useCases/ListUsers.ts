import { UserRepository } from "../../domain/repositories/UserRepository";

export class ListUsers {
  constructor(private userRepo: UserRepository) {}

  async execute(page: number, limit: number) {
    return this.userRepo.list(page, limit);
  }
}
