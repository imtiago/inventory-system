// src/modules/customer/application/mappers/CustomerMapper.ts

import { Customer } from "../../domain/entities/Customer";
import { Customer as PrismaCustomer, Prisma } from "@prisma/client";

export class CustomerMapper {
  // Banco -> Domínio
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

  // Domínio -> Banco (Create)
  static toCreatePersistence(customer: Customer): Prisma.CustomerCreateInput {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(customer: Customer): Prisma.CustomerUpdateInput {
    return {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    };
  }
}
