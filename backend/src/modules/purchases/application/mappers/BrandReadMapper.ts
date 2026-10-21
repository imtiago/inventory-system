import { BrandListDTO } from "../dto/PurchaseDTO";

export class BrandReadMapper {
  static toDTO(data: any): BrandListDTO {
    return {
      id: data.id,
      name: data.name,
    };
  }
}
