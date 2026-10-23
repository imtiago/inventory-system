import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import {
  registerPaymentBodySchema,
  registerPaymentParamsSchema,
} from "@finance/interfaces/http/schemas/paymentSchemas";
import { makeRegisterPaymentUseCase } from "../factories/PaymentFactory";

export function makeRegisterPaymentController() {
  const useCase = makeRegisterPaymentUseCase();
  return async function RegisterPaymentController(req: FastifyRequest, reply: FastifyReply) {
    const { id, parcelId } = parseInput(registerPaymentParamsSchema, req.params);
    const body = parseInput(registerPaymentBodySchema, req.body ?? {});

    const receivable = await useCase.execute({
      documentId: id,
      parcelId,
      ...body,
      userId: req.user!.sub,
    });
    return reply.status(201).send({ data: receivable });
  };
}
