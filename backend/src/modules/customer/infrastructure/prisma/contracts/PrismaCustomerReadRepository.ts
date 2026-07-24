// infrastructure/prisma/queries/PrismaProductQuery.ts

import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { CustomerDetailsDTO } from "@customer/application/dto/CustomerDetailsDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaCustomerReadRepository implements CustomerReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<CustomerDetailsDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        ...paginationOptions,
        orderBy: {
          name: "asc",
        },
      }),
      prisma.customer.count(),
    ]);
    const dt = customers.map((customer) => ({
      id: customer.id,

      name: customer.name,
      address: customer.address,
      createdAt: customer.createdAt,
      email: customer.email,
      phone: customer.phone,
    }));
    return buildPaginatedResult(dt, total, pagination);
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
