import { ProductDetailDTO } from "../dto/ProductDTO";

interface ProductReadRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  _count: { variants: number };
}

export class ProductReadMapper {
  static toDTO(data: ProductReadRow): ProductDetailDTO {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      brand: { id: data.brand.id, name: data.brand.name },
      category: { id: data.category.id, name: data.category.name },
      variantsCount: data._count.variants,
      createdAt: data.createdAt,
    };
  }
}
