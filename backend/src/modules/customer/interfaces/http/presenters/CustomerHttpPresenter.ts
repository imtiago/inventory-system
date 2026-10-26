import { CustomerDTO } from "@customer/application/dto/CustomerDTO";

/** Contrato HTTP do cliente: { id, code, name, email, phone, address, document, createdAt }. */
export class CustomerHttpPresenter {
  static toHTTP(customer: CustomerDTO): CustomerDTO {
    return {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      document: customer.document,
      createdAt: customer.createdAt,
    };
  }
}
