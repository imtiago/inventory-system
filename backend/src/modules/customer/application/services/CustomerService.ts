import { CustomerDTO } from "../dto/CustomerDTO";

export interface CustomerService {
  getCustomer(id: string): Promise<CustomerDTO | null>;
}
