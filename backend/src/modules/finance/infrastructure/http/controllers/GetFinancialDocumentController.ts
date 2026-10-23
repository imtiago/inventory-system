import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { documentParamsSchema } from "@finance/interfaces/http/schemas/financialDocumentQuerySchemas";
import { makeGetFinancialDocumentByIdUseCase } from "../factories/FinancialDocumentReadFactory";

export function makeGetFinancialDocumentController(type: FinancialType) {
  const useCase = makeGetFinancialDocumentByIdUseCase(type);
  const paramsSchema = documentParamsSchema(type);
  return async function GetFinancialDocumentController(req: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(paramsSchema, req.params);

    const document = await useCase.execute(id);
    return reply.send({ data: document });
  };
}
