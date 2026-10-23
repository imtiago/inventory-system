import { Category } from "@catalog/domain/entities/Category";
import { categoryAlreadyExists } from "@catalog/domain/errors/brandCategoryErrors";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { CategoryMapper } from "../mappers/CategoryMapper";
import { assertInTransaction, findIdByName, isUniqueNameViolation, lockRow } from "../brandCategorySql";

/** Corrida entre a checagem do use case e a gravação: o índice lower(name) decide. */
function mapUniqueName(error: unknown): never {
  throw isUniqueNameViolation(error) ? categoryAlreadyExists() : error;
}

export class PrismaCategoryRepository implements CategoryRepository {
  async create(category: Category): Promise<Category> {
    const created = await getDb()
      .category.create({ data: CategoryMapper.toCreatePersistence(category) })
      .catch(mapUniqueName);
    return CategoryMapper.toDomain(created);
  }

  async update(category: Category): Promise<Category> {
    const updated = await getDb()
      .category.update({ where: { id: category.id }, data: CategoryMapper.toUpdatePersistence(category) })
      .catch(mapUniqueName);
    return CategoryMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await getDb().category.delete({ where: { id } });
  }

  async findById(id: string): Promise<Category | null> {
    const category = await getDb().category.findUnique({ where: { id } });
    return category ? CategoryMapper.toDomain(category) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const id = await findIdByName("category", name);
    return id ? this.findById(id) : null;
  }

  async lockById(id: string): Promise<boolean> {
    assertInTransaction("categoria");
    return lockRow("category", id);
  }

  async countProducts(id: string): Promise<number> {
    return getDb().product.count({ where: { categoryId: id } });
  }
}
