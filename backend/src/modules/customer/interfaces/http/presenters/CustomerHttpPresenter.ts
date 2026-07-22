import { Customer } from "@customer/domain/entities/Customer";

export class CustomerHttpPresenter {
  static toHTTP(customer: Customer) {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
    };
  }

  static toHTTPList(customers: Customer[]) {
    return customers.map(CustomerHttpPresenter.toHTTP);
  }
}
