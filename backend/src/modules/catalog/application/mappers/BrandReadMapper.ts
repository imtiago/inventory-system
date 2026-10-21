import { BrandListDTO } from "../dto/BrandDTO";

export class BrandReadMapper {
  static toDTO(data: any): BrandListDTO {
    return {
      id: data.id,
      name: data.name,
    };
  }
}
