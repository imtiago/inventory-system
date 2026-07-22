// application/queries/ProductQuery.ts

import { CustomerDetailsDTO } from "../dto/CustomerDetailsDTO";

export interface CustomerReadRepository {
  list(): Promise<CustomerDetailsDTO[]>;

  getById(id: string): Promise<CustomerDetailsDTO | null>;
}
