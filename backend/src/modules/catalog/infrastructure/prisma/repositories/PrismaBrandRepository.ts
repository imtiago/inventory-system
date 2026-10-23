import { Brand } from "@catalog/domain/entities/Brand";
import { brandAlreadyExists } from "@catalog/domain/errors/brandCategoryErrors";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { BrandMapper } from "../mappers/BrandMapper";
import { assertInTransaction, findIdByName, isUniqueNameViolation, lockRow } from "../brandCategorySql";

/** Corrida entre a checagem do use case e a gravação: o índice lower(name) decide. */
function mapUniqueName(error: unknown): never {
  throw isUniqueNameViolation(error) ? brandAlreadyExists() : error;
}

export class PrismaBrandRepository implements BrandRepository {
  async create(brand: Brand): Promise<Brand> {
    const created = await getDb()
      .brand.create({ data: BrandMapper.toCreatePersistence(brand) })
      .catch(mapUniqueName);
    return BrandMapper.toDomain(created);
  }

  async update(brand: Brand): Promise<Brand> {
    const updated = await getDb()
      .brand.update({ where: { id: brand.id }, data: BrandMapper.toUpdatePersistence(brand) })
      .catch(mapUniqueName);
    return BrandMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await getDb().brand.delete({ where: { id } });
  }

  async findById(id: string): Promise<Brand | null> {
    const brand = await getDb().brand.findUnique({ where: { id } });
    return brand ? BrandMapper.toDomain(brand) : null;
  }

  async findByName(name: string): Promise<Brand | null> {
    const id = await findIdByName("brand", name);
    return id ? this.findById(id) : null;
  }

  async lockById(id: string): Promise<boolean> {
    assertInTransaction("marca");
    return lockRow("brand", id);
  }

  async countProducts(id: string): Promise<number> {
    return getDb().product.count({ where: { brandId: id } });
  }
}
