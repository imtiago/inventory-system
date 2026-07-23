import { SaleDetailsDTO } from "../dto/SaleDTO";

export interface SaleReadRepository {
  list(): Promise<SaleDetailsDTO[]>;

  getById(id: string): Promise<SaleDetailsDTO | null>;
}
