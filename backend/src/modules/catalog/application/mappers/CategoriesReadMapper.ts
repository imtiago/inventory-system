import { CategoriesListDTO } from "../dto/CategoriesListDTO";

export class CategoriesReadMapper {
  static toDTO(data: any): CategoriesListDTO {
    return {
      id: data.id,
      name: data.name,
    };
  }
}
