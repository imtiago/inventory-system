import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import {
  registerPaymentBodySchema,
  registerPaymentParamsSchema,
} from "@finance/interfaces/http/schemas/paymentSchemas";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { makeRegisterPaymentUseCase } from "../factories/PaymentFactory";
import { hasUserPermission } from "@shared/auth/permissions";

export function makeRegisterPaymentController(type: FinancialType) {
  const useCase = makeRegisterPaymentUseCase(type);
  const paramsSchema = registerPaymentParamsSchema(type);
  const bodySchema = registerPaymentBodySchema(type);
  return async function RegisterPaymentController(req: FastifyRequest, reply: FastifyReply) {
    const { id, parcelId } = parseInput(paramsSchema, req.params);
    const body = parseInput(bodySchema, req.body ?? {});
    const user = req.user!;

    const document = await useCase.execute({
      documentId: id,
      parcelId,
      ...body,
      userId: user.sub,
      canWaive: hasUserPermission({ role: user.role, canApproveCredit: user.canApproveCredit === true }, "credit.approve"),
    });
    return reply.status(201).send({ data: document });
  };
}
