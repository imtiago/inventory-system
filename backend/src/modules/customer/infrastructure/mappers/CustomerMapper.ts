import { Customer } from "../../domain/entities/Customer";
import { Customer as PrismaCustomer, Prisma } from "@prisma/client";

export class CustomerMapper {
  static toDomain(prisma: PrismaCustomer): Customer {
    return new Customer({
      id: prisma.id,
      name: prisma.name,
      email: prisma.email,
      phone: prisma.phone,
      address: prisma.address,
      createdAt: prisma.createdAt,
    });
  }

  static toCreatePersistence(
    customer: Customer,
  ): Prisma.CustomerUncheckedCreateInput {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
    };
  }

  static toUpdatePersistence(
    customer: Customer,
  ): Prisma.CustomerUncheckedUpdateInput {
    return {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    };
  }
}
