import { CategoryReadRepository } from "@catalog/application/contracts/CategoryReadRepository";
import { CategoryDTO } from "@catalog/application/dto/CategoryDTO";
import { categoryNotFound } from "@catalog/domain/errors/brandCategoryErrors";

export class GetCategoryByIdUseCase {
  constructor(private repository: CategoryReadRepository) {}

  async execute(id: string): Promise<CategoryDTO> {
    const category = await this.repository.getById(id);
    if (!category) throw categoryNotFound();
    return category;
  }
}
