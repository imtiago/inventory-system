import { GetCustomerByIdUseCase } from "../useCases/queries/GetCustomerByIdUseCase";
import { CustomerService } from "./CustomerService";

export class CustomerApplicationService implements CustomerService {
  constructor(private readonly getCustomerUseCase: GetCustomerByIdUseCase) {}

  async getCustomer(id: string) {
    return this.getCustomerUseCase.execute(id);
  }
}
