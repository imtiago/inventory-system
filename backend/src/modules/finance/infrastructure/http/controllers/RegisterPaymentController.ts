import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import {
  registerPaymentBodySchema,
  registerPaymentParamsSchema,
} from "@finance/interfaces/http/schemas/paymentSchemas";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { makeRegisterPaymentUseCase } from "../factories/PaymentFactory";

export function makeRegisterPaymentController(type: FinancialType) {
  const useCase = makeRegisterPaymentUseCase(type);
  const paramsSchema = registerPaymentParamsSchema(type);
  return async function RegisterPaymentController(req: FastifyRequest, reply: FastifyReply) {
    const { id, parcelId } = parseInput(paramsSchema, req.params);
    const body = parseInput(registerPaymentBodySchema, req.body ?? {});

    const document = await useCase.execute({
      documentId: id,
      parcelId,
      ...body,
      userId: req.user!.sub,
    });
    return reply.status(201).send({ data: document });
  };
}
