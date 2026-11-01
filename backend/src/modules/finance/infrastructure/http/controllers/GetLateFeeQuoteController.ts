import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import {
  lateFeeQuoteQuerySchema,
  registerPaymentParamsSchema,
} from "@finance/interfaces/http/schemas/paymentSchemas";
import { makeGetLateFeeQuoteUseCase } from "../factories/PaymentFactory";

/** GET /receivables/:id/parcels/:parcelId/late-fees?paymentDate= → prévia de multa e juros. */
export function makeGetLateFeeQuoteController() {
  const useCase = makeGetLateFeeQuoteUseCase();
  const paramsSchema = registerPaymentParamsSchema(FinancialType.RECEIVABLE);
  return async function GetLateFeeQuoteController(req: FastifyRequest, reply: FastifyReply) {
    const { id, parcelId } = parseInput(paramsSchema, req.params);
    const { paymentDate } = parseInput(lateFeeQuoteQuerySchema, req.query ?? {});
    const data = await useCase.execute({ documentId: id, parcelId, paymentDate });
    return reply.send({ data });
  };
}
