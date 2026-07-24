import { PaginationParams } from "@shared/application/pagination";
import { UserReadRepository } from "../contracts/UserReadRepository";

export class ListUsers {
  constructor(private userRepo: UserReadRepository) {}

  async execute({ page, limit }: PaginationParams) {
    return this.userRepo.list({ page, limit });
    // async execute(page: number, limit: number) {
    //   return this.userRepo.list(page, limit);
  }
}
