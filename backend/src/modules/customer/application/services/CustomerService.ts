import { CustomerDetailsDTO } from "../dto/CustomerDetailsDTO";

export interface CustomerService {
  getCustomer(id: string): Promise<CustomerDetailsDTO | null>;
}
