import { Customer } from "@customer/domain/entities/Customer";
import { Customer as PrismaCustomer, Prisma } from "@prisma/client";

export class CustomerMapper {
  static toDomain(prisma: PrismaCustomer): Customer {
    return new Customer({
      id: prisma.id,
      name: prisma.name,
      code: prisma.code,
      email: prisma.email,
      phone: prisma.phone,
      address: prisma.address,
      document: prisma.document,
      createdAt: prisma.createdAt,
    });
  }

  static toCreatePersistence(
    customer: Customer,
  ): Prisma.CustomerUncheckedCreateInput {
    return {
      id: customer.id,
      name: customer.name,
      code: customer.code,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      document: customer.document,
      createdAt: customer.createdAt,
    };
  }
}
