import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import {
  reversePaymentBodySchema,
  reversePaymentParamsSchema,
} from "@finance/interfaces/http/schemas/paymentSchemas";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { makeReversePaymentUseCase } from "../factories/PaymentFactory";

export function makeReversePaymentController(type: FinancialType) {
  const useCase = makeReversePaymentUseCase(type);
  return async function ReversePaymentController(req: FastifyRequest, reply: FastifyReply) {
    const { paymentId } = parseInput(reversePaymentParamsSchema, req.params);
    const { reason } = parseInput(reversePaymentBodySchema, req.body ?? {});

    const document = await useCase.execute({ paymentId, reason, userId: req.user!.sub });
    return reply.send({ data: document });
  };
}
