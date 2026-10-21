import { CustomerDetailsDTO } from "../dto/CustomerDTO";

export class CustomerReadMapper {
  static toDTO(data: any): CustomerDetailsDTO {
    return {
      id: data.id,
      address: data.address,
      createdAt: data.createdAt,
      email: data.email,
      phone: data.phone,
      name: data.name,
      code: data.code,
    };
  }
}
