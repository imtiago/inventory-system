import { ProductListDTO } from "../dto/ProductListDTO";

export class ProductReadMapper {
  static toDTO(data: any): ProductListDTO {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      brand: {
        id: data.brand.id,
        name: data.brand.name,
      },
      category: {
        id: data.category.id,
        name: data.category.name,
      },
      variantsCount: data._count.variants,
    };
  }
}
