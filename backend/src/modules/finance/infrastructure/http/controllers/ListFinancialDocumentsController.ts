import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialListFilters } from "@finance/application/dto/FinancialDocumentReadDTO";
import {
  listPayablesQuerySchema,
  listReceivablesQuerySchema,
} from "@finance/interfaces/http/schemas/financialDocumentQuerySchemas";
import { makeListFinancialDocumentsUseCase } from "../factories/FinancialDocumentReadFactory";

/** Query da lista do tipo; a contraparte (customerId | supplierId) vira `partyId`. */
export function parseListQuery(type: FinancialType, query: unknown) {
  if (type === FinancialType.RECEIVABLE) {
    const { page, limit, customerId, ...rest } = parseInput(listReceivablesQuerySchema, query);
    return { pagination: { page, limit }, filters: { ...rest, partyId: customerId } as FinancialListFilters };
  }
  const { page, limit, supplierId, ...rest } = parseInput(listPayablesQuerySchema, query);
  return { pagination: { page, limit }, filters: { ...rest, partyId: supplierId } as FinancialListFilters };
}

export function makeListFinancialDocumentsController(type: FinancialType) {
  const useCase = makeListFinancialDocumentsUseCase(type);
  return async function ListFinancialDocumentsController(req: FastifyRequest, reply: FastifyReply) {
    const { filters, pagination } = parseListQuery(type, req.query);

    // { data, pagination, summary }
    const result = await useCase.execute(filters, pagination);
    return reply.status(200).send(result);
  };
}
