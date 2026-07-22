// infrastructure/prisma/queries/PrismaProductQuery.ts

import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { CustomerDetailsDTO } from "@customer/application/dto/CustomerDetailsDTO";
import { prisma } from "@shared/prisma";

export class PrismaCustomerReadRepository implements CustomerReadRepository {
  async list(): Promise<CustomerDetailsDTO[]> {
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return customers.map((customer) => ({
      id: customer.id,

      name: customer.name,
      address: customer.address,
      createdAt: customer.createdAt,
      email: customer.email,
      phone: customer.phone,
    }));
  }

  async getById(id: string): Promise<CustomerDetailsDTO | null> {
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) return null;

    return {
      id: customer.id,

      name: customer.name,
      address: customer.address,
      createdAt: customer.createdAt,
      email: customer.email,
      phone: customer.phone,
    };
  }
}
