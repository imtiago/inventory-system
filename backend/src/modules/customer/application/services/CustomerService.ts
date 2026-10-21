import { CustomerDetailsDTO } from "../dto/CustomerDTO";

export interface CustomerService {
  getCustomer(id: string): Promise<CustomerDetailsDTO | null>;
}
