import { FastifyRequest, FastifyReply } from "fastify";
import { makeListSaleUseCase } from "../factories/ListSaleFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { salesListFilterSchema } from "@sales/interfaces/http/schemas/salePeriodSchema";
import { parseInput } from "@shared/http/parseInput";

export function makeListSalesController() {
  const useCase = makeListSaleUseCase();
  return async function ListSalesController(request: FastifyRequest, reply: FastifyReply) {
    const { page, limit } = parseInput(paginationSchema, request.query);

    // PaginatedResult já é { data, pagination }.
    const filter = parseInput(salesListFilterSchema, request.query);
    const sales = await useCase.execute({ page, limit }, filter);

    return reply.send(sales);
  };
}
