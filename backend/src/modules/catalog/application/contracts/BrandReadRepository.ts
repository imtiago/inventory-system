
import { BrandListDTO } from "../dto/BrandListDTO";

export interface BrandReadRepository {
  list(): Promise<BrandListDTO[]>;

  getById(id: string): Promise<BrandListDTO | null>;
}
