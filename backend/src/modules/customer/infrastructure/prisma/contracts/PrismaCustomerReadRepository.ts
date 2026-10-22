import { ProductListFilters } from "@catalog/application/contracts/ProductListFilters";
import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { CustomerDetailsDTO } from "@customer/application/dto/CustomerDTO";
import { CustomerReadMapper } from "@customer/application/mappers/CustomerReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaCustomerReadRepository implements CustomerReadRepository {
  async list(
    pagination: PaginationRequest,
    filters?: ProductListFilters,
  ): Promise<PaginatedResult<CustomerDetailsDTO>> {
    const paginationOptions = buildPagination(pagination);

    const search = filters?.search?.trim();

    const where = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            // {
            //   code: {
            //     contains: search,
            //     mode: "insensitive" as const,
            //   },
            // },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      getDb().customer.findMany({
        where,

        ...paginationOptions,
        orderBy: {
          name: "asc",
        },
      }),
      getDb().customer.count({
        where,
      }),
    ]);
    const dt = customers.map((customer) => CustomerReadMapper.toDTO(customer));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<CustomerDetailsDTO | null> {
    const customer = await getDb().customer.findUnique({
      where: { id },
    });

    if (!customer) return null;

    return CustomerReadMapper.toDTO(customer);
  }
}
