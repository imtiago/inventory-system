import { GetCustomer } from "../useCases/queries/GetCustomerUseCase";
import { CustomerService } from "./CustomerService";

export class CustomerApplicationService implements CustomerService {
  constructor(private readonly getCustomerUseCase: GetCustomer) {}

  async getCustomer(id: string) {
    return this.getCustomerUseCase.execute(id);
  }
}
