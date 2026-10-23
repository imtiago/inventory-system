import { CategoryDTO } from "../dto/CategoryDTO";

export class CategoryReadMapper {
  static toDTO(row: { id: string; name: string; productsCount: number }): CategoryDTO {
    return { id: row.id, name: row.name, productsCount: row.productsCount };
  }
}
