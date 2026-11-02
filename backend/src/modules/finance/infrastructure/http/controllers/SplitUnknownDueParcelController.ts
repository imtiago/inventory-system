import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { splitParcelBodySchema, splitParcelParamsSchema } from "@finance/interfaces/http/schemas/paymentSchemas";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { makeSplitUnknownDueParcelUseCase } from "../factories/PaymentFactory";

export function makeSplitUnknownDueParcelController(type: FinancialType) {
  const useCase = makeSplitUnknownDueParcelUseCase(type);
  return async function SplitUnknownDueParcelController(req: FastifyRequest, reply: FastifyReply) {
    const { id, parcelId } = parseInput(splitParcelParamsSchema, req.params);
    const { parcels } = parseInput(splitParcelBodySchema, req.body ?? {});
    const document = await useCase.execute({ documentId: id, parcelId, parcels });
    return reply.send({ data: document });
  };
}
