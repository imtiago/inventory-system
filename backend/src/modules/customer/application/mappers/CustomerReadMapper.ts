import { CustomerDTO } from "../dto/CustomerDTO";

type CustomerLike = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
};

export class CustomerReadMapper {
  static toDTO(data: CustomerLike): CustomerDTO {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      createdAt: data.createdAt,
    };
  }
}
