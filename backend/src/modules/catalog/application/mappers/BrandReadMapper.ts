import { BrandDTO } from "../dto/BrandDTO";

export class BrandReadMapper {
  static toDTO(row: { id: string; name: string; productsCount: number }): BrandDTO {
    return { id: row.id, name: row.name, productsCount: row.productsCount };
  }
}
