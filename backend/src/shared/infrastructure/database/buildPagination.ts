import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export function buildPagination(pagination: PaginationRequest) {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  };
}
