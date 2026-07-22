import { BrandReadRepository } from "../contracts/BrandReadRepository";

export class ListBrandsUseCase {
  constructor(private readonly brandQuery: BrandReadRepository) {}

  async execute() {
    return this.brandQuery.list();
  }
}
